'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Package, Tag, Ruler, Info, ShieldCheck, Truck } from 'lucide-react'

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
      const { data: catalogSettings } = await supabase
        .from('catalog_settings')
        .select('*, companies(id, name)')
        .eq('catalog_url_slug', params.slug)
        .eq('is_active', true)
        .single()

      setSettings(catalogSettings)

      const { data: productData } = await supabase
        .from('products')
        .select(`*, product_groups (code, name, color_code, dealer_discount_percentage)`)
        .eq('id', params.productId)
        .eq('company_id', catalogSettings.company_id)
        .single()

      setProduct(productData)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }
  const getCurrencySymbol = (c) => currencySymbols[c || 'TRY'] || '₺'

  if (loading) return <div className="h-screen flex items-center justify-center">Yükleniyor...</div>
  if (!product) return <div className="text-center py-20">Ürün bulunamadı</div>

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Breadcrumb / Nav */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button onClick={() => router.push(`/catalog/${params.slug}`)} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Kataloğa Dön
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* SOL KOLON: Görsel ve Özellikler (8 birim) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Görsel Kartı */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex items-center justify-center min-h-[400px]">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="max-h-[500px] w-auto object-contain" />
              ) : (
                <div className="text-gray-300 flex flex-col items-center">
                  <Package className="w-24 h-24 mb-4" />
                  <span>Görsel Yok</span>
                </div>
              )}
            </div>

            {/* Açıklama ve Özellikler */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" /> Ürün Detayları
              </h2>
              
              <div className="prose max-w-none text-gray-600 mb-8">
                <p className="whitespace-pre-line">{product.description || 'Açıklama bulunmuyor.'}</p>
              </div>

              {product.specifications && Object.keys(product.specifications).length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Ruler className="w-4 h-4" /> Teknik Özellikler
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(product.specifications).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-500 text-sm capitalize">{key}</span>
                        <span className="font-medium text-gray-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SAĞ KOLON: Fiyat ve Satın Alma (4 birim - Sticky) */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-blue-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                
                {/* Ürün Başlık */}
                <div className="mb-4">
                  <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">{product.product_code}</span>
                  <h1 className="text-2xl font-bold text-gray-900 mt-2 leading-tight">{product.name}</h1>
                  <p className="text-sm text-gray-500 mt-1">{product.category}</p>
                </div>

                {/* Fiyat Alanı */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  {settings?.show_list_price && (
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-gray-500">Liste Fiyatı</span>
                      <span className="text-sm text-gray-400 line-through decoration-red-400">
                         {getCurrencySymbol(product.currency)}
                         {parseFloat(product.dealer_list_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {settings?.show_dealer_discount && product.dealer_discount_percentage > 0 && (
                     <div className="flex justify-between items-center mb-2">
                       <span className="text-sm text-gray-500">Size Özel İskonto</span>
                       <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded">
                         %{parseFloat(product.dealer_discount_percentage).toFixed(0)}
                       </span>
                     </div>
                  )}
                  {settings?.show_net_price && (
                    <div className="pt-3 border-t border-gray-200">
                      <span className="block text-xs text-gray-500 mb-1">Net Birim Fiyat</span>
                      <span className="text-4xl font-bold text-blue-600 tracking-tight">
                        {getCurrencySymbol(product.currency)}
                        {parseFloat(product.dealer_net_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">+ KDV</span>
                    </div>
                  )}
                </div>

                {/* Aksiyon Butonları */}
                <div className="space-y-3">
                   <button className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-blue-200 shadow-lg transition-all transform hover:-translate-y-0.5">
                     Teklif İste / Sepete Ekle
                   </button>
                   <p className="text-xs text-center text-gray-400">Stok ve termin için iletişime geçiniz.</p>
                </div>
              </div>

              {/* Güven Rozetleri */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                  <ShieldCheck className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-900">Orijinal Ürün</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                  <Truck className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-900">Hızlı Teslimat</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
