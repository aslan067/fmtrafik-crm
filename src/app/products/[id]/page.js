'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  ArrowLeft, Save, Box, BarChart2, Globe, 
  RefreshCw, Calculator, Truck, Briefcase, 
  Tag, AlertCircle, TrendingUp, DollarSign, Percent
} from 'lucide-react'

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general') 
  
  // Veriler
  const [channels, setChannels] = useState([]) 
  const [productGroups, setProductGroups] = useState([])
  const [suppliers, setSuppliers] = useState([])
  
  // Ürün State'i (Paylaşılan koddaki yapıya uygun)
  const [product, setProduct] = useState({
    name: '',
    product_code: '',
    description: '',
    supplier_id: '',
    product_group_id: '',
    unit: 'Adet',
    currency: 'TRY',
    
    // --- B2B Fiyatlama ---
    supplier_list_price: 0,        // Tedarikçi Liste
    supplier_discount_percentage: 0, // İskonto %
    price_multiplier: 1.8,         // Çarpan (Örn: 1.8)
    list_price: 0,                 // Bizim Bayi/Liste Fiyatımız (dealer_list_price)
    
    // --- Hesaplanan Değerler (State'de tutulup UI'da gösterilir) ---
    net_cost: 0,                   // İskonto düşülmüş maliyet
    
    // --- Lojistik ---
    tax_rate: 20,
    desi: 1,
    
    // --- Stok ---
    stock_quantity: 0,
    safety_stock: 5,
    
    // --- Marketler ---
    market_data: {} 
  })

  // İstatistikler
  const [stats, setStats] = useState({ totalSold: 0, totalRevenue: 0, lastSaleDate: null })

  useEffect(() => {
    loadInitialData()
  }, [params.id])

  // --- HESAPLAMA MOTORU (B2B) ---
  // Paylaşılan koddaki 'calculatePricing' mantığı
  useEffect(() => {
    const sListPrice = parseFloat(product.supplier_list_price) || 0
    const sDiscount = parseFloat(product.supplier_discount_percentage) || 0
    
    // 1. Net Maliyeti Hesapla
    const valNetCost = sListPrice * (1 - (sDiscount / 100))
    
    // State'i güncelle (Net maliyet değişti)
    if (valNetCost !== product.net_cost) {
      setProduct(prev => ({ ...prev, net_cost: Number(valNetCost.toFixed(2)) }))
    }

    // Not: Liste fiyatını (list_price) burada otomatik ezmiyoruz. 
    // Kullanıcı çarpana göre manuel tetiklesin veya aşağıda multiplier değişince hesaplasın.
  }, [product.supplier_list_price, product.supplier_discount_percentage])

  // Çarpan değişirse önerilen fiyatı hesaplayabiliriz (Opsiyonel, manuel butona da bağlayabiliriz)
  const applyMultiplier = () => {
    const cost = parseFloat(product.net_cost) || 0
    const mult = parseFloat(product.price_multiplier) || 1
    const suggestedPrice = cost * mult
    setProduct(prev => ({ ...prev, list_price: Number(suggestedPrice.toFixed(2)) }))
  }

  async function loadInitialData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // Paralel Veri Çekme
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
        
        // Veritabanından gelen veriyi state formatına uydur
        // Eğer veritabanında 'net_cost' yoksa hesapla
        const sList = prod.supplier_list_price || 0
        const sDisc = prod.supplier_discount_percentage || 0
        const calculatedNetCost = sList * (1 - sDisc / 100)

        setProduct({
          ...prod,
          net_cost: calculatedNetCost,
          market_data: prod.market_data || {} // HATA DÜZELTME: null gelirse boş obje yap
        })

        // İstatistikleri Çek
        fetchStats(params.id)
      } else {
        setLoading(false)
      }
    } catch (err) {
      console.error(err)
      alert('Veri yükleme hatası')
    } finally {
      setLoading(false)
    }
  }

  async function fetchStats(productId) {
    const { data: sales } = await supabase
      .from('sale_items')
      .select('quantity, total_price, created_at')
      .eq('product_id', productId)
    
    if (sales && sales.length > 0) {
      const totalSold = sales.reduce((acc, curr) => acc + Number(curr.quantity), 0)
      const totalRevenue = sales.reduce((acc, curr) => acc + Number(curr.total_price), 0)
      const lastSale = sales[sales.length - 1].created_at
      setStats({ totalSold, totalRevenue, lastSaleDate: lastSale })
    }
  }

  // --- PAZARYERİ FİYAT HESAPLAMA ---
  const calculateChannelPrice = (channel) => {
    // Baz alınan: B2B'den hesaplanan NET MALİYET
    const cost = parseFloat(product.net_cost) || 0
    const desi = parseFloat(product.desi) || 1
    const vatRate = parseFloat(product.tax_rate) || 20
    
    const commission = parseFloat(channel.commission_rate) || 0
    const profitMargin = parseFloat(channel.profit_margin) || 20
    const baseCargo = parseFloat(channel.cargo_base_fee) || 0
    const desiMulti = parseFloat(channel.cargo_desi_multiplier) || 0

    // Kargo
    const cargoCost = baseCargo + (desi * desiMulti)
    // Toplam Maliyet
    const totalCost = cost + cargoCost
    // Satış Fiyatı Formülü
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

  async function handleSave() {
    setSaving(true)
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // net_cost veritabanında sütun olmayabilir, onu payload'dan çıkaralım (client-side calc)
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

  // UI Yardımcıları (Kar Marjı Gösterimi İçin)
  const currentProfit = (product.list_price - product.net_cost)
  const currentMargin = product.list_price > 0 ? (currentProfit / product.list_price) * 100 : 0
  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€' }

  if (loading) return <DashboardLayout><div className="flex h-screen items-center justify-center">Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto min-h-screen pb-20">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft className="w-6 h-6"/></button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{params.id === 'new' ? 'Yeni Ürün Kartı' : product.name}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="font-mono bg-gray-100 px-1 rounded">{product.product_code}</span>
                {product.net_cost > 0 && <span className="text-green-600 font-medium px-2 bg-green-50 rounded">Net Maliyet: ₺{product.net_cost}</span>}
              </div>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Kaydet
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          <button onClick={() => setActiveTab('general')} className={`px-6 py-3 border-b-2 font-medium text-sm flex gap-2 whitespace-nowrap ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}><Briefcase className="w-4 h-4"/> Genel & B2B Fiyatlama</button>
          <button onClick={() => setActiveTab('markets')} className={`px-6 py-3 border-b-2 font-medium text-sm flex gap-2 whitespace-nowrap ${activeTab === 'markets' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}><Globe className="w-4 h-4"/> E-Ticaret & Pazaryeri</button>
          {params.id !== 'new' && (
            <button onClick={() => setActiveTab('analytics')} className={`px-6 py-3 border-b-2 font-medium text-sm flex gap-2 whitespace-nowrap ${activeTab === 'analytics' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}><BarChart2 className="w-4 h-4"/> Satış İstatistikleri</button>
          )}
        </div>

        {/* --- TAB 1: GENEL & B2B FİYATLAMA (NewProductPage Mantığı) --- */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
            
            {/* SOL: Ürün Bilgileri */}
            <div className="space-y-6">
              <div className="card space-y-4">
                <h3 className="font-bold text-gray-800 border-b pb-2">Ürün Kimliği</h3>
                <div><label className="label-text">Ürün Adı</label><input type="text" className="input-field" value={product.name} onChange={(e) => setProduct({...product, name: e.target.value})}/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label-text">Ürün Kodu (SKU)</label><input type="text" className="input-field font-mono" value={product.product_code} onChange={(e) => setProduct({...product, product_code: e.target.value})}/></div>
                  <div>
                    <label className="label-text">Ürün Grubu</label>
                    <select className="input-field" value={product.product_group_id} onChange={(e) => setProduct({...product, product_group_id: e.target.value})}>
                      <option value="">Seçiniz...</option>
                      {productGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Para Birimi</label>
                    <select className="input-field" value={product.currency} onChange={(e) => setProduct({...product, currency: e.target.value})}>
                      <option value="TRY">TRY (₺)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                  <div><label className="label-text">Stok Adedi</label><input type="number" className="input-field font-bold" value={product.stock_quantity} onChange={(e) => setProduct({...product, stock_quantity: Number(e.target.value)})}/></div>
                </div>
              </div>

              <div className="card space-y-4">
                 <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Truck className="w-4 h-4"/> Lojistik</h3>
                 <div>
                    <label className="label-text">Desi / Hacim</label>
                    <input type="number" className="input-field" value={product.desi} onChange={(e) => setProduct({...product, desi: Number(e.target.value)})}/>
                    <p className="text-[10px] text-gray-400 mt-1">Kargo hesaplaması için kritiktir.</p>
                 </div>
              </div>
            </div>

            {/* SAĞ: B2B Fiyatlandırma Şelalesi */}
            <div className="space-y-6">
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex justify-between items-center">
                  <h3 className="font-bold text-blue-900 flex items-center gap-2"><Calculator className="w-5 h-5"/> B2B Fiyatlandırma</h3>
                  <span className="text-xs bg-white px-2 py-1 rounded text-blue-600 font-bold border border-blue-100">Teklif & Bayi</span>
                </div>
                
                <div className="p-6 space-y-5">
                  
                  {/* 1. Tedarikçi Fiyatı */}
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="label-text flex items-center gap-1"><DollarSign className="w-3 h-3"/> Liste Fiyatı</label>
                       <input type="number" className="input-field" placeholder="0.00" value={product.supplier_list_price} onChange={(e) => setProduct({...product, supplier_list_price: e.target.value})}/>
                     </div>
                     <div>
                        <label className="label-text flex items-center gap-1"><Percent className="w-3 h-3"/> İskonto</label>
                        <input type="number" className="input-field" placeholder="0" value={product.supplier_discount_percentage} onChange={(e) => setProduct({...product, supplier_discount_percentage: e.target.value})}/>
                     </div>
                  </div>

                  {/* 2. Net Maliyet Göstergesi */}
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <span className="text-sm font-bold text-gray-500">NET MALİYET</span>
                    <span className="text-xl font-bold text-gray-900">{currencySymbols[product.currency]}{product.net_cost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* 3. Çarpan ve Satış Fiyatı */}
                  <div className="border-t border-dashed border-gray-300 pt-4">
                     <label className="label-text mb-2 block">Fiyat Çarpanı (Maliyet x Çarpan)</label>
                     <div className="flex gap-4 items-center">
                        <input 
                          type="number" 
                          step="0.1"
                          className="w-24 input-field text-center font-bold text-blue-600" 
                          value={product.price_multiplier} 
                          onChange={(e) => setProduct({...product, price_multiplier: e.target.value})}
                        />
                        <button 
                          type="button" 
                          onClick={applyMultiplier}
                          className="btn-secondary text-xs py-2.5 h-[42px]"
                        >
                          <TrendingUp className="w-4 h-4 mr-1"/> Fiyatı Uygula
                        </button>
                     </div>
                  </div>

                  {/* 4. Sonuç: Liste Satış Fiyatı */}
                  <div>
                    <label className="label-text text-green-700">Bayi / Liste Satış Fiyatı (KDV Hariç)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        className="w-full border-2 border-green-400 rounded-lg py-3 pl-4 pr-10 text-2xl font-bold text-green-700 outline-none focus:ring-4 focus:ring-green-100 transition-all"
                        placeholder="0.00"
                        value={product.list_price}
                        onChange={(e) => setProduct({...product, list_price: e.target.value})}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600 font-bold text-lg">{currencySymbols[product.currency]}</div>
                    </div>
                  </div>

                  {/* 5. Kar/Zarar Analizi (Görsel) */}
                  <div className={`p-4 rounded-lg border flex justify-between items-center ${currentMargin < 15 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase">Tahmini Kar</p>
                      <p className={`text-lg font-bold ${currentMargin < 15 ? 'text-red-700' : 'text-green-700'}`}>
                        {currencySymbols[product.currency]}{currentProfit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 font-bold uppercase">Kar Marjı</p>
                      <div className={`text-xl font-black flex items-center gap-1 ${currentMargin < 15 ? 'text-red-600' : 'text-green-600'}`}>
                        %{currentMargin.toFixed(1)}
                        {currentMargin < 15 && <AlertCircle className="w-5 h-5"/>}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: E-TİCARET & PAZARYERİ --- */}
        {activeTab === 'markets' && (
          <div className="space-y-6 animate-in fade-in">
             
             {channels.length === 0 && (
               <div className="bg-yellow-50 p-4 rounded text-yellow-800 text-sm border border-yellow-200 flex items-center gap-2">
                 <AlertCircle className="w-4 h-4"/>
                 Henüz satış kanalı tanımlanmamış. Ayarlardan kanal ekleyiniz.
               </div>
             )}

             {/* Bilgi Kartı */}
             <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex gap-3 text-sm text-orange-800">
                <Globe className="w-5 h-5 flex-shrink-0 mt-1"/>
                <div>
                  <p className="font-bold">Bağımsız E-Ticaret Fiyatlaması</p>
                  <p>Bu bölüm, <b>Net Maliyet (₺{product.net_cost})</b> üzerine pazaryeri komisyonu, kargo ve KDV ekleyerek hesaplama yapar. B2B fiyatından bağımsızdır.</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {channels && channels.map(channel => {
                  // HATA DÜZELTME: market_data kontrolü
                  const data = product.market_data?.[channel.id] || {}
                  const isActive = data.active === true
                  const suggestedPrice = calculateChannelPrice(channel)
                  
                  return (
                    <div key={channel.id} className={`bg-white rounded-xl border shadow-sm transition-all relative overflow-hidden group ${isActive ? 'border-orange-400 ring-1 ring-orange-50' : 'border-gray-200 opacity-90'}`}>
                       
                       {/* Kanal Header */}
                       <div className="bg-gray-50 p-3 border-b border-gray-100 flex justify-between items-center group-hover:bg-orange-50/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <Tag className={`w-4 h-4 ${isActive ? 'text-orange-500' : 'text-gray-400'}`}/>
                            <span className="font-bold text-gray-800">{channel.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <div 
                               onClick={() => updateMarketData(channel.id, 'active', !isActive)}
                               className={`w-9 h-5 rounded-full p-1 cursor-pointer transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                             >
                                <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'}`}></div>
                             </div>
                          </div>
                       </div>

                       <div className="p-4 space-y-4">
                          
                          {/* Hesaplama Detayları */}
                          <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-2 rounded border border-gray-100">
                             <div className="flex justify-between">
                               <span>Baz Maliyet + Kargo:</span> 
                               <span className="font-mono">₺{(product.net_cost + channel.cargo_base_fee + (product.desi * channel.cargo_desi_multiplier)).toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between text-green-600"><span>Hedef Kâr (%{channel.profit_margin}):</span> <span>Dahil</span></div>
                             <div className="flex justify-between text-red-500"><span>Komisyon (%{channel.commission_rate}):</span> <span>Dahil</span></div>
                          </div>

                          {/* Fiyat Input */}
                          <div>
                             <div className="flex justify-between items-end mb-1">
                                <label className="text-xs font-bold text-gray-700 uppercase">Satış Fiyatı</label>
                                <button 
                                  onClick={() => applyAutoPrice(channel)}
                                  className="text-[10px] bg-orange-50 text-orange-600 px-2 py-1 rounded hover:bg-orange-100 flex items-center gap-1 border border-orange-100"
                                >
                                  <Calculator className="w-3 h-3"/> Hesapla (₺{suggestedPrice})
                                </button>
                             </div>
                             <div className="relative">
                               <input 
                                 type="number" 
                                 className={`w-full border rounded-lg py-2 pl-3 pr-8 font-bold text-lg outline-none focus:ring-2 ${isActive ? 'border-gray-300 focus:ring-orange-500 text-gray-900' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                                 value={data.price || ''}
                                 disabled={!isActive}
                                 onChange={(e) => updateMarketData(channel.id, 'price', parseFloat(e.target.value))}
                               />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₺</span>
                             </div>
                          </div>
                       </div>
                    </div>
                  )
                })}
             </div>
          </div>
        )}

        {/* --- TAB 3: İSTATİSTİKLER --- */}
        {activeTab === 'analytics' && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
                 <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                    <Box className="w-6 h-6"/>
                 </div>
                 <h3 className="text-gray-500 text-sm font-bold uppercase">Toplam Satış Adedi</h3>
                 <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalSold}</p>
                 <p className="text-xs text-gray-400 mt-1">{product.unit}</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
                 <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-3">
                    <TrendingUp className="w-6 h-6"/>
                 </div>
                 <h3 className="text-gray-500 text-sm font-bold uppercase">Toplam Ciro Katkısı</h3>
                 <p className="text-3xl font-bold text-gray-900 mt-2">₺{stats.totalRevenue.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
                 <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-3">
                    <RefreshCw className="w-6 h-6"/>
                 </div>
                 <h3 className="text-gray-500 text-sm font-bold uppercase">Son Hareket</h3>
                 <p className="text-xl font-bold text-gray-900 mt-2">
                   {stats.lastSaleDate ? new Date(stats.lastSaleDate).toLocaleDateString('tr-TR') : '-'}
                 </p>
                 <p className="text-xs text-gray-400 mt-1">{stats.lastSaleDate ? 'Satış Yapıldı' : 'Henüz Satılmadı'}</p>
              </div>
           </div>
        )}

      </div>
      <style jsx>{`.label-text { @apply block text-xs font-bold text-gray-500 uppercase mb-1; }`}</style>
    </DashboardLayout>
  )
}
