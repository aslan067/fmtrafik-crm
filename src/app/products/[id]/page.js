'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  ArrowLeft, Save, Trash2, Box, BarChart2, Globe, 
  ShoppingCart, RefreshCw, Layers
} from 'lucide-react'

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general') // general, markets, analytics
  
  // Ana Ürün Verisi
  const [product, setProduct] = useState({
    name: '',
    product_code: '',
    list_price: 0,
    supplier_list_price: 0, // Alış Fiyatı
    stock_quantity: 0,
    safety_stock: 5,
    unit: 'Adet',
    description: '',
    market_data: {} // JSONB: { trendyol: { price: 100, active: true } }
  })

  // Analiz Verileri
  const [stats, setStats] = useState({
    totalSold: 0,
    totalRevenue: 0,
    lastSaleDate: null
  })

  // Pazaryeri Listesi (Statik Tanım)
  const marketplaces = [
    { id: 'website', name: 'TrafikGerecleri.com', color: 'bg-blue-600' },
    { id: 'trendyol', name: 'Trendyol', color: 'bg-orange-500' },
    { id: 'hepsiburada', name: 'Hepsiburada', color: 'bg-orange-600' },
    { id: 'n11', name: 'N11', color: 'bg-purple-600' },
    { id: 'amazon', name: 'Amazon TR', color: 'bg-yellow-500' },
  ]

  useEffect(() => {
    if (params.id !== 'new') {
      loadProductData()
    } else {
      setLoading(false)
    }
  }, [params.id])

  async function loadProductData() {
    try {
      // 1. Ürün Bilgisi
      const { data: prod, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .single()
      
      if (error) throw error
      setProduct(prod)

      // 2. Satış Performansı (Sale Items tablosundan)
      // "Bu ürün kaç kere satılmış?"
      const { data: sales, error: salesError } = await supabase
        .from('sale_items')
        .select('quantity, total_price, created_at')
        .eq('product_id', params.id)
      
      if (!salesError && sales) {
        const totalSold = sales.reduce((acc, curr) => acc + Number(curr.quantity), 0)
        const totalRevenue = sales.reduce((acc, curr) => acc + Number(curr.total_price), 0)
        const lastSale = sales.length > 0 ? sales[sales.length - 1].created_at : null
        setStats({ totalSold, totalRevenue, lastSaleDate: lastSale })
      }

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      const payload = {
        ...product,
        company_id: profile.company_id,
        updated_at: new Date()
      }
      
      // ID'yi çıkart, update/insert için
      const { id, ...saveData } = payload

      let error
      if (params.id === 'new') {
         const { error: insertError } = await supabase.from('products').insert([saveData])
         error = insertError
      } else {
         const { error: updateError } = await supabase.from('products').update(saveData).eq('id', params.id)
         error = updateError
      }

      if (error) throw error
      alert('Ürün başarıyla kaydedildi.')
      if (params.id === 'new') router.push('/products')

    } catch (err) {
      alert('Hata: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Pazaryeri Fiyatını Güncelleme Yardımcısı
  const updateMarketData = (marketId, field, value) => {
    setProduct(prev => ({
      ...prev,
      market_data: {
        ...prev.market_data,
        [marketId]: {
          ...(prev.market_data?.[marketId] || {}),
          [field]: value
        }
      }
    }))
  }

  if (loading) return <DashboardLayout><div className="flex h-screen items-center justify-center">Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto min-h-screen pb-20">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft className="w-6 h-6"/></button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {params.id === 'new' ? 'Yeni Ürün Ekle' : product.name}
              </h1>
              <p className="text-sm text-gray-500">{product.product_code}</p>
            </div>
          </div>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="btn-primary flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} 
            Kaydet
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('general')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap
              ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <Box className="w-4 h-4"/> Genel Bilgiler
          </button>
          <button 
            onClick={() => setActiveTab('markets')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap
              ${activeTab === 'markets' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <Globe className="w-4 h-4"/> Pazaryeri & Fiyatlar
          </button>
          {params.id !== 'new' && (
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap
                ${activeTab === 'analytics' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}
              `}
            >
              <BarChart2 className="w-4 h-4"/> Satış Performansı
            </button>
          )}
        </div>

        {/* --- TAB 1: GENEL BİLGİLER --- */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
            <div className="card space-y-4">
              <h3 className="font-bold text-gray-900 border-b pb-2">Temel Bilgiler</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ürün Adı</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={product.name}
                  onChange={(e) => setProduct({...product, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ürün Kodu (SKU)</label>
                  <input 
                    type="text" 
                    className="input-field font-mono" 
                    value={product.product_code}
                    onChange={(e) => setProduct({...product, product_code: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Birim</label>
                  <select 
                    className="input-field"
                    value={product.unit}
                    onChange={(e) => setProduct({...product, unit: e.target.value})}
                  >
                    <option>Adet</option>
                    <option>Metre</option>
                    <option>Kg</option>
                    <option>Takım</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea 
                  className="input-field" 
                  rows={4}
                  value={product.description || ''}
                  onChange={(e) => setProduct({...product, description: e.target.value})}
                ></textarea>
              </div>
            </div>

            <div className="space-y-6">
               <div className="card space-y-4 bg-blue-50/50 border-blue-100">
                  <h3 className="font-bold text-blue-900 border-b border-blue-200 pb-2">Stok & Maliyet</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mevcut Stok</label>
                      <input 
                        type="number" 
                        className="input-field font-bold text-lg" 
                        value={product.stock_quantity}
                        onChange={(e) => setProduct({...product, stock_quantity: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kritik Stok Limiti</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        value={product.safety_stock}
                        onChange={(e) => setProduct({...product, safety_stock: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tedarikçi (Alış) Fiyatı</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            className="input-field pl-8" 
                            value={product.supplier_list_price}
                            onChange={(e) => setProduct({...product, supplier_list_price: Number(e.target.value)})}
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₺</span>
                        </div>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ana Liste Satış Fiyatı</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            className="input-field pl-8 font-bold text-gray-900" 
                            value={product.list_price}
                            onChange={(e) => setProduct({...product, list_price: Number(e.target.value)})}
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₺</span>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="card">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Görsel URL</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="input-field text-xs" 
                      placeholder="https://..."
                      value={product.image_url || ''}
                      onChange={(e) => setProduct({...product, image_url: e.target.value})}
                    />
                    {product.image_url && <img src={product.image_url} className="w-10 h-10 rounded border object-cover"/>}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: PAZARYERİ ENTEGRASYONLARI --- */}
        {activeTab === 'markets' && (
          <div className="animate-in fade-in space-y-4">
             <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex gap-3 text-sm text-yellow-800 mb-6">
                <Globe className="w-5 h-5 flex-shrink-0"/>
                <div>
                  <p className="font-bold">Merkezi Fiyat Yönetimi</p>
                  <p>Burada girdiğiniz fiyatlar, API entegrasyonu tamamlandığında otomatik olarak ilgili pazaryerlerine gönderilecektir. "Aktif" işaretli olmayan kanallara veri gönderilmez.</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {marketplaces.map(market => {
                  const data = product.market_data?.[market.id] || {}
                  const isActive = data.active === true
                  
                  return (
                    <div key={market.id} className={`bg-white rounded-xl shadow-sm border transition-all ${isActive ? 'border-blue-400 ring-1 ring-blue-100' : 'border-gray-200 opacity-80'}`}>
                       {/* Header */}
                       <div className={`${market.color} text-white p-3 rounded-t-xl flex justify-between items-center`}>
                          <span className="font-bold">{market.name}</span>
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-medium">{isActive ? 'Aktif' : 'Pasif'}</span>
                             <div 
                               onClick={() => updateMarketData(market.id, 'active', !isActive)}
                               className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors ${isActive ? 'bg-white/30' : 'bg-black/20'}`}
                             >
                                <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0'}`}></div>
                             </div>
                          </div>
                       </div>
                       
                       {/* Content */}
                       <div className="p-4 space-y-3">
                          <div>
                             <label className="text-xs text-gray-500 font-bold uppercase">Satış Fiyatı</label>
                             <div className="relative mt-1">
                               <input 
                                 type="number" 
                                 disabled={!isActive}
                                 className="w-full border border-gray-300 rounded-lg py-2 pl-8 pr-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                                 value={data.price || ''}
                                 onChange={(e) => updateMarketData(market.id, 'price', parseFloat(e.target.value))}
                                 placeholder={product.list_price} // Placeholder olarak ana fiyatı göster
                               />
                               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₺</span>
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                             <input 
                               type="checkbox" 
                               id={`sync_${market.id}`}
                               checked={data.sync_stock !== false}
                               onChange={(e) => updateMarketData(market.id, 'sync_stock', e.target.checked)}
                               disabled={!isActive}
                               className="w-4 h-4 text-blue-600 rounded"
                             />
                             <label htmlFor={`sync_${market.id}`} className="text-xs text-gray-600 cursor-pointer select-none">Stok Senkronizasyonu Açık</label>
                          </div>
                       </div>
                    </div>
                  )
                })}
             </div>
          </div>
        )}

        {/* --- TAB 3: ANALİZ & PERFORMANS --- */}
        {activeTab === 'analytics' && (
          <div className="animate-in fade-in space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="card text-center p-6">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                     <ShoppingCart className="w-6 h-6"/>
                  </div>
                  <p className="text-gray-500 text-sm font-medium uppercase">Toplam Satış Adedi</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalSold}</p>
                  <p className="text-xs text-gray-400 mt-1">{product.unit}</p>
               </div>
               
               <div className="card text-center p-6">
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                     <Layers className="w-6 h-6"/>
                  </div>
                  <p className="text-gray-500 text-sm font-medium uppercase">Toplam Ciro Katkısı</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">₺{stats.totalRevenue.toLocaleString('tr-TR')}</p>
               </div>

               <div className="card text-center p-6">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                     <RefreshCw className="w-6 h-6"/>
                  </div>
                  <p className="text-gray-500 text-sm font-medium uppercase">Son Satış Tarihi</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {stats.lastSaleDate ? new Date(stats.lastSaleDate).toLocaleDateString('tr-TR') : '-'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {stats.lastSaleDate ? 'Hareket var' : 'Henüz satılmadı'}
                  </p>
               </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
