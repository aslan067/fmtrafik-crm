'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Plus, Trash2, ArrowLeft, CreditCard } from 'lucide-react'

export default function BankSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [banks, setBanks] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Yeni Banka Formu
  const [newBank, setNewBank] = useState({
    bank_name: '', branch_name: '', account_name: '', iban: '', currency: 'TRY'
  })

  useEffect(() => {
    loadBanks()
  }, [])

  async function loadBanks() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()
      const { data } = await supabase.from('company_bank_accounts').select('*').eq('company_id', profile.company_id).eq('is_active', true)
      setBanks(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddBank(e) {
    e.preventDefault()
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()
      
      const { error } = await supabase.from('company_bank_accounts').insert([{
        ...newBank,
        company_id: profile.company_id
      }])

      if (error) throw error
      
      setIsModalOpen(false)
      setNewBank({ bank_name: '', branch_name: '', account_name: '', iban: '', currency: 'TRY' })
      loadBanks()
    } catch (err) {
      alert('Ekleme hatası: ' + err.message)
    }
  }

  async function handleDelete(id) {
    if(!confirm('Silmek istediğinize emin misiniz?')) return
    try {
      await supabase.from('company_bank_accounts').delete().eq('id', id)
      loadBanks()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <DashboardLayout><div className="p-6">Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <button onClick={() => router.push('/settings')} className="text-gray-500 hover:text-gray-900 flex items-center gap-2 mb-2">
                <ArrowLeft className="w-4 h-4" /> Ayarlara Dön
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Banka Hesapları</h1>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" /> Yeni Hesap Ekle
            </button>
          </div>

          <div className="grid gap-4">
            {banks.map(bank => (
              <div key={bank.id} className="card flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{bank.bank_name} <span className="text-xs bg-gray-100 px-2 py-1 rounded ml-2">{bank.currency}</span></h3>
                    <p className="text-sm text-gray-600 font-mono mt-1">{bank.iban}</p>
                    <p className="text-xs text-gray-400">{bank.branch_name} - {bank.account_name}</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(bank.id)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            {banks.length === 0 && <div className="text-center py-10 text-gray-500">Henüz banka hesabı eklenmemiş.</div>}
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Yeni Banka Hesabı</h2>
              <form onSubmit={handleAddBank} className="space-y-4">
                <div><label className="text-sm font-medium block mb-1">Banka Adı</label><input value={newBank.bank_name} onChange={e=>setNewBank({...newBank, bank_name:e.target.value})} required className="input-field" placeholder="Garanti BBVA"/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium block mb-1">Şube Adı</label><input value={newBank.branch_name} onChange={e=>setNewBank({...newBank, branch_name:e.target.value})} className="input-field"/></div>
                  <div><label className="text-sm font-medium block mb-1">Para Birimi</label>
                    <select value={newBank.currency} onChange={e=>setNewBank({...newBank, currency:e.target.value})} className="input-field">
                      <option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
                <div><label className="text-sm font-medium block mb-1">Hesap Sahibi</label><input value={newBank.account_name} onChange={e=>setNewBank({...newBank, account_name:e.target.value})} className="input-field"/></div>
                <div><label className="text-sm font-medium block mb-1">IBAN</label><input value={newBank.iban} onChange={e=>setNewBank({...newBank, iban:e.target.value})} required className="input-field" placeholder="TR..."/></div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">İptal</button>
                  <button type="submit" className="btn-primary">Kaydet</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
