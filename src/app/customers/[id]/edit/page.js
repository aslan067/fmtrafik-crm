'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, X, UserPlus, Trash2, AlertCircle, User } from 'lucide-react'

export default function EditCustomerPage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '', tax_office: '', tax_number: '', email: '',
    phone: '', address: '', city: '', country: 'Türkiye',
    notes: '', status: 'active'
  })

  const [contacts, setContacts] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // 1. Müşteri
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', params.id)
        .eq('company_id', profile.company_id)
        .single()

      if (customerError) throw customerError
      setFormData(customer)

      // 2. Kontakları Çek
      const { data: contactsData } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', params.id)
      
      if (contactsData && contactsData.length > 0) {
        setContacts(contactsData)
      } else {
        setContacts([{ name: '', role: '', email: '', phone: '' }]) // Boş bir satır
      }

    } catch (err) {
      setError('Veri yükleme hatası: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleContactChange = (index, field, value) => {
    const newContacts = [...contacts]
    newContacts[index][field] = value
    setContacts(newContacts)
  }

  const addContact = () => {
    setContacts([...contacts, { name: '', role: '', email: '', phone: '' }])
  }

  const removeContact = async (index) => {
    const contact = contacts[index]
    
    // Eğer veritabanında kayıtlı bir kontak ise, DB'den sil
    if (contact.id) {
      if (!confirm('Bu kişiyi silmek istediğinize emin misiniz?')) return
      await supabase.from('customer_contacts').delete().eq('id', contact.id)
    }
    
    // UI'dan sil
    setContacts(contacts.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // 1. Müşteri Güncelle
      const { error: updateError } = await supabase
        .from('customers')
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq('id', params.id)

      if (updateError) throw updateError

      // 2. Kontakları Güncelle/Ekle
      // ID'si olanları güncelle, olmayanları ekle
      for (const contact of contacts) {
        if (!contact.name) continue // İsmi boş olanı atla

        const contactData = {
          customer_id: params.id,
          name: contact.name,
          role: contact.role,
          email: contact.email,
          phone: contact.phone
        }

        if (contact.id) {
          // Güncelle
          await supabase.from('customer_contacts').update(contactData).eq('id', contact.id)
        } else {
          // Ekle
          await supabase.from('customer_contacts').insert(contactData)
        }
      }

      router.push('/customers')
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
        <h1 className="text-3xl font-bold mb-6">Müşteriyi Düzenle</h1>
        {error && <div className="bg-red-50 p-4 mb-4 text-red-700 rounded flex gap-2"><AlertCircle className="w-5 h-5"/>{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Firma ve Adres Bilgileri (Yeni Ekle ile aynı yapı) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card space-y-4">
                <h2 className="font-semibold text-lg">Firma Bilgileri</h2>
                <div><label className="text-sm font-medium block mb-1">Firma Adı *</label><input name="name" value={formData.name} onChange={(e)=>setFormData({...formData, name:e.target.value})} required className="input-field" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium block mb-1">Vergi Dairesi</label><input name="tax_office" value={formData.tax_office} onChange={(e)=>setFormData({...formData, tax_office:e.target.value})} className="input-field" /></div>
                  <div><label className="text-sm font-medium block mb-1">Vergi No</label><input name="tax_number" value={formData.tax_number} onChange={(e)=>setFormData({...formData, tax_number:e.target.value})} className="input-field" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium block mb-1">Genel Telefon</label><input name="phone" value={formData.phone} onChange={(e)=>setFormData({...formData, phone:e.target.value})} className="input-field" /></div>
                  <div><label className="text-sm font-medium block mb-1">Genel Email</label><input name="email" value={formData.email} onChange={(e)=>setFormData({...formData, email:e.target.value})} className="input-field" /></div>
                </div>
              </div>

              <div className="card space-y-4">
                <h2 className="font-semibold text-lg">Adres & Durum</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium block mb-1">Şehir</label><input name="city" value={formData.city} onChange={(e)=>setFormData({...formData, city:e.target.value})} className="input-field" /></div>
                  <div><label className="text-sm font-medium block mb-1">Ülke</label><input name="country" value={formData.country} onChange={(e)=>setFormData({...formData, country:e.target.value})} className="input-field" /></div>
                </div>
                <div><label className="text-sm font-medium block mb-1">Açık Adres</label><textarea name="address" value={formData.address} onChange={(e)=>setFormData({...formData, address:e.target.value})} rows={3} className="input-field" /></div>
                <div>
                  <label className="text-sm font-medium block mb-1">Durum</label>
                  <select name="status" value={formData.status} onChange={(e)=>setFormData({...formData, status:e.target.value})} className="input-field">
                    <option value="active">Aktif</option><option value="inactive">Pasif</option>
                  </select>
                </div>
              </div>
            </div>

          {/* Kontaklar */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2"><User className="w-5 h-5 text-blue-600"/> İlgili Kişiler</h2>
              <button type="button" onClick={addContact} className="btn-secondary text-sm py-1 px-3 flex items-center gap-2"><UserPlus className="w-4 h-4"/> Ekle</button>
            </div>
            <div className="space-y-3">
              {contacts.map((contact, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-3 items-start p-3 bg-gray-50 rounded border">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 w-full">
                    <input placeholder="Ad Soyad" value={contact.name} onChange={(e)=>handleContactChange(index, 'name', e.target.value)} className="input-field" />
                    <input placeholder="Departman" value={contact.role} onChange={(e)=>handleContactChange(index, 'role', e.target.value)} className="input-field" />
                    <input placeholder="Email" value={contact.email} onChange={(e)=>handleContactChange(index, 'email', e.target.value)} className="input-field" />
                    <input placeholder="Telefon" value={contact.phone} onChange={(e)=>handleContactChange(index, 'phone', e.target.value)} className="input-field" />
                  </div>
                  <button type="button" onClick={() => removeContact(index)} className="text-red-500 p-2 mt-1 md:mt-0"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
             <button type="button" onClick={() => router.push('/customers')} className="btn-secondary"><X className="w-4 h-4 mr-2"/> İptal</button>
             <button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4 mr-2"/> Güncelle</button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
