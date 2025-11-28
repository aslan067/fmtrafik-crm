'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  Search, Plus, Filter, ChevronDown, Package, 
  Truck, CheckCircle, AlertTriangle, Clock, 
  FileText, TrendingUp, XCircle, DollarSign
} from 'lucide-react'

export default function PurchasesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  
  // Filtreler
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all, active, waiting_invoice, completed

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

  // --- İSTATİSTİKLER (KPI) ---
  const stats = {
    // Aktif: Sipariş verildi veya Kısmi geldi (Henüz tamamlanmadı)
    activeOrders: orders.filter(o => ['ordered', 'partial'].includes(o.status)).length,
    
    // Fatura Bekleyen: Depo malı aldı (received) ama muhasebe kapatmadı (henüz completed değil)
    waitingInvoice: orders.filter(o => o.status === 'received').length,
    
    // Toplam Harcama (Basitçe TRY bazlı topluyoruz, çoklu kur varsa çevrilmeli)
    totalVolume: orders.reduce((acc, curr) => acc + (curr.currency === 'TRY' ? curr.total_amount : 0), 0)
  }

  // --- FİLTRELEME MANTIĞI ---
  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.suppliers?.name.toLowerCase().includes(searchTerm.toLowerCase())

    let matchesStatus = true
    if (statusFilter === 'active') matchesStatus = ['ordered', 'partial'].includes(o.status)
    if (statusFilter === 'waiting_invoice') matchesStatus = o.status === 'received'
    if (statusFilter === 'completed') matchesStatus = o.status === 'completed'
    if (statusFilter === 'cancelled') matchesStatus = o.status === 'cancelled'

    return matchesSearch && matchesStatus
  })

  // --- GÖRSEL YARDIMCILAR ---
  const getStatusBadge = (status) => {
    const styles = {
      draft:     { css: 'bg-gray-100 text-gray-600', label: 'Taslak', icon: Clock },
      ordered:   { css: 'bg-blue-100 text-blue-700', label: 'Yolda / Sipariş', icon: Truck },
      partial:   { css: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200', label: 'Kısmi Teslimat', icon: AlertTriangle },
      received:  { css: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200', label: 'Fatura Bekliyor', icon: FileText },
      completed: { css: 'bg-green-100 text-green-700', label: 'Tamamlandı', icon: CheckCircle },
      cancelled: { css: 'bg-red-50 text-red-600', label: 'İptal', icon: XCircle }
    }
    
    const conf = styles[status] || styles.draft
    const Icon = conf.icon

    return (
      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border border-transparent flex items-center gap-1.5 w-fit ${conf.css}`}>
        <Icon className="w-3.5 h-3.5"/> {conf.label}
      </span>
    )
  }

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }

  return (
    <DashboardLayout>
      <div className="p-6 bg-gray-50/50 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Başlık ve Aksiyon */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Satınalma Yönetimi</h1>
              <p className="text-gray-500 mt-1 text-sm">Tedarikçi siparişlerini, depo girişlerini ve faturaları takip edin.</p>
            </div>
            <button 
              onClick={() => router.push('/purchases/new')} 
              className="btn-primary flex items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
            >
              <Plus className="w-5 h-5" /> Yeni Sipariş Oluştur
            </button>
          </div>

          {/* KPI Kartları */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Aktif Siparişler</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeOrders}</p>
                <p className="text-xs text-blue-600 mt-1 font-medium">Teslimat bekleniyor</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><Truck className="w-6 h-6"/></div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fatura Bekleyen</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.waitingInvoice}</p>
                <p className="text-xs text-purple-600 mt-1 font-medium">Depoya indi, fatura girilmedi</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg text-purple-600"><FileText className="w-6 h-6"/></div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Toplam Hacim (TRY)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">₺{stats.totalVolume.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-green-600 mt-1 font-medium">Bu yılın toplamı</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-green-600"><TrendingUp className="w-6 h-6"/></div>
            </div>
          </div>

          {/* Filtreleme Barı */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Sipariş No, Tedarikçi Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: 'all', label: 'Tümü' },
                { id: 'active', label: 'Yolda/Eksik', count: stats.activeOrders },
                { id: 'waiting_invoice', label: 'Fatura Bekleyen', count: stats.waitingInvoice },
                { id: 'completed', label: 'Tamamlanan' },
                { id: 'cancelled', label: 'İptal' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border ${
                    statusFilter === tab.id 
                      ? 'bg-gray-900 text-white border-gray-900 shadow-md' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[10px]">{tab.count}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Liste */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-xs border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Sipariş No</th>
                    <th className="px-6 py-4">Tedarikçi</th>
                    <th className="px-6 py-4">Oluşturma / Teslimat</th>
                    <th className="px-6 py-4 text-right">Tutar</th>
                    <th className="px-6 py-4 text-center">İşlem Durumu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan="5" className="text-center py-12 text-gray-500">Yükleniyor...</td></tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-16">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <Package className="w-12 h-12 mb-3 opacity-20"/>
                          <p className="text-lg font-medium">Kayıt Bulunamadı</p>
                          <p className="text-sm">Arama kriterlerinize uygun sipariş yok.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-blue-50/40 cursor-pointer transition-colors group" onClick={() => router.push(`/purchases/${order.id}`)}>
                        <td className="px-6 py-4">
                           <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{order.order_number}</div>
                           {order.invoice_number && (
                             <div className="text-[10px] text-purple-600 font-medium bg-purple-50 px-1.5 py-0.5 rounded w-fit mt-1 border border-purple-100">
                               Fat: {order.invoice_number}
                             </div>
                           )}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-700">{order.suppliers?.name}</td>
                        <td className="px-6 py-4 text-gray-500">
                          <div className="flex flex-col">
                            <span>{new Date(order.created_at).toLocaleDateString('tr-TR')}</span>
                            <span className="text-xs text-gray-400 mt-0.5">Teslimat: {order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString('tr-TR') : '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900 font-mono">
                          {currencySymbols[order.currency]}{parseFloat(order.total_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}
                        </td>
                        <td className="px-6 py-4 flex justify-center">{getStatusBadge(order.status)}</td>
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
