'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  Search, Filter, Plus, Truck, Edit, Trash2, 
  ChevronDown, Percent, DollarSign, Eye, MapPin, Phone 
} from 'lucide-react'

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

  async function handleDelete(e, id) {
    e.stopPropagation() // Karta tıklamayı engelle
    if (!confirm('Bu tedarikçiyi silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      setSuppliers(suppliers.filter(s => s.id !== id))
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
              <h1 className="text-3xl font-bold text-gray-900">Tedarikçiler</h1>
              <p className="text-gray-600 mt-1">Tedarik zinciri ve fiyatlandırma yönetimi</p>
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
            <div className="card border-l-4 border-l-blue-500">
              <p className="text-sm text-gray-600">Toplam Tedarikçi</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="card border-l-4 border-l-green-500">
              <p className="text-sm text-gray-600">Aktif Çalışılan</p>
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
                <p className="text-sm text-gray-600">Net Fiyatlı</p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Anlaşma Tipi</label>
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
                {searchTerm || selectedType ? 'Kriterlere uygun tedarikçi bulunamadı' : 'Henüz tedarikçi eklenmemiş'}
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
                <div 
                  key={supplier.id} 
                  className="card hover:shadow-lg transition-all cursor-pointer group border border-transparent hover:border-blue-200"
                  onClick={() => router.push(`/suppliers/${supplier.id}`)}
                >
                  <div className="flex items-start justify-between">
                    {/* Sol Taraf - Bilgiler */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                          <Truck className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {supplier.name}
                            </h3>
                            <span className="px-2 py-0.5 text-xs font-mono bg-gray-100 text-gray-600 rounded border border-gray-200">
                              {supplier.code}
                            </span>
                            {!supplier.is_active && (
                              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">Pasif</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            {supplier.contact_name && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium text-gray-700">{supplier.contact_name}</span>
                              </span>
                            )}
                            {supplier.contact_phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {supplier.contact_phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 ml-16">
                        <div className="bg-gray-50 p-2 rounded">
                          <p className="text-xs text-gray-500">Anlaşma Tipi</p>
                          <p className="text-sm font-medium text-gray-900">
                            {supplier.discount_type === 'percentage' ? 'İskonto Bazlı' : 'Net Fiyat'}
                          </p>
                        </div>

                        <div className="bg-gray-50 p-2 rounded">
                          <p className="text-xs text-gray-500">
                            {supplier.discount_type === 'percentage' ? 'İskonto Oranı' : 'Fiyat Çarpanı'}
                          </p>
                          <p className={`text-sm font-bold ${supplier.discount_type === 'percentage' ? 'text-green-600' : 'text-purple-600'}`}>
                            {supplier.discount_type === 'percentage' 
                              ? `%${parseFloat(supplier.discount_value || 0).toFixed(0)}` 
                              : `x${parseFloat(supplier.price_multiplier || 1).toFixed(2)}`}
                          </p>
                        </div>

                        {supplier.payment_terms && (
                          <div className="bg-gray-50 p-2 rounded hidden md:block">
                            <p className="text-xs text-gray-500">Ödeme</p>
                            <p className="text-sm font-medium text-gray-900 truncate">{supplier.payment_terms}</p>
                          </div>
                        )}
                        
                        {supplier.address && (
                          <div className="bg-gray-50 p-2 rounded hidden md:block">
                            <p className="text-xs text-gray-500">Konum</p>
                            <p className="text-sm font-medium text-gray-900 flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3" /> {supplier.address.substring(0, 15)}...
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sağ Taraf - Aksiyonlar */}
                    <div className="flex flex-col gap-2 ml-4 border-l pl-4 border-gray-100">
                      <button 
                        onClick={(e) => { e.stopPropagation(); router.push(`/suppliers/${supplier.id}`) }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Detay Görüntüle"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); router.push(`/suppliers/${supplier.id}/edit`) }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Düzenle"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, supplier.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="w-5 h-5" />
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
