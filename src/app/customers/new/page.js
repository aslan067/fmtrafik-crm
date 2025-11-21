'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, X, UserPlus, Trash2, User } from 'lucide-react'

export default function NewCustomerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '', tax_office: '', tax_number: '', email: '',
    phone: '', address: '', city: '', country: 'Türkiye',
    notes: '', status: 'active'
  })

  // Kontaklar State'i
  const [contacts, setContacts] = useState([
    { name: '', role: '', email: '', phone: '', is_primary: true }
  ])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // Kontak İşlemleri
  const handleContactChange = (index, field, value) => {
    const newContacts = [...contacts]
    newContacts[index][field] = value
    setContacts(newContacts)
  }

  const addContact = () => {
    setContacts([...contacts, { name: '', role: '', email: '', phone: '', is_primary: false }])
  }

  const removeContact = (index) => {
    if (contacts.length > 1) {
      setContacts(contacts.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      if (!profile?.company_id) throw new Error('Şirket bilgisi bulunamadı')

      // 1. Müşteriyi Kaydet
      const { data: customer, error: insertError } = await supabase
        .from('customers')
        .insert([{ ...formData, company_id: profile.company_id, created_by: user.id }])
        .select()
        .single()

      if (insertError) throw insertError

      // 2. Kontakları Kaydet (Dolu olanları)
      const validContacts = contacts.filter(c => c.name).map(c => ({
        ...c,
        customer_id: customer.id
      }))

      if (validContacts.length > 0) {
        const { error: contactsError } = await supabase
          .from('customer_contacts')
          .insert(validContacts)
        
        if (contactsError) throw contactsError
      }

      router.push('/customers')
      router.refresh()
    } catch (err) {
      console.error('Error:', err)
      setError(err.message || 'Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Yeni Müşteri</h1>
            <p className="text-gray-600 mt-2">Müşteri ve iletişim bilgilerini girin</p>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-lg">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Ana Bilgiler ve Adres (Yan Yana) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card space-y-4">
                <h2 className="font-semibold text-lg">Firma Bilgileri</h2>
                <div><label className="text-sm font-medium block mb-1">Firma Adı *</label><input name="name" value={formData.name} onChange={handleChange} required className="input-field" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium block mb-1">Vergi Dairesi</label><input name="tax_office" value={formData.tax_office} onChange={handleChange} className="input-field" /></div>
                  <div><label className="text-sm font-medium block mb-1">Vergi No</label><input name="tax_number" value={formData.tax_number} onChange={handleChange} className="input-field" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium block mb-1">Genel Telefon</label><input name="phone" value={formData.phone} onChange={handleChange} className="input-field" /></div>
                  <div><label className="text-sm font-medium block mb-1">Genel Email</label><input name="email" value={formData.email} onChange={handleChange} className="input-field" /></div>
                </div>
              </div>

              <div className="card space-y-4">
                <h2 className="font-semibold text-lg">Adres & Durum</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium block mb-1">Şehir</label><input name="city" value={formData.city} onChange={handleChange} className="input-field" /></div>
                  <div><label className="text-sm font-medium block mb-1">Ülke</label><input name="country" value={formData.country} onChange={handleChange} className="input-field" /></div>
                </div>
                <div><label className="text-sm font-medium block mb-1">Açık Adres</label><textarea name="address" value={formData.address} onChange={handleChange} rows={3} className="input-field" /></div>
                <div>
                  <label className="text-sm font-medium block mb-1">Durum</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="input-field">
                    <option value="active">Aktif</option><option value="inactive">Pasif</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Kontak Kişileri */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg flex items-center gap-2"><User className="w-5 h-5 text-blue-600"/> İlgili Kişiler</h2>
                <button type="button" onClick={addContact} className="btn-secondary text-sm py-1 px-3 flex items-center gap-2"><UserPlus className="w-4 h-4"/> Kişi Ekle</button>
              </div>
              
              <div className="space-y-4">
                {contacts.map((contact, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-3 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 w-full">
                      <input placeholder="Ad Soyad" value={contact.name} onChange={(e)=>handleContactChange(index, 'name', e.target.value)} className="input-field" />
                      <input placeholder="Departman / Görev" value={contact.role} onChange={(e)=>handleContactChange(index, 'role', e.target.value)} className="input-field" />
                      <input placeholder="Email" value={contact.email} onChange={(e)=>handleContactChange(index, 'email', e.target.value)} className="input-field" />
                      <input placeholder="Cep Telefonu" value={contact.phone} onChange={(e)=>handleContactChange(index, 'phone', e.target.value)} className="input-field" />
                    </div>
                    <button type="button" onClick={() => removeContact(index)} className="text-red-500 hover:bg-red-100 p-2 rounded mt-1 md:mt-0"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => router.push('/customers')} className="btn-secondary"><X className="w-4 h-4 mr-2"/> İptal</button>
              <button type="submit" disabled={loading} className="btn-primary"><Save className="w-4 h-4 mr-2"/> Kaydet</button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
