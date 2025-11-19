'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Package, Tag, Ruler, Info } from 'lucide-react'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState(null)
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    loadProductDetail()
  }, [params.productId])

  async function loadProductDetail() {
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

      // Ürün detayını yükle
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select(`
          *,
          product_groups(code, name, color_code, dealer_discount_percentage),
          suppliers(name)
        `)
        .eq('id', params.productId)
        .eq('company_id', catalogSettings.companies.id)
        .eq('is_published', true)
        .eq('is_active', true)
        .single()

      if (productError) throw productError
      setProduct(productData)

    } catch (error) {
      console.error('Error loading product:', error)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Ürün Bulunamadı</h1>
        <p className="text-gray-600 mb-6">Bu ürün mevcut değil veya yayından kaldırılmış.</p>
        <button
          onClick={() => router.push(`/catalog/${params.slug}`)}
          className="btn-primary"
        >
          Kataloğa Dön
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Geri Butonu */}
      <button
        onClick={() => router.push(`/catalog/${params.slug}`)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Kataloğa Dön
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sol Kolon - Görsel */}
        <div>
          <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center sticky top-24">
            {product.image_url ? (
              <img 
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="w-32 h-32 text-gray-300" />
            )}
          </div>
        </div>

        {/* Sağ Kolon - Bilgiler */}
        <div>
          {/* Grup Badge */}
          {product.product_groups && (
            <span 
              className="inline-block px-3 py-1 rounded text-sm font-medium mb-3"
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
            <p className="text-sm text-gray-500 mb-2">Ürün Kodu: {product.product_code}</p>
          )}

          {/* Ürün Adı */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

          {/* Kategori */}
          {product.category && (
            <div className="flex items-center gap-2 text-gray-600 mb-6">
              <Tag className="w-5 h-5" />
              <span>{product.category}</span>
            </div>
          )}

          {/* Açıklama */}
          {product.description && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Açıklama
              </h2>
              <p className="text-gray-700 whitespace-pre-line">{product.description}</p>
            </div>
          )}

{/* Fiyatlar */}
{(settings?.show_list_price || settings?.show_net_price || settings?.show_dealer_discount) && (
  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-4">Fiyat Bilgileri</h2>
    
    <div className="space-y-3">
      {/* Liste Fiyatı */}
      {settings?.show_list_price && (
        <div className="flex items-center justify-between">
          <span className="text-xl font-semibold text-gray-900">Liste Fiyatı:</span>
          <span className="text-3xl font-bold text-red-600">
            {currencySymbols[product.currency || 'TRY']}
            {parseFloat(product.dealer_list_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* İskonto */}
      {settings?.show_dealer_discount && product.dealer_discount_percentage > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-gray-700">Bayi İskontosu:</span>
          <span className="text-lg text-red-600 font-semibold">
            %{parseFloat(product.dealer_discount_percentage).toFixed(0)}
          </span>
        </div>
      )}

      {/* Net Fiyat */}
      {settings?.show_net_price && (
        <div className="flex items-center justify-between pt-3 border-t-2 border-white">
          <span className="text-xl font-semibold text-gray-900">Net Fiyatınız:</span>
          <span className="text-3xl font-bold text-green-600">
            {currencySymbols[product.currency || 'TRY']}
            {parseFloat(product.dealer_net_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Birim */}
      <p className="text-sm text-gray-600 text-right">
        Birim: {product.unit}
      </p>
    </div>
  </div>
)}

          {/* Teknik Özellikler */}
          {settings?.show_specifications && product.specifications && Object.keys(product.specifications).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Ruler className="w-5 h-5" />
                Teknik Özellikler
              </h2>
              <div className="space-y-2">
                {Object.entries(product.specifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-600 capitalize">{key}:</span>
                    <span className="font-medium text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
