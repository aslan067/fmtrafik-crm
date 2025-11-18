'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Filter, Plus, Package, Edit, Trash2, ChevronDown, Upload } from 'lucide-react'

export default function ProductsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    try {
      const user = await getCurrentUser()
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))]

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = !selectedCategory || product.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Yükleniyor...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Ürünler</h1>
              <p className="text-gray-600 mt-1">Ürün kataloğunu yönetin</p>
            </div>
<div className="flex gap-3">
  <button 
    onClick={() => router.push('/products/import')}
    className="btn-secondary flex items-center gap-2"
  >
    <Upload className="w-5 h-5" />
    Toplu İçe Aktar
  </button>
  <button 
    onClick={() => router.push('/products/new')}
    className="btn-primary flex items-center gap-2"
  >
    <Plus className="w-5 h-5" />
    Yeni Ürün
  </button>
</div>

          <div className="card mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Ürün ara... (İsim, açıklama)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="btn-secondary flex items-center gap-2"
              >
                <Filter className="w-5 h-5" />
                Filtrele
                <ChevronDown className={`w-4 h-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {filterOpen && (
              <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Tümü</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="card">
              <p className="text-sm text-gray-600">Toplam Ürün</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{products.length}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600">Aktif Ürün</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {products.filter(p => p.is_active).length}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600">Kategori</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{categories.length}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600">Ortalama Fiyat</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                ₺{products.length > 0 
                  ? (products.reduce((sum, p) => sum + parseFloat(p.list_price), 0) / products.length).toFixed(0)
                  : 0}
              </p>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="card text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedCategory ? 'Ürün bulunamadı' : 'Henüz ürün eklenmemiş'}
              </p>
              <button 
                onClick={() => router.push('/products/new')}
                className="btn-primary"
              >
                İlk Ürünü Ekle
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map(product => (
                <div key={product.id} className="card hover:shadow-lg transition-shadow">
                  <div className="w-full h-48 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg mb-4 flex items-center justify-center">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <Package className="w-16 h-16 text-blue-300" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 line-clamp-2">{product.name}</h3>
                      {product.is_active ? (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full whitespace-nowrap ml-2">
                          Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded-full whitespace-nowrap ml-2">
                          Pasif
                        </span>
                      )}
                    </div>

                    {product.category && (
                      <span className="inline-block px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded mb-2">
                        {product.category}
                      </span>
                    )}

                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {product.description || 'Açıklama yok'}
                    </p>

                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Liste Fiyatı</p>
                        <p className="text-2xl font-bold text-gray-900">
                          ₺{parseFloat(product.list_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Birim</p>
                        <p className="text-sm font-medium text-gray-700">{product.unit}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-gray-200">
                      <button 
                        className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
                      >
                        <Edit className="w-4 h-4" />
                        Düzenle
                      </button>
                      <button 
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
