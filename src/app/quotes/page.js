'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  Search, Filter, Plus, FileText, Eye, Edit, 
  ChevronDown, Calendar, User, CheckCircle, XCircle, Clock, Send
} from 'lucide-react'

export default function QuotesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [quotes, setQuotes] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('')

  useEffect(() => {
    loadQuotes()
  }, [])

  async function loadQuotes() {
    try {
      const user = await getCurrentUser()
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const { data, error } = await supabase
        .from('quotes')
        .select('*, customers(name)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setQuotes(data || [])
    } catch (error) {
      console.error('Error loading quotes:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusConfig = (status) => {
    const configs = {
      draft: { label: 'Taslak', color: 'bg-gray-100 text-gray-700', icon: Clock },
      sent: { label: 'Gönderildi', color: 'bg-blue-100 text-blue-700', icon: Send },
      approved: { label: 'Onaylandı', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      rejected: { label: 'Reddedildi', color: 'bg-red-100 text-red-700', icon: XCircle },
      converted: { label: 'Satışa Döndü', color: 'bg-purple-100 text-purple-700', icon: FileText },
    }
    return configs[status] || configs.draft
  }

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = 
      quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (quote.title && quote.title.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = !selectedStatus || quote.status === selectedStatus
    
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: quotes.length,
    pending: quotes.filter(q => ['draft', 'sent'].includes(q.status)).length,
    approved: quotes.filter(q => q.status === 'approved').length,
    totalValue: quotes
      .filter(q => q.status !== 'rejected')
      .reduce((sum, q) => sum + parseFloat(q.total_amount || 0), 0)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Teklifler</h1>
              <p className="text-gray-600 mt-1">Satış fırsatlarını ve teklifleri yönetin</p>
            </div>
            <button 
              onClick={() => router.push('/quotes/new')}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Yeni Teklif
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="card border-l-4 border-blue-500">
              <p className="text-sm text-gray-600">Toplam Teklif</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="card border-l-4 border-yellow-500">
              <p className="text-sm text-gray-600">Bekleyen</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
            </div>
            <div className="card border-l-4 border-green-500">
              <p className="text-sm text-gray-600">Onaylanan</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.approved}</p>
            </div>
            <div className="card border-l-4 border-purple-500">
              <p className="text-sm text-gray-600">Potansiyel Ciro</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                ₺{stats.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Teklif ara... (No, Müşteri, Başlık)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="btn-secondary flex items-center gap-2"
              >
                <Filter className="w-5 h-5" />
                Filtrele
                <ChevronDown className={`w-4 h-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {filterOpen && (
              <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Durum</label>
                  <select 
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Tümü</option>
                    <option value="draft">Taslak</option>
                    <option value="sent">Gönderildi</option>
                    <option value="approved">Onaylandı</option>
                    <option value="rejected">Reddedildi</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Quotes List */}
          {filteredQuotes.length === 0 ? (
            <div className="card text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedStatus ? 'Teklif bulunamadı' : 'Henüz teklif oluşturulmamış'}
              </p>
              <button 
                onClick={() => router.push('/quotes/new')}
                className="btn-primary"
              >
                İlk Teklifi Oluştur
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQuotes.map(quote => {
                const statusConfig = getStatusConfig(quote.status)
                const StatusIcon = statusConfig.icon

                return (
                  <div 
                    key={quote.id} 
                    className="card hover:shadow-md transition-all cursor-pointer group border border-transparent hover:border-blue-200 p-4"
                    onClick={() => router.push(`/quotes/${quote.id}`)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      {/* Sol: İkon ve Temel Bilgi */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {quote.quote_number}
                            </h3>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusConfig.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{quote.customers?.name}</span>
                          </div>
                          {quote.title && (
                            <p className="text-sm text-gray-500 mt-1">{quote.title}</p>
                          )}
                        </div>
                      </div>

                      {/* Orta: Tarih ve Tutar */}
                      <div className="flex items-center gap-8 md:justify-end flex-1">
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-1 flex items-center justify-end gap-1">
                            <Calendar className="w-3 h-3" /> Tarih
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(quote.created_at).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <p className="text-xs text-gray-500 mb-1">Toplam Tutar</p>
                          <p className="text-lg font-bold text-gray-900">
                            ₺{parseFloat(quote.total_amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {/* Sağ: Aksiyonlar */}
                      <div className="flex gap-2 border-l pl-4 border-gray-100 md:ml-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); router.push(`/quotes/${quote.id}`) }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Görüntüle"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {quote.status === 'draft' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); router.push(`/quotes/${quote.id}/edit`) }}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Düzenle"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
