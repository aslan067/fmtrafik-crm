'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  ArrowLeft, Save, Box, BarChart2, Globe, 
  RefreshCw, Calculator, Truck, Briefcase, 
  Tag, AlertCircle, TrendingUp, DollarSign, Percent,
  Image as ImageIcon, Layers, FileText, Wand2, Eye,
  CheckCircle, XCircle
} from 'lucide-react'

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general') 
  
  // İlişkisel Veriler
  const [channels, setChannels] = useState([]) 
  const [productGroups, setProductGroups] = useState([])
  const [suppliers, setSuppliers] = useState([])
  
  // Ürün State
  const [product, setProduct] = useState({
    // --- GENEL ---
    name: '',
    product_code: '',
    description: '',
    image_url: '',
    unit: 'Adet',
    currency: 'TRY',
    is_active: true,
    is_published: false,
    
    // --- LOJİSTİK ---
    tax_rate: 20,
    desi: 1,
    stock_quantity: 0,
    safety_stock: 5,

    // --- İLİŞKİLER (Artık Tab 2'de) ---
    supplier_id: '',
    product_group_id: '',

    // --- B2B FİYATLANDIRMA (DB İsimleri) ---
    supplier_list_price: '',         // Tedarikçi Giriş Fiyatı
    supplier_discount_percentage: '', // İskonto
    price_multiplier: '1.80',        // Çarpan
    dealer_list_price: '',           // Bayi Satış Fiyatı (Katalog)

    // --- E-TİCARET ---
    market_data: {} 
  })

  // Simülasyon State'i (UI Gösterimi İçin)
  const [simulation, setSimulation] = useState({
    netCost: 0,
    profit: 0,
    margin: 0
  })

  // İstatistikler
  const [stats, setStats] = useState({ totalSold: 0, totalRevenue: 0, lastSaleDate: null })

  useEffect(() => {
    loadInitialData()
  }, [params.id])

  // --- HESAPLAMA MOTORU (Yeni Ürün Ekle Mantığıyla Birebir) ---
  useEffect(() => {
    calculateB2BSimulation()
  }, [
    product.supplier_list_price, 
    product.supplier_discount_percentage, 
    product.price_multiplier,
    product.dealer_list_price
  ])

  const calculateB2BSimulation = () => {
    const sListPrice = parseFloat(product.supplier_list_price) || 0
    const sDiscount = parseFloat(product.supplier_discount_percentage) || 0
    const multiplier = parseFloat(product.price_multiplier) || 0
    const currentDealerPrice = parseFloat(product.dealer_list_price) || 0

    // 1. Net Maliyet Hesapla
    const valNetCost = sListPrice * (1 - (sDiscount / 100))

    // 2. Otomatik Fiyat Önerisi (Sadece inputlar değiştiğinde ve manuel override yoksa tetiklenebilir, 
    // ama burada kullanıcı deneyimi için sadece görseli hesaplıyoruz, 
    // input güncellemesini aşağıda ayrı buton veya olayla yapacağız)
    
    // Simülasyon Değerleri (Mevcut dealer_list_price üzerinden kar hesabı)
    const profit = currentDealerPrice - valNetCost
    const margin = currentDealerPrice > 0 ? (profit / currentDealerPrice) * 100 : 0

    setSimulation({
      netCost: valNetCost,
      profit: profit,
      margin: margin
    })
  }

  // Inputlar değiştiğinde OTOMATİK FİYAT GÜNCELLEME (Opsiyonel: New Product sayfasında bu onBlur veya onChange'de çalışıyordu)
  // Burada kullanıcı manuel de değiştirebilmeli. O yüzden bir "Hesapla" butonu veya kurala bağlı useEffect kullanabiliriz.
  // Kullanıcı kolaylığı için: Eğer iskonto değişirse veya tedarikçi fiyatı değişirse, önerilen fiyatı yazarız.
  const handlePriceInputsChange = (field, value) => {
    // Önce state'i güncelle
    const newProduct = { ...product, [field]: value }
    
    // Değerleri al
    const sListPrice = field === 'supplier_list_price' ? parseFloat(value) : parseFloat(product.supplier_list_price || 0)
    const sDiscount = field === 'supplier_discount_percentage' ? parseFloat(value) : parseFloat(product.supplier_discount_percentage || 0)
    const multiplier = field === 'price_multiplier' ? parseFloat(value) : parseFloat(product.price_multiplier || 1.8)

    // Net Maliyet
    const valNetCost = sListPrice * (1 - (sDiscount / 100))
    
    let suggestedDealerPrice = parseFloat(product.dealer_list_price || 0)

    // --- MANTIK: İskonto var mı yok mu? ---
    if (field === 'supplier_list_price' || field === 'supplier_discount_percentage' || field === 'price_multiplier') {
        if (sDiscount > 0) {
            // İskontolu Sistem: Bayi Fiyatı = Tedarikçi Liste Fiyatı
            suggestedDealerPrice = sListPrice
        } else {
            // Net Fiyat Sistemi: Bayi Fiyatı = Net Maliyet * Çarpan
            suggestedDealerPrice = valNetCost * multiplier
        }
        
        // Hesaplanan değeri de state'e yaz
        newProduct.dealer_list_price = Number(suggestedDealerPrice.toFixed(2))
    }

    setProduct(newProduct)
  }

  // --- E-TİCARET HESAPLAMA ---
  const calculateChannelPrice = (channel) => {
    const cost = simulation.netCost || 0 // Net maliyet simülasyondan gelir
    const desi = parseFloat(product.desi) || 1
    const vatRate = parseFloat(product.tax_rate) || 20
    const commission = parseFloat(channel.commission_rate) || 0
    const profitMargin = parseFloat(channel.profit_margin) || 20
    const baseCargo = parseFloat(channel.cargo_base_fee) || 0
    const desiMulti = parseFloat(channel.cargo_desi_multiplier) || 0

    const cargoCost = baseCargo + (desi * desiMulti)
    const totalCost = cost + cargoCost
    const markup = 1 + ((profitMargin + commission + vatRate) / 100)
    const finalPrice = totalCost * markup

    return Number(finalPrice.toFixed(2))
  }

  const applyAutoPrice = (channel) => {
    const suggestedPrice = calculateChannelPrice(channel)
    setProduct(prev => ({
      ...prev,
      market_data: {
        ...prev.market_data,
        [channel.id]: {
          ...(prev.market_data?.[channel.id] || {}),
          price: suggestedPrice,
          active: true
        }
      }
    }))
  }

  const updateMarketData = (channelId, field, value) => {
    setProduct(prev => ({
      ...prev,
      market_data: {
        ...prev.market_data,
        [channelId]: {
          ...(prev.market_data?.[channelId] || {}),
          [field]: value
        }
      }
    }))
  }

  async function loadInitialData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      const [channelsRes, groupsRes, suppliersRes] = await Promise.all([
        supabase.from('sales_channels').select('*').eq('company_id', profile.company_id),
        supabase.from('product_groups').select('id, name').eq('company_id', profile.company_id),
        supabase.from('suppliers').select('id, name').eq('company_id', profile.company_id)
      ])

      setChannels(channelsRes.data || [])
      setProductGroups(groupsRes.data || [])
      setSuppliers(suppliersRes.data || [])

      if (params.id !== 'new') {
        const { data: prod, error } = await supabase.from('products').select('*').eq('id', params.id).single()
        if (error) throw error
        
        setProduct({
          ...prod,
          supplier_list_price: prod.supplier_list_price || '',
          supplier_discount_percentage: prod.supplier_discount_percentage || '',
          price_multiplier: prod.price_multiplier || '1.80',
          dealer_list_price: prod.dealer_list_price || '',
          market_data: prod.market_data || {},
          
          // Null check
          description: prod.description || '',
          image_url: prod.image_url || '',
          supplier_id: prod.supplier_id || '',
          product_group_id: prod.product_group_id || ''
        })

        const { data: sales } = await supabase.from('sale_items').select('quantity, total_price, created_at').eq('product_id', params.id)
        if (sales && sales.length > 0) {
          const tSold = sales.reduce((a, c) => a + Number(c.quantity), 0)
          const tRev = sales.reduce((a, c) => a + Number(c.total_price), 0)
          const lDate = sales[sales.length - 1].created_at
          setStats({ totalSold: tSold, totalRevenue: tRev, lastSaleDate: lDate })
        }
      } else {
        setLoading(false)
      }
    } catch (err) {
      console.error(err)
      alert('Veri yüklenirken hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      const dbPayload = {
        name: product.name,
        product_code: product.product_code,
        description: product.description,
        image_url: product.image_url,
        unit: product.unit,
        currency: product.currency,
        is_active: product.is_active,
        is_published: product.is_published,
        
        // Tab 2'den gelen veriler
        supplier_id: product.supplier_id || null,
        product_group_id: product.product_group_id || null,
        supplier_list_price: product.supplier_list_price || 0,
        supplier_discount_percentage: product.supplier_discount_percentage || 0,
        price_multiplier: product.price_multiplier || 1.8,
        dealer_list_price: product.dealer_list_price || 0,

        tax_rate: product.tax_rate,
        desi: product.desi,
        stock_quantity: product.stock_quantity,
        safety_stock: product.safety_stock,
        market_data: product.market_data,
        
        company_id: profile.company_id,
        updated_at: new Date()
      }
      
      if (params.id === 'new') {
         const { error } = await supabase.from('products').insert([dbPayload])
         if (error) throw error
      } else {
         const { error } = await supabase.from('products').update(dbPayload).eq('id', params.id)
         if (error) throw error
      }
      
      alert('Ürün başarıyla kaydedildi.')
      router.refresh()
      if (params.id === 'new') router.push('/products')

    } catch (err) {
      console.error(err)
      alert('Kayıt Hatası: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€' }
  const symbol = currencySymbols[product.currency] || '₺'

  if (loading) return <DashboardLayout><div className="flex h-screen items-center justify-center">Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto min-h-screen pb-20">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft className="w-6 h-6"/></button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{params.id === 'new' ? 'Yeni Ürün Oluştur' : product.name}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="font-mono bg-gray-100 px-1 rounded">{product.product_code || 'KOD YOK'}</span>
                {simulation.netCost > 0 && <span className="text-green-600 font-medium px-2 bg-green-50 rounded">Net Maliyet: {symbol}{simulation.netCost.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>}
              </div>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} 
            Kaydet
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          {[
            { id: 'general', label: '1. Ürün Kimliği & Genel', icon: Box },
            { id: 'b2b', label: '2. B2B Fiyatlandırma', icon: Briefcase },
            { id: 'ecommerce', label: '3. E-Ticaret & Pazaryeri', icon: Globe },
            ...(params.id !== 'new' ? [{ id: 'analytics', label: '4. Satış İstatistikleri', icon: BarChart2 }] : [])
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)} 
              className={`px-5 py-3 border-b-2 font-medium text-sm flex gap-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4"/> {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: GENEL (SADELEŞTİRİLDİ) */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in">
            <div className="lg:col-span-8 space-y-6">
              <div className="card space-y-4">
                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><FileText className="w-4 h-4"/> Temel Bilgiler</h3>
                <div><label className="label-text">Ürün Adı</label><input type="text" className="input-field" value={product.name} onChange={(e) => setProduct({...product, name: e.target.value})}/></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="label-text">Ürün Kodu (SKU)</label><input type="text" className="input-field font-mono" value={product.product_code} onChange={(e) => setProduct({...product, product_code: e.target.value})}/></div>
                  <div><label className="label-text">Birim</label><select className="input-field" value={product.unit} onChange={(e) => setProduct({...product, unit: e.target.value})}><option>Adet</option><option>Metre</option><option>Kg</option><option>Takım</option></select></div>
                </div>
                <div><label className="label-text">Ürün Açıklaması</label><textarea rows={4} className="input-field" value={product.description || ''} onChange={(e) => setProduct({...product, description: e.target.value})}></textarea></div>
              </div>

              <div className="card space-y-4">
                 <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Truck className="w-4 h-4"/> Lojistik & Stok</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="label-text">Stok Adedi</label><input type="number" className="input-field font-bold" value={product.stock_quantity} onChange={(e) => setProduct({...product, stock_quantity: Number(e.target.value)})}/></div>
                    <div><label className="label-text">Kritik Stok</label><input type="number" className="input-field" value={product.safety_stock} onChange={(e) => setProduct({...product, safety_stock: Number(e.target.value)})}/></div>
                    <div><label className="label-text">Desi / Hacim</label><input type="number" className="input-field" value={product.desi} onChange={(e) => setProduct({...product, desi: Number(e.target.value)})}/></div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="label-text">KDV Oranı (%)</label><select className="input-field" value={product.tax_rate} onChange={(e) => setProduct({...product, tax_rate: Number(e.target.value)})}>
                         <option value="0">%0</option><option value="1">%1</option><option value="10">%10</option><option value="20">%20</option></select></div>
                    <div><label className="label-text">Para Birimi</label><select className="input-field" value={product.currency} onChange={(e) => setProduct({...product, currency: e.target.value})}><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div>
                 </div>
              </div>
            </div>
            <div className="lg:col-span-4 space-y-6">
               <div className="card space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Ürün Görseli</h3>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
                     {product.image_url ? (
                        <div className="relative group"><img src={product.image_url} alt="Ürün" className="w-full h-48 object-contain rounded"/></div>
                     ) : (
                        <div className="py-8 text-gray-400"><ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50"/><p className="text-sm">Görsel URL giriniz</p></div>
                     )}
                  </div>
                  <div><label className="label-text">Görsel Bağlantısı (URL)</label><input type="text" className="input-field text-xs" value={product.image_url || ''} onChange={(e) => setProduct({...product, image_url: e.target.value})}/></div>
               </div>

               {/* DURUM & YAYINLAMA */}
               <div className="card space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Layers className="w-4 h-4"/> Durum</h3>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                     <span className="text-sm font-medium">Satış Durumu</span>
                     <div className="flex items-center gap-2"><span className={`text-xs font-bold ${product.is_active ? 'text-green-600' : 'text-gray-400'}`}>{product.is_active ? 'AKTİF' : 'PASİF'}</span><input type="checkbox" checked={product.is_active} onChange={(e) => setProduct({...product, is_active: e.target.checked})} className="toggle toggle-sm"/></div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                     <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-gray-500"/><span className="text-sm font-medium">Katalogda Yayınla</span></div>
                     <div className="flex items-center gap-2"><span className={`text-xs font-bold ${product.is_published ? 'text-blue-600' : 'text-gray-400'}`}>{product.is_published ? 'YAYINDA' : 'GİZLİ'}</span><input type="checkbox" checked={product.is_published} onChange={(e) => setProduct({...product, is_published: e.target.checked})} className="toggle toggle-sm toggle-info"/></div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* TAB 2: B2B FİYATLANDIRMA & TEDARİK */}
        {activeTab === 'b2b' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
             
             {/* SOL KOLON: Form Giriş Alanları */}
             <div className="card space-y-6 border-blue-100 bg-blue-50/30">
                <div className="flex items-center gap-3 border-b border-blue-200 pb-3">
                   <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Briefcase className="w-6 h-6"/></div>
                   <div><h3 className="font-bold text-blue-900">Tedarik & Fiyatlandırma</h3><p className="text-xs text-blue-700">Tedarikçi bilgileri ve maliyet yapısı.</p></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                     <label className="label-text">Ana Tedarikçi</label>
                     <select className="input-field" value={product.supplier_id} onChange={(e) => setProduct({...product, supplier_id: e.target.value})}>
                       <option value="">Seçiniz...</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  </div>
                  <div className="col-span-2">
                     <label className="label-text">Ürün Grubu</label>
                     <select className="input-field" value={product.product_group_id} onChange={(e) => setProduct({...product, product_group_id: e.target.value})}>
                       <option value="">Seçiniz...</option>{productGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-100">
                  <div className="col-span-2 md:col-span-1">
                    <label className="label-text text-blue-800">Tedarikçi Liste Fiyatı</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        className="input-field font-medium" 
                        value={product.supplier_list_price} 
                        onChange={(e) => handlePriceInputsChange('supplier_list_price', e.target.value)}
                        placeholder="0.00"
                      />
                      <span className="absolute right-3 top-2 text-gray-400">{symbol}</span>
                    </div>
                  </div>
                  
                  <div className="col-span-2 md:col-span-1">
                    <label className="label-text text-blue-800">İskonto Oranı (%)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        className="input-field" 
                        value={product.supplier_discount_percentage} 
                        onChange={(e) => handlePriceInputsChange('supplier_discount_percentage', e.target.value)}
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-2 text-gray-400">%</span>
                    </div>
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="label-text text-blue-800">Fiyat Çarpanı</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="input-field" 
                      value={product.price_multiplier} 
                      onChange={(e) => handlePriceInputsChange('price_multiplier', e.target.value)}
                      placeholder="1.80"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Sadece net alışlarda kullanılır.</p>
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="label-text text-green-700">Bayi / Katalog Fiyatı</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        className="input-field font-bold text-green-700 border-green-300 focus:ring-green-200" 
                        value={product.dealer_list_price} 
                        onChange={(e) => setProduct({...product, dealer_list_price: e.target.value})}
                        placeholder="0.00"
                      />
                      <span className="absolute right-3 top-2 text-gray-400">{symbol}</span>
                    </div>
                  </div>
                </div>
             </div>

             {/* SAĞ KOLON: KÂR SİMÜLASYONU (GÖRSEL AYNEN AKTARILDI) */}
             <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-4">
                    <Calculator className="w-5 h-5"/> Kar Simülasyonu
                  </h3>

                  <div className="space-y-4">
                    
                    {/* Net Maliyet */}
                    <div className="flex justify-between items-center p-3 bg-white rounded border border-gray-200 shadow-sm">
                      <span className="text-sm font-medium text-gray-600">Net Alış Maliyeti</span>
                      <span className="font-bold text-gray-900">{symbol}{simulation.netCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="flex justify-center text-gray-400"><ArrowLeft className="w-5 h-5 rotate-[-90deg]"/></div>

                    {/* Satış Fiyatı */}
                    <div className="flex justify-between items-center p-3 bg-white rounded border border-green-200 shadow-sm ring-1 ring-green-50">
                      <span className="text-sm font-medium text-green-700">Bayi Satış Fiyatı</span>
                      <span className="font-bold text-green-700 text-lg">{symbol}{parseFloat(product.dealer_list_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>

                    {/* Kar Marjı Sonuçları */}
                    <div className={`p-4 rounded-lg border-l-4 mt-4 ${simulation.margin < 10 ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600">Tahmini Kar:</span>
                        <span className="font-medium text-gray-900">{symbol}{simulation.profit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Kar Marjı:</span>
                        <span className={`font-bold ${simulation.margin < 10 ? 'text-red-600' : 'text-green-600'}`}>
                          %{simulation.margin.toFixed(1)}
                        </span>
                      </div>
                      {simulation.margin < 10 && simulation.margin > 0 && (
                        <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3"/> Kar marjı düşük!
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-800 border border-blue-100 flex gap-2">
                   <AlertCircle className="w-5 h-5 flex-shrink-0"/>
                   <div>
                     <p className="font-bold mb-1">Nasıl Çalışır?</p>
                     <p className="mb-1">• <b>İskontolu Ürün:</b> Eğer iskonto girerseniz, bayi fiyatı otomatik olarak tedarikçi liste fiyatına eşitlenir. Sizin karınız iskonto farkıdır.</p>
                     <p>• <b>Net Fiyatlı Ürün:</b> Eğer iskonto 0 ise, bayi fiyatı <b>Net Maliyet x Çarpan</b> formülüyle hesaplanır.</p>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* TAB 3: E-TİCARET */}
        {activeTab === 'ecommerce' && (
          <div className="space-y-6 animate-in fade-in">
             {channels.length === 0 && (
               <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 flex items-center gap-3 text-yellow-800">
                 <AlertCircle className="w-5 h-5"/>
                 <p>Henüz satış kanalı tanımlanmamış. Ayarlar menüsünden kanal ekleyiniz.</p>
               </div>
             )}
             <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex gap-3 text-sm text-orange-900 mb-4">
                <Globe className="w-5 h-5 flex-shrink-0 mt-1"/>
                <div><p className="font-bold">Bağımsız E-Ticaret Fiyatlaması</p><p className="opacity-80">Net Maliyet ({symbol}{simulation.netCost.toLocaleString('tr-TR', {maximumFractionDigits:2})}) + Kargo + Komisyon + KDV.</p></div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {channels.map(channel => {
                  const data = product.market_data?.[channel.id] || {}
                  const isActive = data.active === true
                  const suggestedPrice = calculateChannelPrice(channel)
                  return (
                    <div key={channel.id} className={`bg-white rounded-xl border shadow-sm transition-all relative overflow-hidden group ${isActive ? 'border-orange-400 ring-2 ring-orange-50' : 'border-gray-200 opacity-80'}`}>
                       <div className="bg-gray-50 p-3 border-b border-gray-100 flex justify-between items-center group-hover:bg-orange-50/30">
                          <div className="flex items-center gap-2"><Tag className={`w-4 h-4 ${isActive ? 'text-orange-500' : 'text-gray-400'}`}/><span className="font-bold text-gray-800">{channel.name}</span></div>
                          <input type="checkbox" className="toggle toggle-sm toggle-success" checked={isActive} onChange={(e) => updateMarketData(channel.id, 'active', e.target.checked)}/>
                       </div>
                       <div className="p-4 space-y-4">
                          <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-2 rounded border border-gray-100">
                             <div className="flex justify-between"><span>Maliyet + Kargo:</span> <span className="font-mono">{symbol}{(simulation.netCost + channel.cargo_base_fee + (product.desi * channel.cargo_desi_multiplier)).toFixed(2)}</span></div>
                             <div className="flex justify-between text-green-600"><span>Hedef Kâr (%{channel.profit_margin}):</span> <span>Dahil</span></div>
                             <div className="flex justify-between text-red-500"><span>Komisyon (%{channel.commission_rate}):</span> <span>Dahil</span></div>
                          </div>
                          <div>
                             <div className="flex justify-between items-end mb-1"><label className="text-xs font-bold text-gray-700 uppercase">Satış Fiyatı</label><button onClick={() => applyAutoPrice(channel)} className="text-[10px] bg-orange-50 text-orange-600 px-2 py-1 rounded hover:bg-orange-100 flex items-center gap-1 border border-orange-100"><Calculator className="w-3 h-3"/> Hesapla ({symbol}{suggestedPrice})</button></div>
                             <div className="relative"><input type="number" className={`w-full border rounded-lg py-2 pl-3 pr-8 font-bold text-lg outline-none focus:ring-2 ${isActive ? 'border-gray-300 focus:ring-orange-500 text-gray-900' : 'bg-gray-50 text-gray-400 border-gray-200'}`} value={data.price || ''} disabled={!isActive} onChange={(e) => updateMarketData(channel.id, 'price', parseFloat(e.target.value))}/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{symbol}</span></div>
                          </div>
                       </div>
                    </div>
                  )
                })}
             </div>
          </div>
        )}

        {/* TAB 4: İSTATİSTİKLER */}
        {activeTab === 'analytics' && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
                 <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3"><Box className="w-6 h-6"/></div>
                 <h3 className="text-gray-500 text-sm font-bold uppercase">Toplam Satış</h3>
                 <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalSold}</p>
                 <p className="text-xs text-gray-400 mt-1">{product.unit}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
                 <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-3"><TrendingUp className="w-6 h-6"/></div>
                 <h3 className="text-gray-500 text-sm font-bold uppercase">Toplam Ciro</h3>
                 <p className="text-3xl font-bold text-gray-900 mt-2">{symbol}{stats.totalRevenue.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
                 <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-3"><RefreshCw className="w-6 h-6"/></div>
                 <h3 className="text-gray-500 text-sm font-bold uppercase">Son Hareket</h3>
                 <p className="text-xl font-bold text-gray-900 mt-2">{stats.lastSaleDate ? new Date(stats.lastSaleDate).toLocaleDateString('tr-TR') : '-'}</p>
              </div>
           </div>
        )}
      </div>
      <style jsx>{`.label-text { @apply block text-xs font-bold text-gray-500 uppercase mb-1; }`}</style>
    </DashboardLayout>
  )
}
