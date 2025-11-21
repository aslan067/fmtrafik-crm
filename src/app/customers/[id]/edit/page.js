'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, X } from 'lucide-react'

export default function EditCustomerPage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '', tax_office: '', tax_number: '', email: '',
    phone: '', address: '', city: '', country: 'Türkiye',
    notes: '', status: 'active'
  })

  useEffect(() => {
    loadCustomer()
  }, [])

  async function loadCustomer() {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error
      setFormData(data)
    } catch (err) {
      setError('Müşteri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      if (error) throw error
      router.push('/customers')
      router.refresh()
    } catch (err) {
      setError('Güncelleme hatası')
    }
  }

  if (loading) return <DashboardLayout><div className="p-6">Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Müşteriyi Düzenle</h1>
        {error && <div className="bg-red-50 p-4 mb-4 text-red-700 rounded">{error}</div>}
        
        <form onSubmit={handleSubmit} className="card space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Şirket Adı</label>
              <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vergi Dairesi</label>
              <input value={formData.tax_office || ''} onChange={e => setFormData({...formData, tax_office: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vergi No</label>
              <input value={formData.tax_number || ''} onChange={e => setFormData({...formData, tax_number: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefon</label>
              <input value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="input-field" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Adres</label>
              <textarea value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} className="input-field" rows={2} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Notlar</label>
              <textarea value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} className="input-field" rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
             <button type="button" onClick={() => router.push('/customers')} className="btn-secondary">İptal</button>
             <button type="submit" className="btn-primary flex items-center gap-2"><Save className="w-4 h-4" /> Kaydet</button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
