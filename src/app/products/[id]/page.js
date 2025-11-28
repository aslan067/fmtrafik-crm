'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  ArrowLeft, Save, Box, BarChart2, Globe, 
  RefreshCw, Calculator, Truck
} from 'lucide-react'

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general') 
  
  // Veriler
  const [channels, setChannels] = useState([]) // Ayarlardan gelen kurallar
  const [product, setProduct] = useState({
    name: '',
    product_code: '',
    supplier_list_price: 0, // Tedarikçi Liste Fiyatı
    supplier_discount: 0,   // Tedarikçi İskontosu (%)
    net_cost: 0,            // Otomatik hesaplanan net maliyet
    tax_rate: 20,           // KDV
    desi: 1,                // Kargo için
    list_price: 0,          // Bizim ana liste fiyatımız
    stock_quantity: 0,
    safety_stock: 5,
    unit: 'Adet',
    market_data: {} 
  })

  useEffect(() => {
    loadData()
  }, [params.id])

  // Maliyet değişince Net Cost'u otomatik güncelle
  useEffect(() => {
    const listPrice = parseFloat(product.supplier_list_price) || 0
    const discount = parseFloat(product.supplier_discount) || 0
    const net = listPrice * (1 - discount / 100)
    
    // Eğer hesaplanan değer state'dekinden farklıysa güncelle (Infinite loop önlemek için kontrol)
    if (net !== product.net_cost) {
      setProduct(prev => ({ ...prev, net_cost: Number(net.toFixed(2)) }))
    }
  }, [product.supplier_list_price, product.supplier_discount])

  async function loadData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // 1. Kanalları Çek
      const { data: channelsData } = await supabase.from('sales_channels').select('*').eq('company_id', profile.company_id)
      setChannels(channelsData || [])

      // 2. Ürün Varsa Çek
      if (params.id !== 'new') {
        const { data: prod } = await supabase.from('products').select('*').eq('id', params.id).single()
        setProduct(prod)
      } else {
        setLoading(false)
      }

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // --- FİYAT HESAPLAMA MOTORU ---
  const calculateChannelPrice = (channel) => {
    // Girdiler
    const cost = parseFloat(product.net_cost) || 0
    const desi = parseFloat(product.desi) || 1
    const vatRate = parseFloat(product.tax_rate) || 20
    
    // Kanal Kuralları
    const commission = parseFloat(channel.commission_rate) || 0
    const profitMargin = parseFloat(channel.profit_margin) || 20
    const baseCargo = parseFloat(channel.cargo_base_fee) || 0
    const desiMulti = parseFloat(channel.cargo_desi_multiplier) || 0

    // 1. Kargo Maliyeti
    const cargoCost = baseCargo + (desi * desiMulti)

    // 2. Toplam Maliyet (Ürün + Kargo)
    const totalCost = cost + cargoCost

    // 3. Hedeflenen Net (Maliyet + Kâr)
    // Maliyetin üzerine kâr koyuyoruz
    const desiredNet = totalCost * (1 + profitMargin / 100)

    // 4. Satış Fiyatı (Komisyon ve KDV Dahil)
    // Formül: Fiyat = DesiredNet / (1 - KomisyonOranı) * (1 + KDV)
    // Not: Komisyon genelde KDV'li fiyattan kesilir, bu yüzden matematiği basitleştirip güvenli tarafta kalalım:
    // Pazar Yeri Satış Fiyatı = (Maliyet + Kargo) * (1 + Kar + Komisyon + KDV)  <- Bu basit yaklaşım
    // Daha hassas yaklaşım (Break-even):
    
    // Basit ve güvenli formül (Kullanıcının anlayacağı):
    // Maliyetlerin üstüne hepsini ekle
    const markup = 1 + ((profitMargin + commission + vatRate) / 100)
    const finalPrice = totalCost * markup

    return Number(finalPrice.toFixed(2))
  }

  // Bir kanalın fiyatını otomatik hesaplayıp state'e yaz
  const applyAutoPrice = (channel) => {
    const suggestedPrice = calculateChannelPrice(channel)
    setProduct(prev => ({
      ...prev,
      market_data: {
        ...prev.market_data,
        [channel.id]: {
          ...(prev.market_data?.[channel.id] || {}),
          price: suggestedPrice,
          active: true // Otomatik hesaplayınca aktif et
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

      const payload = { ...product, company_id: profile.company_id, updated_at: new Date() }
      const { id, ...saveData } = payload // ID'yi ayır

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
              <h1 className="text-2xl font-bold text-gray-900">{params.id === 'new' ? 'Yeni Ürün' : product.name}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="font-mono bg-gray-100 px-1 rounded">{product.product_code}</span>
                <span>•</span>
                <span>Net Maliyet: ₺{product.net_cost}</span>
              </div>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Kaydet
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button onClick={() => setActiveTab('general')} className={`px-6 py-3 border-b-2 font-medium text-sm flex gap-2 ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}><Box className="w-4 h-4"/> Genel & Maliyet</button>
          <button onClick={() => setActiveTab('markets')} className={`px-6 py-3 border-b-2 font-medium text-sm flex gap-2 ${activeTab === 'markets' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}><Globe className="w-4 h-4"/> Pazaryeri Fiyatları</button>
        </div>

        {/* --- TAB 1: GENEL & MALİYET --- */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
            {/* Sol: Temel Bilgiler */}
            <div className="space-y-6">
              <div className="card space-y-4">
                <h3 className="font-bold border-b pb-2">Ürün Kimliği</h3>
                <div><label className="label-text">Ürün Adı</label><input type="text" className="input-field" value={product.name} onChange={(e) => setProduct({...product, name: e.target.value})}/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label-text">Ürün Kodu (SKU)</label><input type="text" className="input-field font-mono" value={product.product_code} onChange={(e) => setProduct({...product, product_code: e.target.value})}/></div>
                  <div><label className="label-text">Birim</label><select className="input-field" value={product.unit} onChange={(e) => setProduct({...product, unit: e.target.value})}><option>Adet</option><option>Metre</option><option>Kg</option></select></div>
                </div>
                <div><label className="label-text">Stok Adedi</label><input type="number" className="input-field font-bold" value={product.stock_quantity} onChange={(e) => setProduct({...product, stock_quantity: Number(e.target.value)})}/></div>
              </div>

              <div className="card space-y-4">
                 <h3 className="font-bold border-b pb-2 flex items-center gap-2"><Truck className="w-4 h-4"/> Lojistik Bilgileri</h3>
                 <p className="text-xs text-gray-500">Kargo maliyetleri bu değere göre hesaplanır.</p>
                 <div>
                    <label className="label-text">Desi / Hacim</label>
                    <input type="number" className="input-field" value={product.desi} onChange={(e) => setProduct({...product, desi: Number(e.target.value)})}/>
                 </div>
              </div>
            </div>

            {/* Sağ: Maliyet Yapısı */}
            <div className="space-y-6">
              <div className="card bg-blue-50/50 border-blue-100 space-y-4">
                <h3 className="font-bold text-blue-900 border-b border-blue-200 pb-2">Maliyet Hesaplama (Waterfall)</h3>
                
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

                <div className="bg-white p-3 rounded border border-blue-100 flex justify-between items-center shadow-sm">
                  <span className="font-bold text-gray-600">Net Ürün Maliyeti</span>
                  <span className="font-bold text-xl text-blue-600">₺{product.net_cost}</span>
                </div>

                <div>
                   <label className="label-text text-blue-800">KDV Oranı (%)</label>
                   <select className="input-field" value={product.tax_rate} onChange={(e) => setProduct({...product, tax_rate: Number(e.target.value)})}>
                     <option value="0">%0</option>
                     <option value="1">%1</option>
                     <option value="10">%10</option>
                     <option value="20">%20</option>
                   </select>
                </div>
              </div>

              <div className="card border-green-100 bg-green-50/30">
                 <h3 className="font-bold text-green-900 border-b border-green-200 pb-2">Standart Satış Fiyatı</h3>
                 <p className="text-xs text-gray-500 mb-2">Katalog ve tekliflerde kullanılacak baz fiyat.</p>
                 <div className="relative">
                    <input type="number" className="input-field font-bold text-lg text-green-700" value={product.list_price} onChange={(e) => setProduct({...product, list_price: Number(e.target.value)})}/>
                    <span className="absolute right-3 top-3 text-gray-400">₺</span>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: PAZARYERİ FİYATLARI --- */}
        {activeTab === 'markets' && (
          <div className="space-y-6 animate-in fade-in">
             
             {channels.length === 0 && (
               <div className="bg-yellow-50 p-4 rounded text-yellow-800 text-sm">
                 Henüz satış kanalı tanımlanmamış. <a href="/settings/channels" className="underline font-bold">Ayarlar</a> sayfasından kanal ekleyin.
               </div>
             )}

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {channels.map(channel => {
                  const data = product.market_data?.[channel.id] || {}
                  const isActive = data.active === true
                  const suggestedPrice = calculateChannelPrice(channel)
                  
                  return (
                    <div key={channel.id} className={`bg-white rounded-xl border shadow-sm transition-all relative overflow-hidden ${isActive ? 'border-blue-400 ring-1 ring-blue-50' : 'border-gray-200 opacity-90'}`}>
                       
                       {/* Kanal Başlığı */}
                       <div className="bg-gray-50 p-3 border-b border-gray-100 flex justify-between items-center">
                          <span className="font-bold text-gray-800">{channel.name}</span>
                          <div className="flex items-center gap-2">
                             <input type="checkbox" checked={isActive} onChange={(e) => updateMarketData(channel.id, 'active', e.target.checked)} className="w-4 h-4"/>
                          </div>
                       </div>

                       <div className="p-4 space-y-4">
                          
                          {/* Hesaplama Özeti */}
                          <div className="text-xs text-gray-500 space-y-1 bg-gray-50/50 p-2 rounded">
                             <div className="flex justify-between"><span>Maliyet + Kargo:</span> <span>₺{(product.net_cost + channel.cargo_base_fee + (product.desi * channel.cargo_desi_multiplier)).toFixed(2)}</span></div>
                             <div className="flex justify-between text-blue-600"><span>Hedef Kâr (%{channel.profit_margin}):</span> <span>Dahil</span></div>
                             <div className="flex justify-between text-red-500"><span>Komisyon (%{channel.commission_rate}):</span> <span>Dahil</span></div>
                          </div>

                          {/* Fiyat Input */}
                          <div>
                             <div className="flex justify-between items-end mb-1">
                                <label className="text-xs font-bold text-gray-700 uppercase">Satış Fiyatı</label>
                                <button 
                                  onClick={() => applyAutoPrice(channel)}
                                  className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 flex items-center gap-1"
                                >
                                  <Calculator className="w-3 h-3"/> Önerileni Uygula (₺{suggestedPrice})
                                </button>
                             </div>
                             <div className="relative">
                               <input 
                                 type="number" 
                                 className={`w-full border rounded-lg py-2 pl-3 pr-8 font-bold text-gray-900 outline-none focus:ring-2 ${isActive ? 'border-gray-300 focus:ring-blue-500' : 'bg-gray-50 text-gray-400'}`}
                                 value={data.price || ''}
                                 disabled={!isActive}
                                 onChange={(e) => updateMarketData(channel.id, 'price', parseFloat(e.target.value))}
                               />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₺</span>
                             </div>
                          </div>
                          
                          {/* Stok Senk */}
                          <div className="flex items-center gap-2 pt-2">
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
