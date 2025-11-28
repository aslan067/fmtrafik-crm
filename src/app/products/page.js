'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  Search, Plus, Filter, Package, AlertTriangle, 
  MoreHorizontal, ChevronRight, BarChart3, Globe
} from 'lucide-react'

export default function ProductsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  
  // Arama ve Filtre
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all') // all, low_stock, active

  useEffect(() => {
    // Debounce (Gecikmeli) Arama
    const delayDebounce = setTimeout(() => {
      loadProducts()
    }, 500)
    return () => clearTimeout(delayDebounce)
  }, [searchTerm, filterType])

  async function loadProducts() {
    setLoading(true)
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      let query = supabase
        .from('products')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name')
        .limit(50) // Performans için ilk 50 kayıt

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,product_code.ilike.%${searchTerm}%`)
      }

      if (filterType === 'low_stock') {
        // Not: SQL tarafında safety_stock ile karşılaştırma daha sağlıklı olur ama şimdilik JS'de filtreleyebiliriz veya 
        // basitçe stoğu 5'ten küçük olanları çekelim
        query = query.lt('stock_quantity', 10) 
      }

      const { data, error } = await query
      if (error) throw error
      setProducts(data || [])

    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 bg-gray-50/50 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ürün Yönetimi</h1>
              <p className="text-gray-500 text-sm">Tüm kanallardaki ürünlerinizi, fiyatlarınızı ve stoklarınızı yönetin.</p>
            </div>
            <button 
              onClick={() => router.push('/products/new')} 
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Yeni Ürün Ekle
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Ürün adı, kodu veya barkod ara..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${filterType === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
              >
                Tümü
              </button>
              <button 
                onClick={() => setFilterType('low_stock')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${filterType === 'low_stock' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
              >
                Kritik Stok
              </button>
            </div>
          </div>

          {/* Product Grid / Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-xs border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Ürün Detayı</th>
                    <th className="px-6 py-4 text-center">Stok</th>
                    <th className="px-6 py-4 text-right">Liste Fiyatı</th>
                    <th className="px-6 py-4 text-center">Kanal Durumu</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan="5" className="text-center py-12 text-gray-400">Yükleniyor...</td></tr>
                  ) : products.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-12 text-gray-400">Ürün bulunamadı.</td></tr>
                  ) : (
                    products.map((product) => (
                      <tr 
                        key={product.id} 
                        onClick={() => router.push(`/products/${product.id}`)}
                        className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-bold overflow-hidden border border-gray-200">
                              {product.image_url ? <img src={product.image_url} className="w-full h-full object-cover"/> : <Package className="w-6 h-6 opacity-50"/>}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{product.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-mono border border-gray-200">{product.product_code}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className={`inline-flex flex-col items-center px-3 py-1 rounded-lg border ${
                            product.stock_quantity <= (product.safety_stock || 5) 
                              ? 'bg-red-50 text-red-700 border-red-100' 
                              : 'bg-green-50 text-green-700 border-green-100'
                          }`}>
                            <span className="font-bold text-lg leading-none">{product.stock_quantity}</span>
                            <span className="text-[10px] uppercase">{product.unit}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-mono font-bold text-gray-900">
                            {product.currency === 'USD' ? '$' : '₺'}{parseFloat(product.list_price).toLocaleString('tr-TR')}
                          </div>
                          {product.market_data && Object.keys(product.market_data).length > 0 && (
                            <div className="text-[10px] text-gray-400 mt-1 flex justify-end items-center gap-1">
                              <Globe className="w-3 h-3"/> {Object.keys(product.market_data).length} Kanal
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-1">
                            {/* Kanal İkonları (Simülasyon) */}
                            {product.market_data?.trendyol?.active && <div className="w-2 h-2 rounded-full bg-orange-500" title="Trendyol Aktif"></div>}
                            {product.market_data?.hepsiburada?.active && <div className="w-2 h-2 rounded-full bg-orange-600" title="HB Aktif"></div>}
                            {product.market_data?.amazon?.active && <div className="w-2 h-2 rounded-full bg-yellow-500" title="Amazon Aktif"></div>}
                            {product.market_data?.n11?.active && <div className="w-2 h-2 rounded-full bg-purple-600" title="N11 Aktif"></div>}
                            {(!product.market_data || Object.keys(product.market_data).length === 0) && <span className="text-xs text-gray-300">-</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 ml-auto"/>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}
