'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Search, Filter, Package, Eye } from 'lucide-react'

export default function CatalogPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [groups, setGroups] = useState([])
  const [settings, setSettings] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [companyId, setCompanyId] = useState(null)

  useEffect(() => {
    loadCatalogData()
  }, [params.slug])

  async function loadCatalogData() {
    try {
      // Katalog ayarlarını yükle
      const { data: catalogSettings, error: settingsError } = await supabase
        .from('catalog_settings')
        .select('*, companies(id, name)')
        .eq('catalog_url_slug', params.slug)
        .eq('is_active', true)
        .single()

      if (settingsError) throw settingsError
      setSettings(catalogSettings)
      setCompanyId(catalogSettings.companies.id)

      // Ürünleri yükle (sadece yayınlananlar)
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          product_groups(code, name, color_code, dealer_discount_percentage)
        `)
        .eq('company_id', catalogSettings.companies.id)
        .eq('is_published', true)
        .eq('is_active', true)
        .order('category')
        .order('name')

      if (productsError) throw productsError
      setProducts(productsData || [])

      // Kategorileri çıkar
      const uniqueCategories = [...new Set(productsData.map(p => p.category).filter(Boolean))]
      setCategories(uniqueCategories)

      // Grupları çıkar
      const uniqueGroups = [...new Map(
        productsData
          .filter(p => p.product_groups)
          .map(p => [p.product_groups.code, p.product_groups])
      ).values()]
      setGroups(uniqueGroups)

    } catch (error) {
      console.error('Error loading catalog:', error)
    } finally {
      setLoading(false)
    }
  }

  // Para birimi sembolleri
  const currencySymbols = {
    TRY: '₺',
    USD: '$',
    EUR: '€',
    GBP: '£'
  }

  // Filtreleme
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.product_code && product.product_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesCategory = !selectedCategory || product.category === selectedCategory
    const matchesGroup = !selectedGroup || product.product_groups?.code === selectedGroup
    
    return matchesSearch && matchesCategory && matchesGroup
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Katalog yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Filtreler */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Arama */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Ürün ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Kategori Filtresi */}
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">Tüm Kategoriler</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          )}

          {/* Grup Filtresi */}
          {groups.length > 0 && (
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">Tüm Gruplar</option>
              {groups.map(group => (
                <option key={group.code} value={group.code}>
                  {group.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Sonuç Sayısı */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">{filteredProducts.length}</span> ürün listeleniyor
          </p>

          {(searchTerm || selectedCategory || selectedGroup) && (
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedCategory('')
                setSelectedGroup('')
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
      </div>

      {/* Ürün Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchTerm || selectedCategory || selectedGroup 
              ? 'Arama kriterlerine uygun ürün bulunamadı' 
              : 'Henüz yayınlanmış ürün bulunmuyor'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div 
              key={product.id}
              onClick={() => router.push(`/catalog/${params.slug}/${product.id}`)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
            >
              {/* Ürün Görseli */}
              <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <img 
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <Package className="w-16 h-16 text-gray-300" />
                )}
              </div>

              {/* Ürün Bilgileri */}
              <div className="p-4">
                {/* Grup Badge */}
                {product.product_groups && (
                  <span 
                    className="inline-block px-2 py-0.5 rounded text-xs font-medium mb-2"
                    style={{ 
                      backgroundColor: `${product.product_groups.color_code}20`,
                      color: product.product_groups.color_code 
                    }}
                  >
                    {product.product_groups.name}
                  </span>
                )}

                {/* Ürün Kodu */}
                {settings?.show_product_codes && product.product_code && (
                  <p className="text-xs text-gray-500 mb-1">{product.product_code}</p>
                )}

                {/* Ürün Adı */}
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {product.name}
                </h3>

                {/* Kategori */}
                {product.category && (
                  <p className="text-xs text-gray-500 mb-3">{product.category}</p>
                )}

{/* Fiyatlar */}
{(settings?.show_list_price || settings?.show_net_price || settings?.show_dealer_discount) && (
  <div className="space-y-1 mb-3">
    {/* Liste Fiyatı */}
    {settings?.show_list_price && (
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Liste Fiyatı:</span>
        <span className="text-lg font-bold text-red-600">
          {currencySymbols[product.currency || 'TRY']}
          {parseFloat(product.dealer_list_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </span>
      </div>
    )}

    {/* İskonto */}
    {settings?.show_dealer_discount && product.dealer_discount_percentage > 0 && (
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">İskonto:</span>
        <span className="text-sm text-red-600 font-medium">
          %{parseFloat(product.dealer_discount_percentage).toFixed(0)}
        </span>
      </div>
    )}

    {/* Net Fiyat */}
    {settings?.show_net_price && (
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-sm font-medium text-gray-700">Net Fiyat:</span>
        <span className="text-lg font-bold text-green-600">
          {currencySymbols[product.currency || 'TRY']}
          {parseFloat(product.dealer_net_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </span>
      </div>
    )}
  </div>
)}
                {/* Birim */}
                <p className="text-xs text-gray-500 mb-3">Birim: {product.unit}</p>

                {/* Detay Butonu */}
                <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                  <Eye className="w-4 h-4" />
                  Detayları Gör
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
