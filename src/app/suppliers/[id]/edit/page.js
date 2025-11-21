'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, X, Percent, DollarSign, AlertCircle, Truck } from 'lucide-react'

export default function EditSupplierPage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    code: '', name: '', discount_type: 'percentage', discount_value: '',
    price_multiplier: '1.00', payment_terms: '', contact_name: '',
    contact_email: '', contact_phone: '', address: '', tax_office: '',
    tax_number: '', notes: '', is_active: true
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', params.id)
        .eq('company_id', profile.company_id)
        .single()

      if (error) throw error
      setFormData(data)
    } catch (err) {
      setError('Yükleme hatası: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq('id', params.id)

      if (error) throw error
      router.push('/suppliers')
      router.refresh()
    } catch (err) {
      setError('Güncelleme hatası: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <DashboardLayout><div className="p-6">Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Tedarikçiyi Düzenle</h1>
          <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
            <Truck className="w-4 h-4"/> {formData.code}
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Sol: Temel & Fiyatlandırma */}
            <div className="space-y-6">
              <div className="card">
                <h2 className="font-semibold text-lg mb-4">Temel Bilgiler</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium block mb-1">Kod *</label><input value={formData.code} onChange={e=>setFormData({...formData,code:e.target.value})} className="input-field" required /></div>
                  <div><label className="text-sm font-medium block mb-1">Firma Adı *</label><input value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})} className="input-field" required /></div>
                  <div className="col-span-2 flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={formData.is_active} onChange={e=>setFormData({...formData,is_active:e.target.checked})} className="rounded text-blue-600"/>
                    <span className="text-sm font-medium">Aktif Tedarikçi</span>
                  </div>
                </div>
              </div>

              <div className="card border-l-4 border-purple-500">
                <h2 className="font-semibold text-lg mb-4">Fiyatlandırma & Koşullar</h2>
                <div className="mb-4 flex gap-4">
                  <label className={`flex-1 cursor-pointer p-3 border rounded text-center ${formData.discount_type==='percentage'?'bg-blue-50 border-blue-500 text-blue-700':'border-gray-200'}`}>
                    <input type="radio" name="dt" checked={formData.discount_type==='percentage'} onChange={()=>setFormData({...formData,discount_type:'percentage'})} className="hidden"/>
                    <Percent className="w-5 h-5 mx-auto mb-1"/> İskonto Bazlı
                  </label>
                  <label className={`flex-1 cursor-pointer p-3 border rounded text-center ${formData.discount_type==='net_price'?'bg-purple-50 border-purple-500 text-purple-700':'border-gray-200'}`}>
                    <input type="radio" name="dt" checked={formData.discount_type==='net_price'} onChange={()=>setFormData({...formData,discount_type:'net_price'})} className="hidden"/>
                    <DollarSign className="w-5 h-5 mx-auto mb-1"/> Net Fiyat
                  </label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {formData.discount_type === 'percentage' ? (
                    <div><label className="text-sm font-medium block mb-1">İskonto %</label><input type="number" value={formData.discount_value} onChange={e=>setFormData({...formData,discount_value:e.target.value})} className="input-field"/></div>
                  ) : (
                    <div><label className="text-sm font-medium block mb-1">Fiyat Çarpanı (x)</label><input type="number" value={formData.price_multiplier} onChange={e=>setFormData({...formData,price_multiplier:e.target.value})} className="input-field"/></div>
                  )}
                  <div><label className="text-sm font-medium block mb-1">Ödeme Koşulları</label><input value={formData.payment_terms} onChange={e=>setFormData({...formData,payment_terms:e.target.value})} className="input-field"/></div>
                </div>
              </div>
            </div>

            {/* Sağ: İletişim & Notlar */}
            <div className="space-y-6">
              <div className="card">
                <h2 className="font-semibold text-lg mb-4">İletişim</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm font-medium block mb-1">Yetkili</label><input value={formData.contact_name} onChange={e=>setFormData({...formData,contact_name:e.target.value})} className="input-field"/></div>
                    <div><label className="text-sm font-medium block mb-1">Telefon</label><input value={formData.contact_phone} onChange={e=>setFormData({...formData,contact_phone:e.target.value})} className="input-field"/></div>
                  </div>
                  <div><label className="text-sm font-medium block mb-1">Email</label><input value={formData.contact_email} onChange={e=>setFormData({...formData,contact_email:e.target.value})} className="input-field"/></div>
                  <div><label className="text-sm font-medium block mb-1">Adres</label><textarea value={formData.address} onChange={e=>setFormData({...formData,address:e.target.value})} rows={2} className="input-field"/></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm font-medium block mb-1">Vergi Dairesi</label><input value={formData.tax_office} onChange={e=>setFormData({...formData,tax_office:e.target.value})} className="input-field"/></div>
                    <div><label className="text-sm font-medium block mb-1">Vergi No</label><input value={formData.tax_number} onChange={e=>setFormData({...formData,tax_number:e.target.value})} className="input-field"/></div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2 className="font-semibold text-lg mb-4">Notlar</h2>
                <textarea value={formData.notes} onChange={e=>setFormData({...formData,notes:e.target.value})} rows={4} className="input-field" placeholder="Özel notlar..."/>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.push('/suppliers')} className="btn-secondary"><X className="w-4 h-4 mr-2"/> İptal</button>
            <button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4 mr-2"/> Değişiklikleri Kaydet</button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
