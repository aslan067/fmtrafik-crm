'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, ArrowLeft, FileText, AlertCircle, Globe } from 'lucide-react'

export default function QuoteSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [activeTab, setActiveTab] = useState('tr') // 'tr' | 'en'
  
  const [terms, setTerms] = useState({
    tr: '',
    en: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()
      
      const { data: company } = await supabase
        .from('companies')
        .select('default_terms_tr, default_terms_en, default_quote_terms')
        .eq('id', profile.company_id)
        .single()

      setTerms({
        tr: company?.default_terms_tr || company?.default_quote_terms || '1. Teklifimiz 15 gün geçerlidir.\n2. Teslimat süresi sipariş onayından itibaren 3 iş günüdür.\n3. Fiyatlara KDV dahil değildir.',
        en: company?.default_terms_en || '1. This offer is valid for 15 days.\n2. Delivery time is 3 business days from order confirmation.\n3. VAT is not included in prices.'
      })
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
        .update({ 
          default_terms_tr: terms.tr,
          default_terms_en: terms.en
        })
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
            <p className="text-gray-600">Şablonlara göre otomatik gelecek varsayılan şartlar</p>
          </div>

          {message.text && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              <AlertCircle className="w-5 h-5" /> {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="card min-h-[500px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="w-5 h-5 text-yellow-600"/> Varsayılan Teklif Şartları</h3>
              
              {/* Dil Sekmeleri */}
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab('tr')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'tr' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  🇹🇷 Türkçe
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('en')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'en' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  🇬🇧 İngilizce <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded">İhracat</span>
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-700">
                {activeTab === 'tr' ? 'Şartlar ve Koşullar (TR)' : 'Terms and Conditions (EN)'}
              </label>
              
              {activeTab === 'tr' ? (
                <textarea 
                  value={terms.tr} 
                  onChange={(e) => setTerms({...terms, tr: e.target.value})} 
                  rows={12} 
                  className="input-field font-mono text-sm"
                  placeholder="1. Teklifimiz..."
                />
              ) : (
                <textarea 
                  value={terms.en} 
                  onChange={(e) => setTerms({...terms, en: e.target.value})} 
                  rows={12} 
                  className="input-field font-mono text-sm"
                  placeholder="1. This offer is valid..."
                />
              )}
              
              <p className="text-xs text-gray-500 mt-2">
                {activeTab === 'tr' 
                  ? 'Standart Türkçe şablon seçildiğinde bu metin otomatik gelir.' 
                  : 'Standart İngilizce veya İhracat şablonu seçildiğinde bu metin otomatik gelir.'}
              </p>
            </div>

            <div className="flex justify-end border-t pt-4">
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
