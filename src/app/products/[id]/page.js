'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  ArrowLeft, Save, Box, BarChart2, Globe, 
  RefreshCw, Calculator, Truck, Briefcase, Tag
} from 'lucide-react'

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general') 
  
  // Veriler
  const [channels, setChannels] = useState([]) 
  const [product, setProduct] = useState({
    name: '',
    product_code: '',
    // --- B2B / Tedarik Kısmı ---
    supplier_list_price: 0, // Liste
    supplier_discount: 0,   // İskonto
    net_cost: 0,            // Net Maliyet (Otomatik)
    profit_margin: 20,      // B2B Kar Marjı (Veritabanında yoksa hesapla)
    list_price: 0,          // B2B Satış Fiyatı
    // --- Lojistik / Vergi ---
    tax_rate: 20,
    desi: 1,
    // --- Stok ---
    stock_quantity: 0,
    safety_stock: 5,
    unit: 'Adet',
    // --- Marketler ---
    market_data: {} 
  })

  useEffect(() => {
    loadData()
  }, [params.id])

  // 1. Maliyet Değişince -> Net Maliyet Hesapla
  useEffect(() => {
    const list = parseFloat(product.supplier_list_price) || 0
    const disc = parseFloat(product.supplier_discount) || 0
    const net = list * (1 - disc / 100)
    
    if (net !== product.net_cost) {
      setProduct(prev => ({ ...prev, net_cost: Number(net.toFixed(2)) }))
    }
  }, [product.supplier_list_price, product.supplier_discount])

  // 2. Net Maliyet veya B2B Marjı Değişince -> B2B Liste Fiyatı Hesapla
  // (Bu sadece kullanıcı manuel fiyat girmediyse çalışsın, yoksa döngüye girer. 
  // Şimdilik basitlik adına manuel tetikleme veya buton ile yapacağız)

  async function loadData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // Kanalları Çek
      const { data: channelsData } = await supabase.from('sales_channels').select('*').eq('company_id', profile.company_id)
      setChannels(channelsData || [])

      // Ürün Çek
      if (params.id !== 'new') {
        const { data: prod } = await supabase.from('products').select('*').eq('id', params.id).single()
        
        // Geriye dönük B2B marj hesaplama (List Price / Net Cost)
        let calculatedMargin = 20
        if (prod.net_cost > 0 && prod.list_price > 0) {
          calculatedMargin = ((prod.list_price - prod.net_cost) / prod.net_cost) * 100
        }

        setProduct({ ...prod, profit_margin: Number(calculatedMargin.toFixed(2)) })
      } else {
        setLoading(false)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // --- B2B FİYAT HESAPLAMA (Tedarik -> Liste Fiyatı) ---
  const calculateB2BListPrice = () => {
    const cost = parseFloat(product.net_cost) || 0
    const margin = parseFloat(product.profit_margin) || 0
    const price = cost * (1 + margin / 100)
    setProduct(prev => ({ ...prev, list_price: Number(price.toFixed(2)) }))
  }

  // --- PAZARYERİ FİYAT HESAPLAMA (Net Maliyet + Giderler -> Satış Fiyatı) ---
  const calculateChannelPrice = (channel) => {
    const cost = parseFloat(product.net_cost) || 0
    const desi = parseFloat(product.desi) || 1
    const vatRate = parseFloat(product.tax_rate) || 20
    
    const commission = parseFloat(channel.commission_rate) || 0
    const profitMargin = parseFloat(channel.profit_margin) || 20
    const baseCargo = parseFloat(channel.cargo_base_fee) || 0
    const desiMulti = parseFloat(channel.cargo_desi_multiplier) || 0

    // 1. Kargo Gideri
    const cargoCost = baseCargo + (desi * desiMulti)

    // 2. Toplam Ham Maliyet
    const totalCost = cost + cargoCost

    // 3. Formül: (Maliyet * (1+Kar)) / (1 - Komisyon - KDV_Etkisi) 
    // Basit güvenli formül kullanıyoruz:
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

      // profit_margin veritabanında sütun olmayabilir, onu payload'dan çıkaralım
      // (Eğer sütun eklediysek kalabilir, şimdilik çıkarıp list_price'ı kaydediyoruz)
      const { profit_margin, ...dbPayload } = product
      
      const payload = { ...dbPayload, company_id: profile.company_id, updated_at: new Date() }
      const { id, ...saveData } = payload

      if (params.id === 'new') {
         await supabase.from('products').insert([saveData])
      } else {
         await supabase.from('products').update(saveData).eq('id', params.id)
      }
      alert('Ürün kaydedildi.')
      if (params.id === 'new') router.push('/products')
    } catch (err) {
      alert('Hata: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <DashboardLayout><div className="flex h-screen items-center justify-center">Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto min-h-screen pb-20">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft className="w-6 h-6"/></button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{params.id === 'new' ? 'Yeni Ürün Kartı' : product.name}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="font-mono bg-gray-100 px-1 rounded">{product.product_code}</span>
                {product.net_cost > 0 && <span className="text-green-600 font-medium">• Net Maliyet: ₺{product.net_cost}</span>}
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
        </div>

        {/* --- TAB 1: GENEL & B2B FİYATLAMA --- */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
            
            {/* SOL KOLON: Ürün Kimliği & Stok */}
            <div className="space-y-6">
              <div className="card space-y-4">
                <h3 className="font-bold text-gray-800 border-b pb-2">Ürün Kimliği</h3>
                <div><label className="label-text">Ürün Adı</label><input type="text" className="input-field" value={product.name} onChange={(e) => setProduct({...product, name: e.target.value})}/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label-text">Ürün Kodu (SKU)</label><input type="text" className="input-field font-mono" value={product.product_code} onChange={(e) => setProduct({...product, product_code: e.target.value})}/></div>
                  <div><label className="label-text">Birim</label><select className="input-field" value={product.unit} onChange={(e) => setProduct({...product, unit: e.target.value})}><option>Adet</option><option>Metre</option><option>Kg</option></select></div>
                </div>
                <div><label className="label-text">Stok Adedi</label><input type="number" className="input-field font-bold" value={product.stock_quantity} onChange={(e) => setProduct({...product, stock_quantity: Number(e.target.value)})}/></div>
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

            {/* SAĞ KOLON: B2B FİYATLANDIRMA MOTORU */}
            <div className="space-y-6">
              
              {/* 1. Tedarik & Maliyet */}
              <div className="card bg-blue-50/50 border-blue-100 space-y-4">
                <h3 className="font-bold text-blue-900 border-b border-blue-200 pb-2">1. Maliyet Analizi</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text text-blue-800">Tedarikçi Liste Fiyatı</label>
                    <div className="relative"><input type="number" className="input-field" value={product.supplier_list_price} onChange={(e) => setProduct({...product, supplier_list_price: Number(e.target.value)})}/><span className="absolute right-3 top-2 text-gray-400">₺</span></div>
                  </div>
                  <div>
                    <label className="label-text text-blue-800">Tedarikçi İskonto (%)</label>
                    <div className="relative"><input type="number" className="input-field" value={product.supplier_discount} onChange={(e) => setProduct({...product, supplier_discount: Number(e.target.value)})}/><span className="absolute right-3 top-2 text-gray-400">%</span></div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded border border-blue-200 flex justify-between items-center shadow-sm">
                  <span className="font-bold text-gray-600 text-sm">NET MALİYET</span>
                  <span className="font-bold text-2xl text-blue-700">₺{product.net_cost}</span>
                </div>
                
                <div className="text-xs text-blue-600 flex gap-2">
                   <span>KDV Oranı:</span>
                   <select className="bg-transparent font-bold outline-none" value={product.tax_rate} onChange={(e) => setProduct({...product, tax_rate: Number(e.target.value)})}>
                     <option value="0">%0</option>
                     <option value="1">%1</option>
                     <option value="10">%10</option>
                     <option value="20">%20</option>
                   </select>
                </div>
              </div>

              {/* 2. B2B Satış Fiyatı */}
              <div className="card border-green-100 bg-green-50/30 space-y-4 relative overflow-hidden">
                 <div className="absolute top-0 right-0 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg">BAYİ & TEKLİF</div>
                 <h3 className="font-bold text-green-900 border-b border-green-200 pb-2">2. B2B Satış Fiyatı Belirleme</h3>
                 
                 <div className="grid grid-cols-2 gap-4 items-end">
                    <div>
                       <label className="label-text text-green-800">B2B Kâr Marjı (%)</label>
                       <input 
                         type="number" 
                         className="input-field" 
                         value={product.profit_margin} 
                         onChange={(e) => setProduct({...product, profit_margin: Number(e.target.value)})}
                         onBlur={calculateB2BListPrice} // Odak çıkınca hesapla
                       />
                    </div>
                    <button 
                      onClick={calculateB2BListPrice}
                      className="btn-secondary bg-white text-green-700 border-green-200 hover:bg-green-50 text-xs py-2.5"
                    >
                      <Calculator className="w-3 h-3 mr-1"/> Fiyatı Hesapla
                    </button>
                 </div>

                 <div className="relative">
                    <label className="label-text text-green-800">Liste Satış Fiyatı (KDV Hariç)</label>
                    <input type="number" className="input-field font-bold text-xl text-green-700" value={product.list_price} onChange={(e) => setProduct({...product, list_price: Number(e.target.value)})}/>
                    <span className="absolute right-3 top-8 text-gray-400">₺</span>
                 </div>
                 <p className="text-[10px] text-gray-500">Bu fiyat, teklif modülünde ve bayi ekranlarında baz fiyat olarak kullanılacaktır.</p>
              </div>

            </div>
          </div>
        )}

        {/* --- TAB 2: E-TİCARET & PAZARYERİ --- */}
        {activeTab === 'markets' && (
          <div className="space-y-6 animate-in fade-in">
             
             {channels.length === 0 && (
               <div className="bg-yellow-50 p-4 rounded text-yellow-800 text-sm border border-yellow-200 flex items-center gap-2">
                 <AlertTriangle className="w-4 h-4"/>
                 Henüz satış kanalı tanımlanmamış. Ayarlardan kanal ekleyiniz.
               </div>
             )}

             {/* Bilgi Kartı */}
             <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3 text-sm text-blue-800">
                <Globe className="w-5 h-5 flex-shrink-0 mt-1"/>
                <div>
                  <p className="font-bold">E-Ticaret Fiyat Motoru</p>
                  <p>Bu bölüm, <b>Genel Sekmesindeki Net Maliyet (₺{product.net_cost})</b> üzerine lojistik ve komisyon maliyetlerini ekleyerek hesaplama yapar. B2B fiyatından bağımsızdır.</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {channels.map(channel => {
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
                          
                          {/* Stok Senk */}
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                             <input type="checkbox" checked={data.sync_stock !== false} onChange={(e) => updateMarketData(channel.id, 'sync_stock', e.target.checked)} disabled={!isActive}/>
                             <span className="text-xs text-gray-600">Stok Senkronizasyonu Açık</span>
                          </div>
                       </div>
                    </div>
                  )
                })}
             </div>
          </div>
        )}

      </div>
      <style jsx>{`.label-text { @apply block text-xs font-bold text-gray-500 uppercase mb-1; }`}</style>
    </DashboardLayout>
  )
}
