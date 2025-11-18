'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Filter, Plus, Truck, Edit, Trash2, ChevronDown, Percent, DollarSign } from 'lucide-react'

export default function SuppliersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedType, setSelectedType] = useState('')

  useEffect(() => {
    loadSuppliers()
  }, [])

  async function loadSuppliers() {
    try {
      const user = await getCurrentUser()
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name')

      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error loading suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Bu tedarikçiyi silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      setSuppliers(suppliers.filter(s => s.id !== id))
      alert('Tedarikçi başarıyla silindi')
    } catch (error) {
      console.error('Error deleting supplier:', error)
      alert('Silme işlemi başarısız oldu')
    }
  }

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = 
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.code.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = !selectedType || supplier.discount_type === selectedType
    
    return matchesSearch && matchesType
  })

  const stats = {
    total: suppliers.length,
    active: suppliers.filter(s => s.is_active).length,
    percentage: suppliers.filter(s => s.discount_type === 'percentage').length,
    netPrice: suppliers.filter(s => s.discount_type === 'net_price').length,
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
              <h1 className="text-3xl font-bold text-gray-900">Tedarikçiler</h1>
              <p className="text-gray-600 mt-1">Tedarikçilerinizi ve fiyatlandırma koşullarını yönetin</p>
            </div>
            <button 
              onClick={() => router.push('/suppliers/new')}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Yeni Tedarikçi
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="card">
              <p className="text-sm text-gray-600">Toplam Tedarikçi</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600">Aktif</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-1">
                <Percent className="w-4 h-4 text-blue-600" />
                <p className="text-sm text-gray-600">İskontolu</p>
              </div>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.percentage}</p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-purple-600" />
                <p className="text-sm text-gray-600">Net Fiyat</p>
              </div>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.netPrice}</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Tedarikçi ara... (İsim, kod)"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fiyatlandırma Tipi</label>
                  <select 
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Tümü</option>
                    <option value="percentage">İskonto Yüzdesi</option>
                    <option value="net_price">Net Fiyat</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Suppliers List */}
          {filteredSuppliers.length === 0 ? (
            <div className="card text-center py-12">
              <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedType ? 'Tedarikçi bulunamadı' : 'Henüz tedarikçi eklenmemiş'}
              </p>
              <button 
                onClick={() => router.push('/suppliers/new')}
                className="btn-primary"
              >
                İlk Tedarikçiyi Ekle
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredSuppliers.map(supplier => (
                <div key={supplier.id} className="card hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Truck className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">{supplier.name}</h3>
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                              {supplier.code}
                            </span>
                            {supplier.is_active ? (
                              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                                Aktif
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                                Pasif
                              </span>
                            )}
                          </div>
                          {supplier.contact_name && (
                            <p className="text-sm text-gray-600 mt-1">
                              İletişim: {supplier.contact_name}
                              {supplier.contact_phone && ` • ${supplier.contact_phone}`}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="ml-15 mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Fiyatlandırma</p>
                          <p className="text-sm font-medium text-gray-900">
                            {supplier.discount_type === 'percentage' ? 'İskonto' : 'Net Fiyat'}
                          </p>
                        </div>

                        {supplier.discount_type === 'percentage' ? (
                          <div>
                            <p className="text-xs text-gray-500">İskonto Oranı</p>
                            <p className="text-sm font-medium text-blue-600">
                              %{parseFloat(supplier.discount_value || 0).toFixed(0)}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-gray-500">Fiyat Çarpanı</p>
                            <p className="text-sm font-medium text-purple-600">
                              x{parseFloat(supplier.price_multiplier || 1).toFixed(2)}
                            </p>
                          </div>
                        )}

                        {supplier.payment_terms && (
                          <div>
                            <p className="text-xs text-gray-500">Ödeme Koşulları</p>
                            <p className="text-sm font-medium text-gray-900">{supplier.payment_terms}</p>
                          </div>
                        )}

                        {supplier.tax_number && (
                          <div>
                            <p className="text-xs text-gray-500">Vergi No</p>
                            <p className="text-sm font-medium text-gray-900">{supplier.tax_number}</p>
                          </div>
                        )}
                      </div>

                      {supplier.notes && (
                        <div className="ml-15 mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">Notlar</p>
                          <p className="text-sm text-gray-700">{supplier.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => router.push(`/suppliers/${supplier.id}/edit`)}
                        className="btn-secondary flex items-center gap-2 text-sm"
                      >
                        <Edit className="w-4 h-4" />
                        Düzenle
                      </button>
                      <button 
                        onClick={() => handleDelete(supplier.id)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
