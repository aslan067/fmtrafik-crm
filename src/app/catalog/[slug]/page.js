'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Search, Package, Eye, LayoutGrid, List as ListIcon } from 'lucide-react'

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

      // Ürünleri yükle (sadece yayınlananlar)
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          product_groups(code, name, color_code, dealer_discount_percentage)
        `)
        .eq('company_id', catalogSettings.company_id)
        .eq('is_published', true)
        .eq('is_active', true)
        .order('category')
        .order('name')

      if (productsError) throw productsError
      setProducts(productsData || [])

      // Kategorileri çıkar
      const uniqueCategories = [...new Set((productsData || []).map(p => p.category).filter(Boolean))]
      setCategories(uniqueCategories)

      // Grupları çıkar
      const uniqueGroups = []
      const groupCodes = new Set()
      
      if (productsData) {
        productsData.forEach(p => {
          if (p.product_groups && !groupCodes.has(p.product_groups.code)) {
            groupCodes.add(p.product_groups.code)
            uniqueGroups.push(p.product_groups)
          }
        })
      }
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

  const getCurrencySymbol = (currencyCode) => {
    return currencySymbols[currencyCode || 'TRY'] || '₺'
  }

  // Filtreleme
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      (product.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.product_code && product.product_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesCategory = !selectedCategory || product.category === selectedCategory
    const matchesGroup = !selectedGroup || product.product_groups?.code === selectedGroup
    
    return matchesSearch && matchesCategory && matchesGroup
  })

  const isGridView = settings?.view_mode === 'grid' || !settings?.view_mode

  // Güvenli stil oluşturucu (Hata kaynağını önlemek için)
  const getGroupBadgeStyle = (group) => {
    if (!group || !group.color_code) {
      return { backgroundColor: '#e5e7eb', color: '#374151' } // Varsayılan gri
    }
    return { 
      backgroundColor: `${group.color_code}20`, // %20 opacity
      color: group.color_code 
    }
  }

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

        {/* Sonuç Sayısı ve Görünüm İkonu */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">{filteredProducts.length}</span> ürün listeleniyor
          </p>

          <div className="flex items-center gap-3">
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

            {/* Görünüm İkonu */}
            <div className="flex items-center gap-2 text-gray-500">
              {isGridView ? (
                <LayoutGrid className="w-5 h-5" />
              ) : (
                <ListIcon className="w-5 h-5" />
              )}
              <span className="text-xs">
                {isGridView ? 'Grid' : 'Liste'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ürün Listesi */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchTerm || selectedCategory || selectedGroup 
              ? 'Arama kriterlerine uygun ürün bulunamadı' 
              : 'Henüz yayınlanmış ürün bulunmuyor'}
          </p>
        </div>
      ) : isGridView ? (
        // GRID GÖRÜNÜM (GÜVENLİ VERSİYON)
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
                    style={getGroupBadgeStyle(product.product_groups)}
                  >
                    {product.product_groups.name || 'Grup'}
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
                    {settings?.show_list_price && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Liste Fiyatı:</span>
                        <span className="text-sm text-gray-600 line-through">
                          {getCurrencySymbol(product.currency)}
                          {parseFloat(product.dealer_list_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {settings?.show_dealer_discount && product.dealer_discount_percentage > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">İskonto:</span>
                        <span className="text-sm text-red-600 font-medium">
                          %{parseFloat(product.dealer_discount_percentage || 0).toFixed(0)}
                        </span>
                      </div>
                    )}

                    {settings?.show_net_price && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm font-medium text-gray-700">Net Fiyat:</span>
                        <span className="text-lg font-bold text-green-600">
                          {getCurrencySymbol(product.currency)}
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
      ) : (
        // --- MODERN LİSTE GÖRÜNÜMÜ (YENİ) ---
        <div className="flex flex-col gap-3">
          {filteredProducts.map(product => (
            <div 
              key={product.id}
              onClick={() => router.push(`/catalog/${params.slug}/${product.id}`)}
              className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col sm:flex-row items-center gap-6 hover:shadow-md transition-all cursor-pointer group"
            >
              {/* 1. Görsel (Sabit Boyut) */}
              <div className="w-24 h-24 bg-gray-50 rounded-lg flex-shrink-0 flex items-center justify-center border border-gray-100">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-1" />
                ) : (
                  <Package className="w-8 h-8 text-gray-300" />
                )}
              </div>

              {/* 2. Ana Bilgiler (Kod, İsim, Teknik Özellikler) */}
              <div className="flex-1 text-center sm:text-left w-full">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                  <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600 inline-block w-fit mx-auto sm:mx-0">
                    {product.product_code}
                  </span>
                  {product.product_groups && (
                    <span className="text-xs px-2 py-0.5 rounded font-medium w-fit mx-auto sm:mx-0" style={getGroupBadgeStyle(product.product_groups)}>
                      {product.product_groups.name}
                    </span>
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 mb-2">
                  {product.name}
                </h3>

                {/* Teknik Özellikler (Chips şeklinde) */}
                {product.specifications && (
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {Object.entries(product.specifications).slice(0, 3).map(([key, value]) => (
                      <span key={key} className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full bg-gray-50">
                        <span className="font-medium text-gray-700 capitalize">{key}:</span> {value}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Fiyat ve Aksiyon */}
              <div className="flex flex-col items-center sm:items-end gap-1 min-w-[140px]">
                {settings?.show_list_price && (
                   <span className="text-sm text-gray-400 line-through decoration-red-400">
                     {getCurrencySymbol(product.currency)}
                     {parseFloat(product.dealer_list_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                   </span>
                )}
                {settings?.show_net_price && (
                  <span className="text-2xl font-bold text-gray-900">
                    {getCurrencySymbol(product.currency)}
                    {parseFloat(product.dealer_net_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                )}
                <span className="text-xs text-gray-500 flex items-center gap-1 mt-1 group-hover:text-blue-600">
                  Detay <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
                {/* Ürün Bilgileri */}
                <div className="flex-1 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      {product.product_groups && (
                        <span 
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium mb-2"
                          style={getGroupBadgeStyle(product.product_groups)}
                        >
                          {product.product_groups.name || 'Grup'}
                        </span>
                      )}

                      {settings?.show_product_codes && product.product_code && (
                        <p className="text-xs text-gray-500 mb-1">{product.product_code}</p>
                      )}

                      <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>

                      {product.category && (
                        <p className="text-sm text-gray-600 mb-2">{product.category}</p>
                      )}

                      {product.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {product.description}
                        </p>
                      )}

                      <p className="text-xs text-gray-500 mt-2">Birim: {product.unit}</p>
                    </div>

                    <div className="flex flex-col items-end gap-3 min-w-[200px]">
                      {(settings?.show_list_price || settings?.show_net_price || settings?.show_dealer_discount) && (
                        <div className="w-full space-y-2">
                          {settings?.show_list_price && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Liste:</span>
                              <span className="text-sm text-gray-600 line-through">
                                {getCurrencySymbol(product.currency)}
                                {parseFloat(product.dealer_list_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}

                          {settings?.show_dealer_discount && product.dealer_discount_percentage > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">İskonto:</span>
                              <span className="text-sm text-red-600 font-medium">
                                %{parseFloat(product.dealer_discount_percentage || 0).toFixed(0)}
                              </span>
                            </div>
                          )}

                          {settings?.show_net_price && (
                            <div className="flex items-center justify-between pt-2 border-t">
                              <span className="text-sm font-medium text-gray-700">Net:</span>
                              <span className="text-2xl font-bold text-green-600">
                                {getCurrencySymbol(product.currency)}
                                {parseFloat(product.dealer_net_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                        <Eye className="w-4 h-4" />
                        Detayları Gör
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
