'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { Search, Filter, Plus, FileText, Eye, Edit, ChevronDown } from 'lucide-react'

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

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      converted: 'bg-purple-100 text-purple-800',
    }

    const labels = {
      draft: 'Taslak',
      sent: 'Gönderildi',
      approved: 'Onaylandı',
      rejected: 'Reddedildi',
      converted: 'Satışa Dönüştü',
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = 
      quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.customers?.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = !selectedStatus || quote.status === selectedStatus
    
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: quotes.length,
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    approved: quotes.filter(q => q.status === 'approved').length,
    rejected: quotes.filter(q => q.status === 'rejected').length,
    totalAmount: quotes
      .filter(q => q.status === 'approved')
      .reduce((sum, q) => sum + parseFloat(q.total_amount || 0), 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Teklifler</h1>
            <p className="text-gray-600 mt-1">Teklif oluşturun ve takip edin</p>
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="card">
            <p className="text-sm text-gray-600">Toplam Teklif</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Taslak</p>
            <p className="text-2xl font-bold text-gray-600 mt-1">{stats.draft}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Gönderildi</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.sent}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Onaylandı</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.approved}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Onaylı Tutar</p>
            <p className="text-xl font-bold text-purple-600 mt-1">
              ₺{stats.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
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
                placeholder="Teklif ara... (Teklif no, müşteri adı)"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tarih Aralığı</label>
                <select className="input-field">
                  <option value="">Tümü</option>
                  <option value="today">Bugün</option>
                  <option value="week">Bu Hafta</option>
                  <option value="month">Bu Ay</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sıralama</label>
                <select className="input-field">
                  <option value="date-desc">Tarih (Yeni-Eski)</option>
                  <option value="date-asc">Tarih (Eski-Yeni)</option>
                  <option value="amount-desc">Tutar (Yüksek-Düşük)</option>
                  <option value="amount-asc">Tutar (Düşük-Yüksek)</option>
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
          <div className="space-y-4">
            {filteredQuotes.map(quote => (
              <div key={quote.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {quote.quote_number}
                      </h3>
                      {getStatusBadge(quote.status)}
                    </div>
                    <p className="text-gray-600 mb-1">
                      <span className="font-medium">Müşteri:</span> {quote.customers?.name}
                    </p>
                    {quote.title && (
                      <p className="text-sm text-gray-500 mb-1">{quote.title}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        Tarih: {new Date(quote.created_at).toLocaleDateString('tr-TR')}
                      </span>
                      {quote.valid_until && (
                        <span>
                          Geçerlilik: {new Date(quote.valid_until).toLocaleDateString('tr-TR')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Toplam Tutar</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ₺{parseFloat(quote.total_amount || 0).toLocaleString('tr-TR', { 
                          minimumFractionDigits: 2 
                        })}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => router.push(`/quotes/${quote.id}`)}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Görüntüle
                      </button>
                      {quote.status === 'draft' && (
                        <button 
                          onClick={() => router.push(`/quotes/${quote.id}/edit`)}
                          className="px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Düzenle
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
