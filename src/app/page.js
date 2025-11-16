'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { 
  Search, Filter, Plus, Users, FileText, ShoppingCart, 
  BarChart3, Settings, Bell, Menu, X, ChevronDown, 
  Home, Calendar, DollarSign, TrendingUp, LogOut 
} from 'lucide-react'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  // Mock data - daha sonra Supabase'den gelecek
  const [customers, setCustomers] = useState([])
  const [quotes, setQuotes] = useState([])
  const [sales, setSales] = useState([])

  useEffect(() => {
    checkUser()
    loadData()
  }, [])

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        router.push('/login')
        return
      }
      setUser(currentUser)
    } catch (error) {
      console.error('User check error:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  async function loadData() {
    try {
      // Müşterileri yükle
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (customersData) setCustomers(customersData)

      // Teklifleri yükle
      const { data: quotesData } = await supabase
        .from('quotes')
        .select('*, customers(name)')
        .order('created_at', { ascending: false })
      
      if (quotesData) setQuotes(quotesData)

      // Satışları yükle
      const { data: salesData } = await supabase
        .from('sales')
        .select('*, customers(name)')
        .order('created_at', { ascending: false })
      
      if (salesData) setSales(salesData)
    } catch (error) {
      console.error('Data loading error:', error)
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const menuItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard', badge: null },
    { id: 'customers', icon: Users, label: 'Müşteriler', badge: customers.length },
    { id: 'quotes', icon: FileText, label: 'Teklifler', badge: quotes.length },
    { id: 'sales', icon: DollarSign, label: 'Satışlar', badge: sales.length },
    { id: 'products', icon: ShoppingCart, label: 'Ürünler', badge: null },
    { id: 'reports', icon: BarChart3, label: 'Raporlar', badge: null },
    { id: 'settings', icon: Settings, label: 'Ayarlar', badge: null },
  ]

  const getStatusBadge = (status, type) => {
    const statusColors = {
      quote: {
        draft: 'bg-gray-100 text-gray-800',
        sent: 'bg-blue-100 text-blue-800',
        approved: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
      },
      customer: {
        active: 'bg-green-100 text-green-800',
        inactive: 'bg-gray-100 text-gray-800',
      },
      sale: {
        pending: 'bg-yellow-100 text-yellow-800',
        invoiced: 'bg-blue-100 text-blue-800',
        paid: 'bg-green-100 text-green-800',
      }
    }

    const statusLabels = {
      quote: {
        draft: 'Taslak',
        sent: 'Gönderildi',
        approved: 'Onaylandı',
        rejected: 'Reddedildi',
      },
      customer: {
        active: 'Aktif',
        inactive: 'Pasif',
      },
      sale: {
        pending: 'Beklemede',
        invoiced: 'Faturalandı',
        paid: 'Ödendi',
      }
    }

    const colorClass = statusColors[type]?.[status] || 'bg-gray-100 text-gray-800'
    const label = statusLabels[type]?.[status] || status

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {label}
      </span>
    )
  }

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Yeni Teklif
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Toplam Müşteri</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{customers.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>Aktif: {customers.filter(c => c.status === 'active').length}</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Açık Teklifler</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {quotes.filter(q => q.status !== 'approved').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-1" />
            <span>Bu ay</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Onaylanan</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {quotes.filter(q => q.status === 'approved').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>+25% bu ay</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Toplam Satış</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ₺{sales.reduce((sum, s) => sum + (s.total_amount || 0), 0).toLocaleString('tr-TR')}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>Bu ay</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Son Teklifler</h2>
          <div className="space-y-3">
            {quotes.slice(0, 5).length === 0 ? (
              <p className="text-gray-500 text-center py-8">Henüz teklif yok</p>
            ) : (
              quotes.slice(0, 5).map(quote => (
                <div key={quote.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{quote.quote_number}</p>
                    <p className="text-sm text-gray-600">{quote.customers?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      ₺{(quote.total_amount || 0).toLocaleString('tr-TR')}
                    </p>
                    {getStatusBadge(quote.status, 'quote')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Son Müşteriler</h2>
          <div className="space-y-3">
            {customers.slice(0, 5).length === 0 ? (
              <p className="text-gray-500 text-center py-8">Henüz müşteri yok</p>
            ) : (
              customers.slice(0, 5).map(customer => (
                <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center flex-1">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                      {customer.name.charAt(0)}
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      <p className="text-sm text-gray-600">{customer.email || 'Email yok'}</p>
                    </div>
                  </div>
                  {getStatusBadge(customer.status, 'customer')}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const renderCustomers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Müşteriler</h1>
        <button 
          onClick={() => router.push('/customers/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Yeni Müşteri
        </button>
      </div>

      <div className="card">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Müşteri ara..."
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
          </button>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Henüz müşteri eklenmemiş</p>
          <button className="btn-primary">İlk Müşteriyi Ekle</button>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Müşteri</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İletişim</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {customers
                .filter(c => 
                  c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
                )
                .map(customer => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                          {customer.name.charAt(0)}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">{customer.name}</p>
                          <p className="text-sm text-gray-500">{customer.tax_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{customer.email || '-'}</p>
                      <p className="text-sm text-gray-500">{customer.phone || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(customer.status, 'customer')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                        Detay
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return renderDashboard()
      case 'customers':
        return renderCustomers()
      default:
        return (
          <div className="card text-center py-12">
            <p className="text-gray-600">Bu sayfa henüz hazırlanıyor...</p>
          </div>
        )
    }
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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div>
                <h1 className="text-xl font-bold text-gray-900">FM Trafik</h1>
                <p className="text-xs text-gray-500">CRM Sistemi</p>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                currentPage === item.id
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {item.badge !== null && (
                    <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                <button 
                  onClick={handleSignOut}
                  className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  Çıkış
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {menuItems.find(m => m.id === currentPage)?.label}
            </h2>
            <button className="p-2 rounded-lg hover:bg-gray-100 relative">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
