'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  Search, Plus, Filter, ChevronDown, Package, 
  Truck, CheckCircle, AlertCircle, Clock
} from 'lucide-react'

export default function PurchasesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(name)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Veri çekme hatası:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-600',
      ordered: 'bg-blue-100 text-blue-700',
      received: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    }
    const labels = {
      draft: 'Taslak',
      ordered: 'Sipariş Verildi',
      received: 'Mal Kabul Yapıldı',
      cancelled: 'İptal'
    }
    
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border border-transparent ${styles[status]}`}>
        {labels[status] || status}
      </span>
    )
  }

  const filteredOrders = orders.filter(o => 
    o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.suppliers?.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Satınalma & Tedarik</h1>
              <p className="text-gray-600 mt-1">Tedarikçi siparişlerini ve stok girişlerini yönetin.</p>
            </div>
            <button onClick={() => router.push('/purchases/new')} className="btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" /> Yeni Sipariş Oluştur
            </button>
          </div>

          <div className="card mb-6">
            <div className="flex gap-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Sipariş No veya Tedarikçi Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>

          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 uppercase font-bold text-xs">
                  <tr>
                    <th className="px-6 py-4">Sipariş No</th>
                    <th className="px-6 py-4">Tedarikçi</th>
                    <th className="px-6 py-4">Tarih</th>
                    <th className="px-6 py-4">Teslim Tarihi</th>
                    <th className="px-6 py-4 text-right">Tutar</th>
                    <th className="px-6 py-4 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan="6" className="text-center py-10">Yükleniyor...</td></tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-10 text-gray-500">Henüz bir satınalma siparişi yok.</td></tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => router.push(`/purchases/${order.id}`)}>
                        <td className="px-6 py-4 font-bold text-blue-600">{order.order_number}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">{order.suppliers?.name}</td>
                        <td className="px-6 py-4 text-gray-500">{new Date(order.created_at).toLocaleDateString('tr-TR')}</td>
                        <td className="px-6 py-4 text-gray-500">
                          {order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString('tr-TR') : '-'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                          {currencySymbols[order.currency]}{parseFloat(order.total_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}
                        </td>
                        <td className="px-6 py-4 text-center">{getStatusBadge(order.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}
