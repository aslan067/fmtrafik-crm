'use client'

import DashboardLayout from '@/components/DashboardLayout'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { 
  Users, FileText, DollarSign, TrendingUp, TrendingDown,
  Plus, Eye, Calendar, AlertCircle, Clock, CheckCircle,
  XCircle, Send, Package, ArrowRight
} from 'lucide-react'

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [customers, setCustomers] = useState([])
  const [quotes, setQuotes] = useState([])
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        router.push('/login')
        return
      }
      setUser(currentUser)
      await loadData()
    } catch (error) {
      console.error('User check error:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  async function loadData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      // Müşterileri yükle
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
      
      setCustomers(customersData || [])

      // Teklifleri yükle
      const { data: quotesData } = await supabase
        .from('quotes')
        .select('*, customers(name)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
      
      setQuotes(quotesData || [])

      // Satışları yükle
      const { data: salesData } = await supabase
        .from('sales')
        .select('*, customers(name)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
      
      setSales(salesData || [])

      // Ürünleri yükle
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
      
      setProducts(productsData || [])

    } catch (error) {
      console.error('Data loading error:', error)
    }
  }

  // İstatistikler
  const stats = {
    customers: {
      total: customers.length,
      active: customers.filter(c => c.status === 'active').length,
      new: customers.filter(c => {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return new Date(c.created_at) > weekAgo
      }).length
    },
    quotes: {
      total: quotes.length,
      draft: quotes.filter(q => q.status === 'draft').length,
      sent: quotes.filter(q => q.status === 'sent').length,
      approved: quotes.filter(q => q.status === 'approved').length,
      rejected: quotes.filter(q => q.status === 'rejected').length,
      totalValue: quotes.reduce((sum, q) => sum + parseFloat(q.total_amount || 0), 0),
      approvedValue: quotes
        .filter(q => q.status === 'approved')
        .reduce((sum, q) => sum + parseFloat(q.total_amount || 0), 0)
    },
    sales: {
      total: sales.length,
      thisMonth: sales.filter(s => {
        const monthStart = new Date()
        monthStart.setDate(1)
        return new Date(s.created_at) >= monthStart
      }).length,
      totalValue: sales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0),
      thisMonthValue: sales
        .filter(s => {
          const monthStart = new Date()
          monthStart.setDate(1)
          return new Date(s.created_at) >= monthStart
        })
        .reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0)
    },
    products: {
      total: products.length
    }
  }

  // Yaklaşan geçerlilik tarihleri
  const expiringQuotes = quotes.filter(q => {
    if (q.status !== 'sent' || !q.valid_until) return false
    const validDate = new Date(q.valid_until)
    const today = new Date()
    const daysUntil = Math.floor((validDate - today) / (1000 * 60 * 60 * 24))
    return daysUntil >= 0 && daysUntil <= 7
  }).sort((a, b) => new Date(a.valid_until) - new Date(b.valid_until))

  // Son aktiviteler
  const recentActivities = [
    ...quotes.slice(0, 5).map(q => ({
      id: q.id,
      type: 'quote',
      title: `Teklif ${q.quote_number}`,
      customer: q.customers?.name,
      date: q.created_at,
      status: q.status
    })),
    ...sales.slice(0, 3).map(s => ({
      id: s.id,
      type: 'sale',
      title: `Satış ${s.sale_number}`,
      customer: s.customers?.name,
      date: s.created_at,
      status: s.status
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8)

  const getStatusIcon = (status, type) => {
    if (type === 'quote') {
      switch(status) {
        case 'draft': return <Clock className="w-4 h-4 text-gray-500" />
        case 'sent': return <Send className="w-4 h-4 text-blue-500" />
        case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />
        case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />
        default: return <FileText className="w-4 h-4 text-gray-500" />
      }
    } else {
      return <DollarSign className="w-4 h-4 text-green-500" />
    }
  }

  const quickActions = [
    { icon: Plus, label: 'Yeni Teklif', path: '/quotes/new', color: 'bg-blue-600 hover:bg-blue-700' },
    { icon: Users, label: 'Yeni Müşteri', path: '/customers/new', color: 'bg-green-600 hover:bg-green-700' },
    { icon: Package, label: 'Yeni Ürün', path: '/products/new', color: 'bg-purple-600 hover:bg-purple-700' },
    { icon: FileText, label: 'Tüm Teklifler', path: '/quotes', color: 'bg-gray-600 hover:bg-gray-700' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }
return (
  <DashboardLayout>
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Hoş geldiniz, işletmenizin genel durumunu görüntüleyin</p>
        </div>

        {/* Ana İstatistikler */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/customers')}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              {stats.customers.new > 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  +{stats.customers.new} yeni
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">Toplam Müşteri</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.customers.total}</p>
            <div className="mt-3 flex items-center text-sm text-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              <span>{stats.customers.active} aktif</span>
            </div>
          </div>

          <div className="card cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/quotes')}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-yellow-600" />
              </div>
              {stats.quotes.sent > 0 && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  {stats.quotes.sent} bekliyor
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">Toplam Teklif</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.quotes.total}</p>
            <div className="mt-3 text-sm text-gray-600">
              <span>{stats.quotes.approved} onaylı, {stats.quotes.rejected} red</span>
            </div>
          </div>

          <div className="card cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/quotes')}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600">Onaylanan Teklifler</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.quotes.approved}</p>
            <div className="mt-3 text-sm text-green-600">
              ₺{stats.quotes.approvedValue.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
            </div>
          </div>

          <div className="card cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              {stats.sales.thisMonth > 0 && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                  Bu ay: {stats.sales.thisMonth}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">Toplam Satış</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              ₺{stats.sales.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
            </p>
            <div className="mt-3 text-sm text-purple-600">
              Bu ay: ₺{stats.sales.thisMonthValue.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Hızlı Eylemler */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hızlı Eylemler</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => router.push(action.path)}
                className={`${action.color} text-white p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors`}
              >
                <action.icon className="w-8 h-8" />
                <span className="font-medium text-sm">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sol Kolon - Yaklaşan Geçerlilik Tarihleri & Grafikler */}
          <div className="lg:col-span-2 space-y-6">
            {/* Yaklaşan Geçerlilik Tarihleri */}
            {expiringQuotes.length > 0 && (
              <div className="card bg-yellow-50 border-yellow-200">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Yaklaşan Geçerlilik Tarihleri</h3>
                    <p className="text-sm text-gray-600">7 gün içinde sona erecek teklifler</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {expiringQuotes.map(quote => {
                    const daysLeft = Math.floor((new Date(quote.valid_until) - new Date()) / (1000 * 60 * 60 * 24))
                    return (
                      <div 
                        key={quote.id}
                        onClick={() => router.push(`/quotes/${quote.id}`)}
                        className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{quote.quote_number}</p>
                          <p className="text-sm text-gray-600">{quote.customers?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${daysLeft <= 2 ? 'text-red-600' : 'text-yellow-600'}`}>
                            {daysLeft === 0 ? 'Bugün' : `${daysLeft} gün`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(quote.valid_until).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Teklif Durumu Dağılımı */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Teklif Durumu Dağılımı</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="text-sm text-gray-700">Taslak</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gray-400 h-2 rounded-full" 
                        style={{ width: `${stats.quotes.total > 0 ? (stats.quotes.draft / stats.quotes.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{stats.quotes.draft}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-700">Gönderildi</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${stats.quotes.total > 0 ? (stats.quotes.sent / stats.quotes.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{stats.quotes.sent}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-700">Onaylandı</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${stats.quotes.total > 0 ? (stats.quotes.approved / stats.quotes.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{stats.quotes.approved}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-gray-700">Reddedildi</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full" 
                        style={{ width: `${stats.quotes.total > 0 ? (stats.quotes.rejected / stats.quotes.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{stats.quotes.rejected}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Son Teklifler */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Son Teklifler</h3>
                <button 
                  onClick={() => router.push('/quotes')}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  Tümünü Gör
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {quotes.slice(0, 5).map(quote => (
                  <div 
                    key={quote.id}
                    onClick={() => router.push(`/quotes/${quote.id}`)}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{quote.quote_number}</p>
                      <p className="text-sm text-gray-600">{quote.customers?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ₺{parseFloat(quote.total_amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        quote.status === 'approved' ? 'bg-green-100 text-green-700' :
                        quote.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                        quote.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {quote.status === 'approved' ? 'Onaylandı' :
                         quote.status === 'sent' ? 'Gönderildi' :
                         quote.status === 'rejected' ? 'Reddedildi' : 'Taslak'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sağ Kolon - Son Aktiviteler */}
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Son Aktiviteler</h3>
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <div key={`${activity.type}-${activity.id}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {getStatusIcon(activity.status, activity.type)}
                      </div>
                      {index < recentActivities.length - 1 && (
                        <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-600">{activity.customer}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(activity.date).toLocaleDateString('tr-TR', { 
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hızlı Bilgiler */}
            <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Özet Bilgiler</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Toplam Ürün:</span>
                  <span className="font-semibold text-gray-900">{stats.products.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Teklif Başarı Oranı:</span>
                  <span className="font-semibold text-green-600">
                    {stats.quotes.total > 0 
                      ? `${((stats.quotes.approved / stats.quotes.total) * 100).toFixed(0)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Ort. Teklif Değeri:</span>
                  <span className="font-semibold text-gray-900">
                    ₺{stats.quotes.total > 0 
                      ? (stats.quotes.totalValue / stats.quotes.total).toLocaleString('tr-TR', { minimumFractionDigits: 0 })
                      : '0'}
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t border-blue-200">
                  <span className="text-gray-700">Bu Ay Kazanç:</span>
                  <span className="font-bold text-blue-600 text-base">
                    ₺{stats.sales.thisMonthValue.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
      </div>
    </DashboardLayout>
  )
  )
}
