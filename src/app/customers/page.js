'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Filter, Plus, Users, Eye, Edit, ChevronDown } from 'lucide-react'

export default function CustomersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('')

  useEffect(() => {
    loadCustomers()
  }, [])

  async function loadCustomers() {
    try {
      const user = await getCurrentUser()
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error loading customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    return status === 'active' ? (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Aktif
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Pasif
      </span>
    )
  }

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.tax_number && customer.tax_number.includes(searchTerm))
    
    const matchesStatus = !selectedStatus || customer.status === selectedStatus
    
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.status === 'active').length,
    inactive: customers.filter(c => c.status === 'inactive').length,
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

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Müşteriler</h1>
              <p className="text-gray-600 mt-1">Müşteri kayıtlarını yönetin</p>
            </div>
            <button 
              onClick={() => router.push('/customers/new')}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Yeni Müşteri
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card">
              <p className="text-sm text-gray-600">Toplam Müşteri</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600">Aktif Müşteri</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600">Pasif Müşteri</p>
              <p className="text-2xl font-bold text-gray-600 mt-1">{stats.inactive}</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Müşteri ara... (İsim, email, vergi no)"
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
                    <option value="active">Aktif</option>
                    <option value="inactive">Pasif</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Customers List */}
          {filteredCustomers.length === 0 ? (
            <div className="card text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedStatus ? 'Müşteri bulunamadı' : 'Henüz müşteri eklenmemiş'}
              </p>
              <button 
                onClick={() => router.push('/customers/new')}
                className="btn-primary"
              >
                İlk Müşteriyi Ekle
              </button>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Müşteri</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İletişim</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vergi Bilgileri</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCustomers.map(customer => (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                            {customer.name.charAt(0)}
                          </div>
                          <div className="ml-3">
                            <p className="font-medium text-gray-900">{customer.name}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(customer.created_at).toLocaleDateString('tr-TR')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{customer.email || '-'}</p>
                        <p className="text-sm text-gray-500">{customer.phone || '-'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{customer.tax_office || '-'}</p>
                        <p className="text-sm text-gray-500">{customer.tax_number || '-'}</p>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(customer.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => router.push(`/customers/${customer.id}`)}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            Detay
                          </button>
                          <button 
                            onClick={() => router.push(`/customers/${customer.id}/edit`)}
                            className="text-gray-600 hover:text-gray-800 font-medium text-sm flex items-center gap-1"
                          >
                            <Edit className="w-4 h-4" />
                            Düzenle
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
