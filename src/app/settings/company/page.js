'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, Building2, Upload, ArrowLeft, Image as ImageIcon, AlertCircle } from 'lucide-react'

export default function CompanySettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    tax_office: '', // Yeni
    tax_number: '', // Yeni
    logo_url: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()
      
      const { data: company, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single()

      if (error) throw error
      
      setFormData({
        name: company.name || '',
        email: company.email || '',
        phone: company.phone || '',
        website: company.website || '',
        address: company.address || '',
        tax_office: company.tax_office || '', // Yeni
        tax_number: company.tax_number || '', // Yeni
        logo_url: company.logo_url || ''
      })
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Bilgiler yüklenemedi' })
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `company-logo-${Date.now()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('products') 
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(fileName)

      setFormData(prev => ({ ...prev, logo_url: publicUrl }))
    } catch (err) {
      setMessage({ type: 'error', text: 'Görsel yükleme hatası: ' + err.message })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      const { error } = await supabase
        .from('companies')
        .update(formData)
        .eq('id', profile.company_id)

      if (error) throw error
      setMessage({ type: 'success', text: 'Şirket bilgileri güncellendi' })
    } catch (err) {
      setMessage({ type: 'error', text: 'Güncelleme hatası: ' + err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <DashboardLayout><div className="p-6">Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <button onClick={() => router.push('/settings')} className="text-gray-500 hover:text-gray-900 flex items-center gap-2 mb-2">
              <ArrowLeft className="w-4 h-4" /> Ayarlara Dön
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Şirket Bilgileri</h1>
            <p className="text-gray-600">Tekliflerde ve faturalarda görünecek bilgiler</p>
          </div>

          {message.text && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              <AlertCircle className="w-5 h-5" /> {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Sol: Logo */}
            <div className="card h-fit">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><ImageIcon className="w-5 h-5 text-blue-600"/> Şirket Logosu</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                {formData.logo_url ? (
                  <div className="relative">
                    <img src={formData.logo_url} alt="Logo" className="max-h-32 mx-auto object-contain mb-4" />
                    <label className="text-xs text-blue-600 cursor-pointer hover:underline">
                      Değiştir
                      <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" disabled={uploading} />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm text-gray-600 block">Logo Yükle</span>
                    <span className="text-xs text-gray-400">PNG, JPG (Max 2MB)</span>
                    <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" disabled={uploading} />
                  </label>
                )}
                {uploading && <p className="text-xs text-blue-500 mt-2">Yükleniyor...</p>}
              </div>
            </div>

            {/* Sağ: Form */}
            <div className="lg:col-span-2 card space-y-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-purple-600"/> Firma Detayları</h3>
              
              <div>
                <label className="block text-sm font-medium mb-1">Şirket Ünvanı</label>
                <input value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} className="input-field" required />
              </div>

              {/* YENİ EKLENEN: Vergi Bilgileri */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Vergi Dairesi</label>
                  <input value={formData.tax_office} onChange={e=>setFormData({...formData, tax_office:e.target.value})} className="input-field" placeholder="Örn: Kadıköy" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Vergi Numarası</label>
                  <input value={formData.tax_number} onChange={e=>setFormData({...formData, tax_number:e.target.value})} className="input-field" placeholder="1234567890" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Telefon</label>
                  <input value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input value={formData.email} onChange={e=>setFormData({...formData, email:e.target.value})} className="input-field" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Web Sitesi</label>
                <input value={formData.website} onChange={e=>setFormData({...formData, website:e.target.value})} className="input-field" placeholder="https://..." />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Adres</label>
                <textarea value={formData.address} onChange={e=>setFormData({...formData, address:e.target.value})} rows={3} className="input-field" />
              </div>

              <div className="pt-4 border-t flex justify-end">
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                  {saving ? 'Kaydediliyor...' : <><Save className="w-4 h-4" /> Kaydet</>}
                </button>
              </div>
            </div>

          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
