'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  ArrowLeft, Edit, Plus, Mail, Phone, MapPin, Building, 
  FileText, DollarSign, Calendar, TrendingUp, Eye 
} from 'lucide-react'

export default function CustomerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [sales, setSales] = useState([])

  useEffect(() => {
    loadCustomerData()
  }, [params.id])

  async function loadCustomerData() {
    try {
      const user = await getCurrentUser()
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      // Müşteri bilgilerini yükle
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', params.id)
        .eq('company_id', profile.company_id)
        .single()

      if (customerError) throw customerError
      setCustomer(customerData)

      // Müşteriye ait teklifleri yükle
      const { data: quotesData } = await supabase
        .from('quotes')
        .select('*')
        .eq('customer_id', params.id)
        .order('created_at', { ascending: false })

      setQuotes(quotesData || [])

      // Müşteriye ait satışları yükle
      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .eq('customer_id', params.id)
        .order('created_at', { ascending: false })

      setSales(salesData || [])

    } catch (error) {
      console.error('Error loading customer:', error)
      alert('Müşteri yüklenirken hata oluştu')
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status, type) => {
    const styles = {
      quote: {
        draft: 'bg-gray-100 text-gray-800',
        sent: 'bg-blue-100 text-blue-800',
        approved: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
      },
      sale: {
        pending: 'bg-yellow-100 text-yellow-800',
        invoiced: 'bg-blue-100 text-blue-800',
        paid: 'bg-green-100 text-green-800',
      }
    }

    const labels = {
      quote: {
        draft: 'Taslak',
        sent: 'Gönderildi',
        approved: 'Onaylandı',
        rejected: 'Reddedildi',
      },
      sale: {
        pending: 'Beklemede',
        invoiced: 'Faturalandı',
        paid: 'Ödendi',
      }
    }

    const colorClass = styles[type]?.[status] || 'bg-gray-100 text-gray-800'
    const label = labels[type]?.[status] || status

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {label}
      </span>
    )
  }

  // İstatistikler
  const stats = {
    totalQuotes: quotes.length,
    approvedQuotes: quotes.filter(q => q.status === 'approved').length,
    totalQuoteAmount: quotes
      .filter(q => q.status === 'approved')
      .reduce((sum, q) => sum + parseFloat(q.total_amount || 0), 0),
    totalSales: sales.length,
    totalSalesAmount: sales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0),
    paidAmount: sales
      .filter(s => s.status === 'paid')
      .reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Yükleniyor...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-gray-600">Müşteri bulunamadı</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
              Müşterilere Dön
            </button>

            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl">
                    {customer.name.charAt(0)}
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
                      customer.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {customer.status === 'active' ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/quotes/new?customer=${customer.id}`)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Yeni Teklif
                </button>
                <button
                  onClick={() => router.push(`/customers/${customer.id}/edit`)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Edit className="w-5 h-5" />
                  Düzenle
                </button>
              </div>
            </div>
          </div>

          {/* İstatistikler */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Toplam Teklif</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalQuotes}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Onaylanan</p>
                  <p className="text-2xl font-bold text-green-600">{stats.approvedQuotes}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Toplam Satış</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.totalSales}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Toplam Tutar</p>
                  <p className="text-xl font-bold text-gray-900">
                    ₺{stats.totalSalesAmount.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sol Kolon - Müşteri Bilgileri */}
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">İletişim Bilgileri</h2>
                <div className="space-y-3">
                  {customer.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <a href={`mailto:${customer.email}`} className="text-blue-600 hover:text-blue-800">
                          {customer.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {customer.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">Telefon</p>
                        <a href={`tel:${customer.phone}`} className="text-gray-900">
                          {customer.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {customer.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">Adres</p>
                        <p className="text-gray-900">{customer.address}</p>
                        {customer.city && (
                          <p className="text-gray-600">{customer.city}, {customer.country}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {(customer.tax_office || customer.tax_number) && (
                    <div className="flex items-start gap-3">
                      <Building className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">Vergi Bilgileri</p>
                        {customer.tax_office && (
                          <p className="text-gray-900">{customer.tax_office}</p>
                        )}
                        {customer.tax_number && (
                          <p className="text-gray-600">VKN: {customer.tax_number}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {customer.notes && (
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Notlar</h2>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{customer.notes}</p>
                </div>
              )}

              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Bilgiler</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Kayıt Tarihi:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(customer.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Son Güncelleme:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(customer.updated_at).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sağ Kolon - Teklifler ve Satışlar */}
            <div className="lg:col-span-2 space-y-6">
              {/* Teklifler */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Teklifler</h2>
                  <button
                    onClick={() => router.push(`/quotes/new?customer=${customer.id}`)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Yeni Teklif Oluştur
                  </button>
                </div>

                {quotes.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 mb-3">Henüz teklif yok</p>
                    <button
                      onClick={() => router.push(`/quotes/new?customer=${customer.id}`)}
                      className="btn-primary text-sm"
                    >
                      İlk Teklifi Oluştur
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quotes.slice(0, 5).map(quote => (
                      <div 
                        key={quote.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => router.push(`/quotes/${quote.id}`)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{quote.quote_number}</span>
                            {getStatusBadge(quote.status, 'quote')}
                          </div>
                          {quote.title && (
                            <p className="text-sm text-gray-600 mb-1">{quote.title}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(quote.created_at).toLocaleDateString('tr-TR')}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            ₺{parseFloat(quote.total_amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </p>
                          <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1">
                            <Eye className="w-4 h-4" />
                            Görüntüle
                          </button>
                        </div>
                      </div>
                    ))}

                    {quotes.length > 5 && (
                      <button
                        onClick={() => router.push(`/quotes?customer=${customer.id}`)}
                        className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium py-2"
                      >
                        Tümünü Gör ({quotes.length} teklif)
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Satışlar */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Satışlar</h2>
                </div>

                {sales.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">Henüz satış yok</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sales.map(sale => (
                      <div 
                        key={sale.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{sale.sale_number}</span>
                            {getStatusBadge(sale.status, 'sale')}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(sale.created_at).toLocaleDateString('tr-TR')}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            ₺{parseFloat(sale.total_amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
