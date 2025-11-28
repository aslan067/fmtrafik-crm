'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  Search, Filter, Plus, FileText, Eye, 
  ChevronDown, Calendar, User, TrendingUp, 
  Wallet, Truck, CheckCircle, Clock, AlertCircle
} from 'lucide-react'

export default function SalesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState([])
  
  // Filtre State'leri
  const [searchTerm, setSearchTerm] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [deliveryFilter, setDeliveryFilter] = useState('all')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      const { data, error } = await supabase
        .from('sales')
        .select('*, customers(name)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSales(data || [])

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // --- Yardımcı Fonksiyonlar ---

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }

  const getPaymentBadge = (status) => {
    const styles = {
      paid: 'bg-green-100 text-green-700 border-green-200',
      partial: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      unpaid: 'bg-red-100 text-red-700 border-red-200',
    }
    const labels = {
      paid: 'Ödendi',
      partial: 'Kısmi',
      unpaid: 'Ödenmedi',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 w-fit ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {status === 'paid' ? <CheckCircle className="w-3 h-3"/> : status === 'unpaid' ? <AlertCircle className="w-3 h-3"/> : <Clock className="w-3 h-3"/>}
        {labels[status] || status}
      </span>
    )
  }

  const getDeliveryBadge = (status) => {
    const styles = {
      delivered: 'bg-blue-100 text-blue-700',
      shipped: 'bg-purple-100 text-purple-700',
      pending: 'bg-orange-100 text-orange-700',
    }
    const labels = {
      delivered: 'Teslim Edildi',
      shipped: 'Sevk Edildi',
      pending: 'Hazırlanıyor',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {labels[status] || status}
      </span>
    )
  }

  // --- Filtreleme Mantığı ---
  const filteredSales = sales.filter(sale => {
    const matchesSearch = 
      sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.invoice_number && sale.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesPayment = paymentFilter === 'all' || sale.payment_status === paymentFilter
    const matchesDelivery = deliveryFilter === 'all' || sale.delivery_status === deliveryFilter
    
    return matchesSearch && matchesPayment && matchesDelivery
  })

  // --- İstatistikler ---
  const stats = {
    totalRevenue: sales.reduce((sum, s) => sum + (s.currency === 'TRY' ? s.total_amount : s.total_amount * s.exchange_rate), 0),
    pendingPayment: sales.filter(s => s.payment_status !== 'paid').length,
    pendingDelivery: sales.filter(s => s.delivery_status === 'pending').length,
    totalCount: sales.length
  }

  if (loading) return <DashboardLayout><div className="flex justify-center items-center h-full">Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Başlık ve Buton */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Satışlar & Siparişler</h1>
              <p className="text-gray-600 mt-1">Gerçekleşen satışları, faturaları ve teslimatları yönetin.</p>
            </div>
            {/* Doğrudan satış oluşturma butonu şimdilik deaktif veya manuel satış için açılabilir */}
            {/* <button className="btn-primary flex items-center gap-2"><Plus className="w-5 h-5" /> Manuel Satış Gir</button> */}
          </div>

          {/* KPI Kartları */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="card border-l-4 border-green-500 flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-gray-500 font-medium">Toplam Ciro (Tahmini TL)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  ₺{stats.totalRevenue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-full"><TrendingUp className="w-6 h-6 text-green-600"/></div>
            </div>
            
            <div className="card border-l-4 border-red-500 flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-gray-500 font-medium">Tahsilat Bekleyen</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pendingPayment} <span className="text-sm font-normal text-gray-400">Sipariş</span></p>
              </div>
              <div className="p-3 bg-red-50 rounded-full"><Wallet className="w-6 h-6 text-red-600"/></div>
            </div>

            <div className="card border-l-4 border-orange-500 flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-gray-500 font-medium">Teslimat Bekleyen</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pendingDelivery} <span className="text-sm font-normal text-gray-400">Sipariş</span></p>
              </div>
              <div className="p-3 bg-orange-50 rounded-full"><Truck className="w-6 h-6 text-orange-600"/></div>
            </div>

            <div className="card border-l-4 border-blue-500 flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-gray-500 font-medium">Toplam Satış Adedi</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalCount}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full"><FileText className="w-6 h-6 text-blue-600"/></div>
            </div>
          </div>

          {/* Filtreleme ve Arama */}
          <div className="card mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Satış ara... (Sipariş No, Müşteri, Fatura No)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
              <button onClick={() => setFilterOpen(!filterOpen)} className={`btn-secondary flex items-center gap-2 ${filterOpen ? 'bg-gray-200' : ''}`}>
                <Filter className="w-5 h-5" /> Filtrele <ChevronDown className={`w-4 h-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {filterOpen && (
              <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ödeme Durumu</label>
                  <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="input-field">
                    <option value="all">Tümü</option>
                    <option value="paid">Ödendi (Paid)</option>
                    <option value="partial">Kısmi (Partial)</option>
                    <option value="unpaid">Ödenmedi (Unpaid)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Teslimat Durumu</label>
                  <select value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value)} className="input-field">
                    <option value="all">Tümü</option>
                    <option value="pending">Hazırlanıyor</option>
                    <option value="shipped">Sevk Edildi</option>
                    <option value="delivered">Teslim Edildi</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Liste Tablosu */}
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 uppercase font-bold text-xs">
                  <tr>
                    <th className="px-6 py-4">Satış No</th>
                    <th className="px-6 py-4">Müşteri</th>
                    <th className="px-6 py-4">Tarih</th>
                    <th className="px-6 py-4 text-right">Tutar</th>
                    <th className="px-6 py-4 text-center">Ödeme</th>
                    <th className="px-6 py-4 text-center">Teslimat</th>
                    <th className="px-6 py-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSales.length === 0 ? (
                    <tr><td colSpan="7" className="text-center py-10 text-gray-500">Kayıt bulunamadı.</td></tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => router.push(`/sales/${sale.id}`)}>
                        <td className="px-6 py-4 font-bold text-blue-600">
                          {sale.sale_number}
                          {sale.invoice_number && <div className="text-xs text-gray-400 font-normal mt-0.5">Inv: {sale.invoice_number}</div>}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{sale.customers?.name}</td>
                        <td className="px-6 py-4 text-gray-500">{new Date(sale.created_at).toLocaleDateString('tr-TR')}</td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                          {currencySymbols[sale.currency]}{parseFloat(sale.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-center flex justify-center">{getPaymentBadge(sale.payment_status)}</td>
                        <td className="px-6 py-4 text-center">{getDeliveryBadge(sale.delivery_status)}</td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                            <Eye className="w-5 h-5" />
                          </button>
                        </td>
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
