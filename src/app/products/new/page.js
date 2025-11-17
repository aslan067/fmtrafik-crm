'use client'
import DashboardLayout from '@/components/DashboardLayout'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { ArrowLeft, Save, X, Upload } from 'lucide-react'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    list_price: '',
    category: '',
    unit: 'Adet',
    is_active: true
  })

  const categories = [
    'Levhalar',
    'Bariyerler',
    'Boyalar',
    'Dubalar',
    'İkaz Lambaları',
    'Şerit ve Bantlar',
    'Tabelalar',
    'Diğer'
  ]

  const units = [
    'Adet',
    'Metre',
    'Metrekare',
    'Kilogram',
    'Litre',
    'Kova',
    'Rulo',
    'Set',
    'Takım'
  ]

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const user = await getCurrentUser()
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) {
        throw new Error('Şirket bilgisi bulunamadı')
      }

      const { data, error: insertError } = await supabase
        .from('products')
        .insert([{
          company_id: profile.company_id,
          name: formData.name,
          description: formData.description,
          list_price: parseFloat(formData.list_price),
          category: formData.category,
          unit: formData.unit,
          is_active: formData.is_active
        }])
        .select()
        .single()

      if (insertError) throw insertError

      router.push('/products')
      router.refresh()
    } catch (err) {
      console.error('Error creating product:', err)
      setError(err.message || 'Ürün eklenirken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6">
          <button
            onClick={() => router.push('/products')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Geri
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Yeni Ürün Ekle</h1>
          <p className="text-gray-600 mt-2">Yeni ürün bilgilerini girin</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Ürün Görseli */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ürün Görseli</h2>
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                <Upload className="w-12 h-12 text-blue-300" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2">Ürün görseli ekleyin (opsiyonel)</p>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled
                >
                  Görsel Yükle (Yakında)
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  JPG, PNG veya WebP formatı. Maksimum 5MB.
                </p>
              </div>
            </div>
          </div>

          {/* Temel Bilgiler */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Temel Bilgiler</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ürün Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="input-field"
                  placeholder="Trafik Levhası A1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açıklama
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="input-field"
                  placeholder="Ürün hakkında detaylı açıklama..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategori
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="input-field"
                  >
                    <option value="">Kategori seçin...</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Birim
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    className="input-field"
                  >
                    {units.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Fiyat Bilgileri */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Fiyat Bilgileri</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Liste Fiyatı (₺) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    ₺
                  </span>
                  <input
                    type="number"
                    name="list_price"
                    value={formData.list_price}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className="input-field pl-8"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Bu fiyat tekliflerde varsayılan olarak kullanılacaktır.
                </p>
              </div>

              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <input
                  type="checkbox"
                  name="is_active"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-900">
                  Bu ürün aktif (tekliflerde kullanılabilir)
                </label>
              </div>
            </div>
          </div>

          {/* Ek Bilgiler */}
          <div className="card bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">💡 İpucu</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Ürün adını açık ve net yazın</li>
              <li>• Açıklamaya teknik detayları ekleyin</li>
              <li>• Liste fiyatı, müşterilere gösterilen temel fiyattır</li>
              <li>• Teklif oluştururken ürün bazında iskonto uygulayabilirsiniz</li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push('/products')}
              className="btn-secondary flex items-center gap-2"
            >
              <X className="w-5 h-5" />
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Ürünü Kaydet</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
