'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, X, AlertCircle } from 'lucide-react'

export default function NewProductGroupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    dealer_discount_percentage: '',
    description: '',
    color_code: '#3b82f6',
    sort_order: 0,
    is_active: true
  })

  const predefinedColors = [
    { name: 'Mavi', value: '#3b82f6' },
    { name: 'Yeşil', value: '#22c55e' },
    { name: 'Mor', value: '#a855f7' },
    { name: 'Kırmızı', value: '#ef4444' },
    { name: 'Sarı', value: '#eab308' },
    { name: 'Turuncu', value: '#f97316' },
    { name: 'Pembe', value: '#ec4899' },
    { name: 'Gri', value: '#6b7280' },
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

      if (!formData.dealer_discount_percentage || parseFloat(formData.dealer_discount_percentage) < 0 || parseFloat(formData.dealer_discount_percentage) > 100) {
        throw new Error('Bayi iskontosu 0-100 arasında olmalıdır')
      }

      const insertData = {
        company_id: profile.company_id,
        code: formData.code.toUpperCase(),
        name: formData.name,
        dealer_discount_percentage: parseFloat(formData.dealer_discount_percentage),
        description: formData.description || null,
        color_code: formData.color_code,
        sort_order: parseInt(formData.sort_order) || 0,
        is_active: formData.is_active
      }

      const { data, error: insertError } = await supabase
        .from('product_groups')
        .insert([insertData])
        .select()
        .single()

      if (insertError) throw insertError

      router.push('/product-groups')
      router.refresh()
    } catch (err) {
      console.error('Error creating product group:', err)
      setError(err.message || 'Ürün grubu eklenirken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const examplePrice = 1000
  const discountAmount = examplePrice * (parseFloat(formData.dealer_discount_percentage || 0) / 100)
  const netPrice = examplePrice - discountAmount

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Yeni Ürün Grubu Ekle</h1>
            <p className="text-gray-600 mt-2">Ürün grubu bilgilerini ve bayi iskonto oranını girin</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Temel Bilgiler</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grup Kodu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    required
                    maxLength={5}
                    className="input-field uppercase"
                    placeholder="A, B, C"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grup Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="input-field"
                    placeholder="A Grubu (Premium)"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Açıklama
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={2}
                    className="input-field"
                    placeholder="Grup açıklaması..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sıralama
                  </label>
                  <input
                    type="number"
                    name="sort_order"
                    value={formData.sort_order}
                    onChange={handleChange}
                    min="0"
                    className="input-field"
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">Grup aktif</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Bayi İskontosu</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İskonto Yüzdesi <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="dealer_discount_percentage"
                    value={formData.dealer_discount_percentage}
                    onChange={handleChange}
                    required
                    min="0"
                    max="100"
                    step="0.01"
                    className="input-field pr-12 text-2xl font-bold"
                    placeholder="45.00"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xl">%</span>
                </div>
              </div>

              {formData.dealer_discount_percentage && (
                <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
                  <h3 className="font-semibold mb-2">💰 Fiyat Örneği</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Liste Fiyatı:</span>
                      <span className="font-semibold">₺{examplePrice.toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>İskonto:</span>
                      <span className="text-red-600">-₺{discountAmount.toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-semibold">Bayi Net:</span>
                      <span className="font-bold text-blue-600 text-lg">₺{netPrice.toLocaleString('tr-TR')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Renk Seçimi</h2>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                {predefinedColors.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color_code: color.value })}
                    className={`w-full aspect-square rounded-lg border-4 transition-all ${
                      formData.color_code === color.value 
                        ? 'border-gray-900 scale-110' 
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
              <div className="mt-3">
                <input
                  type="color"
                  name="color_code"
                  value={formData.color_code}
                  onChange={handleChange}
                  className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                />
                <span className="ml-3 text-sm text-gray-600">veya özel renk</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push('/product-groups')}
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
                    <span>Kaydet</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
