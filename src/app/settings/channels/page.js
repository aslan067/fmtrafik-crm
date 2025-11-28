'use client'

import { useState, useEffect } from 'react'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, Plus, Trash2, HelpCircle } from 'lucide-react'

export default function ChannelSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [channels, setChannels] = useState([])

  useEffect(() => {
    loadChannels()
  }, [])

  async function loadChannels() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()
      
      const { data } = await supabase
        .from('sales_channels')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at')

      if (data && data.length > 0) {
        setChannels(data)
      } else {
        // Varsayılan kanalları öner
        setChannels([
          { name: 'Kendi Sitem (TrafikGerecleri)', type: 'ecommerce', commission_rate: 3, profit_margin: 30, cargo_base_fee: 40, cargo_desi_multiplier: 0 },
          { name: 'Trendyol', type: 'marketplace', commission_rate: 21, profit_margin: 20, cargo_base_fee: 35, cargo_desi_multiplier: 5 },
          { name: 'Hepsiburada', type: 'marketplace', commission_rate: 19, profit_margin: 20, cargo_base_fee: 35, cargo_desi_multiplier: 5 },
        ])
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    const user = await getCurrentUser()
    const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

    const cleanData = channels.map(c => ({
      ...c,
      company_id: profile.company_id,
      id: c.id?.length > 10 ? c.id : undefined // Yeni eklenenlerin ID'si yoksa undefined yap
    }))

    const { error } = await supabase.from('sales_channels').upsert(cleanData)
    if (error) alert('Hata: ' + error.message)
    else alert('Kanal ayarları kaydedildi.')
    loadChannels()
  }

  const addChannel = () => {
    setChannels([...channels, { name: 'Yeni Kanal', type: 'marketplace', commission_rate: 0, profit_margin: 20, cargo_base_fee: 0, cargo_desi_multiplier: 0 }])
  }

  const removeChannel = async (index, id) => {
    if (id) {
        await supabase.from('sales_channels').delete().eq('id', id)
    }
    const newChannels = [...channels]
    newChannels.splice(index, 1)
    setChannels(newChannels)
  }

  const handleChange = (index, field, value) => {
    const newChannels = [...channels]
    newChannels[index][field] = value
    setChannels(newChannels)
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Satış Kanalları & Fiyatlandırma</h1>
            <p className="text-gray-500">Pazaryerleri için komisyon, kargo ve kâr marjı kurallarını belirleyin.</p>
          </div>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2"><Save className="w-4 h-4"/> Ayarları Kaydet</button>
        </div>

        <div className="space-y-4">
          {channels.map((channel, idx) => (
            <div key={idx} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative group">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                
                <div className="lg:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Kanal Adı</label>
                  <input type="text" className="input-field" value={channel.name} onChange={(e) => handleChange(idx, 'name', e.target.value)} />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Komisyon (%)</label>
                  <input type="number" className="input-field" value={channel.commission_rate} onChange={(e) => handleChange(idx, 'commission_rate', e.target.value)} />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Hedef Kâr (%)</label>
                  <input type="number" className="input-field" value={channel.profit_margin} onChange={(e) => handleChange(idx, 'profit_margin', e.target.value)} />
                </div>

                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1" title="Baz Kargo + (Desi * Çarpan)">
                     Kargo Maliyeti <HelpCircle className="w-3 h-3 text-gray-400"/>
                   </label>
                   <div className="flex gap-1">
                      <input type="number" className="input-field" placeholder="Sabit" value={channel.cargo_base_fee} onChange={(e) => handleChange(idx, 'cargo_base_fee', e.target.value)} />
                      <input type="number" className="input-field" placeholder="Desi x" value={channel.cargo_desi_multiplier} onChange={(e) => handleChange(idx, 'cargo_desi_multiplier', e.target.value)} />
                   </div>
                </div>

                <div className="flex justify-end">
                    <button onClick={() => removeChannel(idx, channel.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-5 h-5"/></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={addChannel} className="mt-6 btn-secondary w-full border-dashed border-2 py-4 flex justify-center items-center gap-2">
           <Plus className="w-5 h-5"/> Yeni Kanal Ekle
        </button>
      </div>
    </DashboardLayout>
  )
}
