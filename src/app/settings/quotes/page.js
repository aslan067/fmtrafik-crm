'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, ArrowLeft, FileText, AlertCircle } from 'lucide-react'

export default function QuoteSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  const [defaultTerms, setDefaultTerms] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()
      
      const { data: company } = await supabase
        .from('companies')
        .select('default_quote_terms')
        .eq('id', profile.company_id)
        .single()

      setDefaultTerms(company?.default_quote_terms || '1. Teklifimiz 15 gün geçerlidir.\n2. Teslimat süresi sipariş onayından itibaren 3 iş günüdür.\n3. Fiyatlara KDV dahil değildir.')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      const { error } = await supabase
        .from('companies')
        .update({ default_quote_terms: defaultTerms })
        .eq('id', profile.company_id)

      if (error) throw error
      setMessage({ type: 'success', text: 'Varsayılan şartlar kaydedildi' })
    } catch (err) {
      setMessage({ type: 'error', text: 'Hata: ' + err.message })
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
            <h1 className="text-3xl font-bold text-gray-900">Teklif Ayarları</h1>
            <p className="text-gray-600">Yeni teklif oluştururken otomatik gelecek varsayılan değerler</p>
          </div>

          {message.text && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              <AlertCircle className="w-5 h-5" /> {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-yellow-600"/> Varsayılan Teklif Şartları</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-700">Şartlar ve Koşullar</label>
              <textarea 
                value={defaultTerms} 
                onChange={(e) => setDefaultTerms(e.target.value)} 
                rows={10} 
                className="input-field font-mono text-sm"
                placeholder="Madde 1..."
              />
              <p className="text-xs text-gray-500 mt-2">Her yeni teklif oluşturduğunuzda bu metin otomatik olarak gelecektir. Teklif bazında değiştirebilirsiniz.</p>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? 'Kaydediliyor...' : <><Save className="w-4 h-4" /> Ayarları Kaydet</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
