'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, X, Percent, DollarSign, AlertCircle } from 'lucide-react'

export default function NewSupplierPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    discount_type: 'percentage',
    discount_value: '',
    price_multiplier: '1.00',
    payment_terms: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    tax_office: '',
    tax_number: '',
    notes: '',
    is_active: true
  })

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

      // Validasyon
      if (formData.discount_type === 'percentage' && !formData.discount_value) {
        throw new Error('İskonto yüzdesi girmelisiniz')
      }

      if (formData.discount_type === 'net_price' && !formData.price_multiplier) {
        throw new Error('Fiyat çarpanı girmelisiniz')
      }

      const insertData = {
        company_id: profile.company_id,
        code: formData.code,
        name: formData.name,
        discount_type: formData.discount_type,
        discount_value: formData.discount_type === 'percentage' ? parseFloat(formData.discount_value) : null,
        price_multiplier: formData.discount_type === 'net_price' ? parseFloat(formData.price_multiplier) : 1.00,
        payment_terms: formData.payment_terms || null,
        contact_name: formData.contact_name || null,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
        address: formData.address || null,
        tax_office: formData.tax_office || null,
        tax_number: formData.tax_number || null,
        notes: formData.notes || null,
        is_active: formData.is_active,
        created_by: user.id
      }

      const { data, error: insertError } = await supabase
        .from('suppliers')
        .insert([insertData])
        .select()
        .single()

      if (insertError) throw insertError

      router.push('/suppliers')
      router.refresh()
    } catch (err) {
      console.error('Error creating supplier:', err)
      setError(err.message || 'Tedarikçi eklenirken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Yeni Tedarikçi Ekle</h1>
            <p className="text-gray-600 mt-2">Tedarikçi bilgilerini ve fiyatlandırma koşullarını girin</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Temel Bilgiler */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Temel Bilgiler</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tedarikçi Kodu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    required
                    className="input-field"
                    placeholder="SUP001"
                  />
                  <p className="text-xs text-gray-500 mt-1">Benzersiz bir kod girin</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tedarikçi Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="input-field"
                    placeholder="Tedarikçi A.Ş."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      Tedarikçi aktif
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Fiyatlandırma Bilgileri */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Fiyatlandırma Koşulları</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Fiyatlandırma Tipi <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.discount_type === 'percentage' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="discount_type"
                      value="percentage"
                      checked={formData.discount_type === 'percentage'}
                      onChange={handleChange}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Percent className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-gray-900">İskonto Yüzdesi</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Liste fiyatı üzerinden iskonto uygular
                      </p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.discount_type === 'net_price' 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="discount_type"
                      value="net_price"
                      checked={formData.discount_type === 'net_price'}
                      onChange={handleChange}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-5 h-5 text-purple-600" />
                        <span className="font-medium text-gray-900">Net Fiyat</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Net fiyat verir, çarpan ile liste oluşturulur
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {formData.discount_type === 'percentage' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    İskonto Yüzdesi <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="discount_value"
                      value={formData.discount_value}
                      onChange={handleChange}
                      required
                      min="0"
                      max="100"
                      step="0.01"
                      className="input-field pr-12"
                      placeholder="50.00"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      %
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Örnek: %50 iskonto = Liste fiyatının yarısı maliyet fiyatınız
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fiyat Çarpanı <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      x
                    </span>
                    <input
                      type="number"
                      name="price_multiplier"
                      value={formData.price_multiplier}
                      onChange={handleChange}
                      required
                      min="1"
                      step="0.01"
                      className="input-field pl-8"
                      placeholder="1.80"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Örnek: 1.80 çarpan = Net fiyat x 1.80 = Liste fiyatı (%44 kar marjı)
                  </p>
                </div>
              )}

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ödeme Koşulları
                </label>
                <input
                  type="text"
                  name="payment_terms"
                  value={formData.payment_terms}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="30 gün vade, 60 gün vade, vb."
                />
              </div>
            </div>

            {/* İletişim Bilgileri */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">İletişim Bilgileri</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yetkili Adı
                  </label>
                  <input
                    type="text"
                    name="contact_name"
                    value={formData.contact_name}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ahmet Yılmaz"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0532 123 4567"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="contact_email"
                    value={formData.contact_email}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="info@tedarikci.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adres
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={2}
                    className="input-field"
                    placeholder="Tam adres..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vergi Dairesi
                  </label>
                  <input
                    type="text"
                    name="tax_office"
                    value={formData.tax_office}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Kadıköy"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vergi Numarası
                  </label>
                  <input
                    type="text"
                    name="tax_number"
                    value={formData.tax_number}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="1234567890"
                  />
                </div>
              </div>
            </div>

            {/* Notlar */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notlar</h2>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                className="input-field"
                placeholder="Tedarikçi hakkında notlar, özel anlaşmalar, vb..."
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push('/suppliers')}
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
                    <span>Tedarikçiyi Kaydet</span>
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
