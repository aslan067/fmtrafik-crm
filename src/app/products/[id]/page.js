'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  ArrowLeft, Save, Box, BarChart2, Globe, 
  RefreshCw, Calculator, Truck, Briefcase, 
  Tag, AlertCircle, TrendingUp, DollarSign, Percent,
  Image as ImageIcon, Layers, FileText
} from 'lucide-react'

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general') 
  
  // İlişkisel Veriler (Dropdownlar için)
  const [channels, setChannels] = useState([]) 
  const [productGroups, setProductGroups] = useState([])
  const [suppliers, setSuppliers] = useState([])
  
  // Ana Ürün State'i
  const [product, setProduct] = useState({
    // --- 1. GENEL & KİMLİK ---
    name: '',
    product_code: '',
    description: '',
    image_url: '',
    unit: 'Adet',
    currency: 'TRY',
    is_active: true,
    
    // İlişkiler
    supplier_id: '',
    product_group_id: '',

    // Lojistik & Vergi (Global)
    tax_rate: 20,
    desi: 1,
    stock_quantity: 0,
    safety_stock: 5,

    // --- 2. B2B FİYATLAMA ---
    supplier_list_price: 0,        // Tedarikçi Liste
    supplier_discount_percentage: 0, // İskonto %
    net_cost: 0,                   // Net Maliyet (Otomatik hesaplanır)
    price_multiplier: 1.8,         // Çarpan
    list_price: 0,                 // Bayi Satış Fiyatı (dealer_list_price)

    // --- 3. E-TİCARET ---
    market_data: {} 
  })

  // İstatistikler
  const [stats, setStats] = useState({ totalSold: 0, totalRevenue: 0, lastSaleDate: null })

  useEffect(() => {
    loadInitialData()
  }, [params.id])

  // --- HESAPLAMA MOTORU (Net Maliyet) ---
  // Tedarikçi fiyatı veya iskonto değişince Net Maliyeti güncelle
  useEffect(() => {
    const sListPrice = parseFloat(product.supplier_list_price) || 0
    const sDiscount = parseFloat(product.supplier_discount_percentage) || 0
    
    const valNetCost = sListPrice * (1 - (sDiscount / 100))
    
    if (valNetCost !== product.net_cost) {
      setProduct(prev => ({ ...prev, net_cost: Number(valNetCost.toFixed(2)) }))
    }
  }, [product.supplier_list_price, product.supplier_discount_percentage])

  // --- HESAPLAMA MOTORU (B2B Satış Fiyatı) ---
  // Butona basınca çalışır (Otomatik çalıştırırsak manuel düzeltmeleri ezeriz)
  const calculateB2BPrice = () => {
    const cost = parseFloat(product.net_cost) || 0
    const mult = parseFloat(product.price_multiplier) || 1
    const suggestedPrice = cost * mult
    setProduct(prev => ({ ...prev, list_price: Number(suggestedPrice.toFixed(2)) }))
  }

  // --- HESAPLAMA MOTORU (E-Ticaret) ---
  const calculateChannelPrice = (channel) => {
    const cost = parseFloat(product.net_cost) || 0
    const desi = parseFloat(product.desi) || 1
    const vatRate = parseFloat(product.tax_rate) || 20
    
    const commission = parseFloat(channel.commission_rate) || 0
    const profitMargin = parseFloat(channel.profit_margin) || 20
    const baseCargo = parseFloat(channel.cargo_base_fee) || 0
    const desiMulti = parseFloat(channel.cargo_desi_multiplier) || 0

    // Kargo Maliyeti
    const cargoCost = baseCargo + (desi * desiMulti)
    // Toplam Ham Maliyet
    const totalCost = cost + cargoCost
    // Satış Fiyatı Formülü: (Maliyet * (1+Kar)) / (1 - Komisyon - KDV_Etkisi)
    // Basitleştirilmiş Güvenli Marj Formülü:
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

      // Paralel Veri Çekme (Dropdownlar)
      const [channelsRes, groupsRes, suppliersRes] = await Promise.all([
        supabase.from('sales_channels').select('*').eq('company_id', profile.company_id),
        supabase.from('product_groups').select('id, name').eq('company_id', profile.company_id),
        supabase.from('suppliers').select('id, name').eq('company_id', profile.company_id)
      ])

      setChannels(channelsRes.data || [])
      setProductGroups(groupsRes.data || [])
      setSuppliers(suppliersRes.data || [])

      // Ürün Verisi Çekme
      if (params.id !== 'new') {
        const { data: prod, error } = await supabase.from('products').select('*').eq('id', params.id).single()
        if (error) throw error
        
        // Veritabanı verisini state'e eşle
        // net_cost'u veritabanında tutmuyorsak anlık hesapla
        const sList = prod.supplier_list_price || 0
        const sDisc = prod.supplier_discount_percentage || 0
        const calcNet = sList * (1 - sDisc / 100)

        setProduct({
          ...prod,
          net_cost: calcNet,
          market_data: prod.market_data || {}
        })

        // İstatistikleri Çek
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

      // net_cost state içinde hesaplanan bir değer, veritabanına yazmıyorsak ayıralım
      const { net_cost, ...dbPayload } = product
      
      const payload = { ...dbPayload, company_id: profile.company_id, updated_at: new Date() }
      const { id, ...saveData } = payload

      if (params.id === 'new') {
         await supabase.from('products').insert([saveData])
      } else {
         await supabase.from('products').update(saveData).eq('id', params.id)
      }
      alert('Ürün başarıyla kaydedildi.')
      if (params.id === 'new') router.push('/products')
    } catch (err) {
      alert('Kayıt Hatası: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€' }
  const symbol = currencySymbols[product.currency] || '₺'

  // B2B Kar Marjı Gösterimi
  const b2bProfit = (product.list_price - product.net_cost)
  const b2bMargin = product.list_price > 0 ? (b2bProfit / product.list_price) * 100 : 0

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
                {product.net_cost > 0 && <span className="text-green-600 font-medium px-2 bg-green-50 rounded">Net Maliyet: {symbol}{product.net_cost}</span>}
              </div>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} 
            {params.id === 'new' ? 'Ürünü Oluştur' : 'Değişiklikleri Kaydet'}
          </button>
        </div>

        {/* --- 4 SEKMELİ NAVİGASYON --- */}
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

        {/* ================= TAB 1: ÜRÜN KİMLİĞİ & GENEL ================= */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in">
            
            {/* SOL KOLON (8/12): Temel Bilgiler */}
            <div className="lg:col-span-8 space-y-6">
              <div className="card space-y-4">
                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><FileText className="w-4 h-4"/> Temel Bilgiler</h3>
                
                <div>
                  <label className="label-text">Ürün Adı</label>
                  <input type="text" className="input-field" placeholder="Örn: 75cm Duba" value={product.name} onChange={(e) => setProduct({...product, name: e.target.value})}/>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Ürün Kodu (SKU)</label>
                    <input type="text" className="input-field font-mono" placeholder="TF-001" value={product.product_code} onChange={(e) => setProduct({...product, product_code: e.target.value})}/>
                  </div>
                  <div>
                     <label className="label-text">Ürün Grubu / Kategori</label>
                     <select className="input-field" value={product.product_group_id} onChange={(e) => setProduct({...product, product_group_id: e.target.value})}>
                       <option value="">Seçiniz...</option>
                       {productGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                     </select>
                  </div>
                </div>

                <div>
                   <label className="label-text">Ürün Açıklaması</label>
                   <textarea rows={4} className="input-field" placeholder="Teknik özellikler..." value={product.description || ''} onChange={(e) => setProduct({...product, description: e.target.value})}></textarea>
                </div>
              </div>

              {/* Lojistik ve Stok */}
              <div className="card space-y-4">
                 <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Truck className="w-4 h-4"/> Lojistik & Stok</h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label-text">Stok Adedi</label>
                      <input type="number" className="input-field font-bold" value={product.stock_quantity} onChange={(e) => setProduct({...product, stock_quantity: Number(e.target.value)})}/>
                    </div>
                    <div>
                      <label className="label-text">Kritik Stok (Uyarı)</label>
                      <input type="number" className="input-field" value={product.safety_stock} onChange={(e) => setProduct({...product, safety_stock: Number(e.target.value)})}/>
                    </div>
                    <div>
                       <label className="label-text">Desi / Hacim</label>
                       <input type="number" className="input-field" value={product.desi} onChange={(e) => setProduct({...product, desi: Number(e.target.value)})}/>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                       <label className="label-text">KDV Oranı (%)</label>
                       <select className="input-field" value={product.tax_rate} onChange={(e) => setProduct({...product, tax_rate: Number(e.target.value)})}>
                         <option value="0">%0</option><option value="1">%1</option><option value="10">%10</option><option value="20">%20</option>
                       </select>
                    </div>
                    <div>
                       <label className="label-text">Birim</label>
                       <select className="input-field" value={product.unit} onChange={(e) => setProduct({...product, unit: e.target.value})}>
                         <option>Adet</option><option>Metre</option><option>Kg</option><option>Takım</option><option>Koli</option>
                       </select>
                    </div>
                    <div>
                       <label className="label-text">Para Birimi</label>
                       <select className="input-field" value={product.currency} onChange={(e) => setProduct({...product, currency: e.target.value})}>
                         <option value="TRY">TRY (₺)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option>
                       </select>
                    </div>
                 </div>
              </div>
            </div>

            {/* SAĞ KOLON (4/12): Tedarikçi ve Görsel */}
            <div className="lg:col-span-4 space-y-6">
               <div className="card space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Ürün Görseli</h3>
                  
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
                     {product.image_url ? (
                        <div className="relative group">
                          <img src={product.image_url} alt="Ürün" className="w-full h-48 object-contain rounded"/>
                          <button 
                             onClick={() => setProduct({...product, image_url: ''})}
                             className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                             <Trash2 className="w-4 h-4" /> // Lucide import lazım değilse X
                          </button>
                        </div>
                     ) : (
                        <div className="py-8 text-gray-400">
                           <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50"/>
                           <p className="text-sm">Görsel URL giriniz</p>
                        </div>
                     )}
                  </div>
                  
                  <div>
                    <label className="label-text">Görsel Bağlantısı (URL)</label>
                    <input type="text" className="input-field text-xs" placeholder="https://..." value={product.image_url || ''} onChange={(e) => setProduct({...product, image_url: e.target.value})}/>
                  </div>
               </div>

               <div className="card space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Layers className="w-4 h-4"/> Tedarikçi & Durum</h3>
                  <div>
                     <label className="label-text">Ana Tedarikçi</label>
                     <select className="input-field" value={product.supplier_id} onChange={(e) => setProduct({...product, supplier_id: e.target.value})}>
                       <option value="">Seçiniz...</option>
                       {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                     <span className="text-sm font-medium">Satış Durumu</span>
                     <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${product.is_active ? 'text-green-600' : 'text-gray-400'}`}>{product.is_active ? 'AKTİF' : 'PASİF'}</span>
                        <input type="checkbox" checked={product.is_active} onChange={(e) => setProduct({...product, is_active: e.target.checked})} className="toggle toggle-sm"/>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: B2B FİYATLANDIRMA ================= */}
        {activeTab === 'b2b' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
             <div className="card bg-blue-50/50 border-blue-100 space-y-6">
                <div className="flex items-center gap-3 border-b border-blue-200 pb-3">
                   <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><DollarSign className="w-6 h-6"/></div>
                   <div>
                      <h3 className="font-bold text-blue-900">1. Maliyet Analizi</h3>
                      <p className="text-xs text-blue-700">Tedarikçiden alış maliyetini belirleyin.</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text text-blue-800">Tedarikçi Liste Fiyatı</label>
                    <div className="relative"><input type="number" className="input-field" value={product.supplier_list_price} onChange={(e) => setProduct({...product, supplier_list_price: e.target.value})}/><span className="absolute right-3 top-2 text-gray-400">{symbol}</span></div>
                  </div>
                  <div>
                    <label className="label-text text-blue-800">İskonto Oranı (%)</label>
                    <div className="relative"><input type="number" className="input-field" value={product.supplier_discount_percentage} onChange={(e) => setProduct({...product, supplier_discount_percentage: e.target.value})}/><span className="absolute right-3 top-2 text-gray-400">%</span></div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200 flex justify-between items-center shadow-sm">
                  <div>
                    <span className="block text-xs font-bold text-gray-500 uppercase">NET MALİYET</span>
                    <span className="text-[10px] text-gray-400">(İskonto düşülmüş)</span>
                  </div>
                  <span className="font-bold text-3xl text-blue-700">{symbol}{product.net_cost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                </div>
             </div>

             <div className="card bg-green-50/50 border-green-100 space-y-6">
                <div className="flex items-center gap-3 border-b border-green-200 pb-3">
                   <div className="p-2 bg-green-100 text-green-600 rounded-lg"><Calculator className="w-6 h-6"/></div>
                   <div>
                      <h3 className="font-bold text-green-900">2. Bayi & Toptan Fiyatı</h3>
                      <p className="text-xs text-green-700">Tekliflerde ve bayilerde kullanılacak baz fiyat.</p>
                   </div>
                </div>

                <div className="flex items-end gap-4">
                   <div className="flex-1">
                      <label className="label-text text-green-800">Fiyat Çarpanı</label>
                      <input type="number" step="0.1" className="input-field font-bold text-green-700" value={product.price_multiplier} onChange={(e) => setProduct({...product, price_multiplier: e.target.value})}/>
                      <p className="text-[10px] text-gray-500 mt-1">Örn: 1.8 (Maliyet x 1.8)</p>
                   </div>
                   <button onClick={calculateB2BPrice} className="btn-secondary h-[42px] mb-[2px] bg-white border-green-200 text-green-700 hover:bg-green-100">
                     Hesapla
                   </button>
                </div>

                <div className="relative">
                   <label className="label-text text-green-900">B2B Satış Fiyatı (KDV Hariç)</label>
                   <input type="number" className="w-full border-2 border-green-400 rounded-lg py-3 pl-4 pr-12 text-2xl font-bold text-green-700 outline-none focus:ring-4 focus:ring-green-100 transition-all" value={product.list_price} onChange={(e) => setProduct({...product, list_price: e.target.value})}/>
                   <span className="absolute right-4 top-9 text-green-600 font-bold text-lg">{symbol}</span>
                </div>

                {/* Kar Marjı Göstergesi */}
                <div className={`p-3 rounded border flex justify-between items-center ${b2bMargin < 15 ? 'bg-red-100 border-red-200 text-red-700' : 'bg-green-100 border-green-200 text-green-700'}`}>
                   <span className="text-xs font-bold uppercase">B2B Kar Marjı</span>
                   <span className="font-bold flex items-center gap-1">
                     %{b2bMargin.toFixed(1)}
                     {b2bMargin < 15 && <AlertCircle className="w-4 h-4"/>}
                   </span>
                </div>
             </div>
          </div>
        )}

        {/* ================= TAB 3: E-TİCARET & PAZARYERİ ================= */}
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
                <div>
                  <p className="font-bold">Bağımsız E-Ticaret Fiyatlaması</p>
                  <p className="opacity-80">Bu bölüm, B2B fiyatından bağımsız çalışır. <b>Net Maliyet ({symbol}{product.net_cost})</b> üzerine pazaryeri komisyonu, kargo ve KDV ekleyerek hesaplama yapar.</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {channels.map(channel => {
                  const data = product.market_data?.[channel.id] || {}
                  const isActive = data.active === true
                  const suggestedPrice = calculateChannelPrice(channel)
                  
                  return (
                    <div key={channel.id} className={`bg-white rounded-xl border shadow-sm transition-all overflow-hidden group ${isActive ? 'border-orange-400 ring-2 ring-orange-50' : 'border-gray-200 opacity-80'}`}>
                       <div className="bg-gray-50 p-3 border-b border-gray-100 flex justify-between items-center group-hover:bg-orange-50/30">
                          <div className="flex items-center gap-2">
                            <Tag className={`w-4 h-4 ${isActive ? 'text-orange-500' : 'text-gray-400'}`}/>
                            <span className="font-bold text-gray-800">{channel.name}</span>
                          </div>
                          <input type="checkbox" className="toggle toggle-sm toggle-success" checked={isActive} onChange={(e) => updateMarketData(channel.id, 'active', e.target.checked)}/>
                       </div>

                       <div className="p-4 space-y-4">
                          <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-2 rounded border border-gray-100">
                             <div className="flex justify-between"><span>Maliyet + Kargo:</span> <span className="font-mono">{symbol}{(product.net_cost + channel.cargo_base_fee + (product.desi * channel.cargo_desi_multiplier)).toFixed(2)}</span></div>
                             <div className="flex justify-between text-green-600"><span>Hedef Kâr (%{channel.profit_margin}):</span> <span>Dahil</span></div>
                             <div className="flex justify-between text-red-500"><span>Komisyon (%{channel.commission_rate}):</span> <span>Dahil</span></div>
                          </div>

                          <div>
                             <div className="flex justify-between items-end mb-1">
                                <label className="text-xs font-bold text-gray-700 uppercase">Satış Fiyatı</label>
                                <button onClick={() => applyAutoPrice(channel)} className="text-[10px] bg-orange-50 text-orange-600 px-2 py-1 rounded hover:bg-orange-100 border border-orange-100 flex items-center gap-1">
                                  <Calculator className="w-3 h-3"/> Hesapla ({symbol}{suggestedPrice})
                                </button>
                             </div>
                             <div className="relative">
                               <input 
                                 type="number" 
                                 className={`w-full border rounded-lg py-2 pl-3 pr-8 font-bold text-lg outline-none focus:ring-2 ${isActive ? 'border-gray-300 focus:ring-orange-500 text-gray-900' : 'bg-gray-50 text-gray-400'}`}
                                 value={data.price || ''}
                                 disabled={!isActive}
                                 onChange={(e) => updateMarketData(channel.id, 'price', parseFloat(e.target.value))}
                               />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{symbol}</span>
                             </div>
                          </div>
                       </div>
                    </div>
                  )
                })}
             </div>
          </div>
        )}

        {/* ================= TAB 4: İSTATİSTİKLER ================= */}
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
                 <p className="text-xs text-gray-400 mt-1">{stats.lastSaleDate ? 'Satış yapıldı' : 'Hareket yok'}</p>
              </div>
           </div>
        )}

      </div>
      <style jsx>{`.label-text { @apply block text-xs font-bold text-gray-500 uppercase mb-1; }`}</style>
    </DashboardLayout>
  )
}
