'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, X, AlertCircle } from 'lucide-react'

export default function EditCustomerPage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    tax_office: '',
    tax_number: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Türkiye',
    notes: '',
    status: 'active'
  })

  useEffect(() => {
    loadCustomer()
  }, [])

  async function loadCustomer() {
    try {
      const user = await getCurrentUser()
      
      // Güvenlik için önce kullanıcı kontrolü
      if (!user) {
        router.push('/login')
        return
      }

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', params.id)
        .single()

      if (customerError) throw customerError
      setFormData(customer)

    } catch (err) {
      console.error('Error loading customer:', err)
      setError('Müşteri bilgileri yüklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      if (updateError) throw updateError

      router.push('/customers')
      router.refresh()
    } catch (err) {
      console.error('Error updating customer:', err)
      setError(err.message || 'Güncelleme sırasında bir hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Müşteriyi Düzenle</h1>
            <p className="text-gray-600 mt-2">Müşteri bilgilerini güncelleyin</p>
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
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Şirket Adı <span className="text-red-500">*</span></label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} required className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vergi Dairesi</label>
                  <input type="text" name="tax_office" value={formData.tax_office || ''} onChange={handleChange} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vergi Numarası</label>
                  <input type="text" name="tax_number" value={formData.tax_number || ''} onChange={handleChange} className="input-field" />
                </div>
              </div>
            </div>

            {/* İletişim Bilgileri */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">İletişim Bilgileri</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefon</label>
                  <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Şehir</label>
                  <input type="text" name="city" value={formData.city || ''} onChange={handleChange} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ülke</label>
                  <input type="text" name="country" value={formData.country || ''} onChange={handleChange} className="input-field" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Adres</label>
                  <textarea name="address" value={formData.address || ''} onChange={handleChange} rows={3} className="input-field" />
                </div>
              </div>
            </div>

            {/* Ek Bilgiler */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ek Bilgiler</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Durum</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="input-field">
                    <option value="active">Aktif</option>
                    <option value="inactive">Pasif</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
                  <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={4} className="input-field" />
                </div>
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
              <button type="button" onClick={() => router.push('/customers')} className="btn-secondary flex items-center gap-2">
                <X className="w-5 h-5" /> İptal
              </button>
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Değişiklikleri Kaydet</span>
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
