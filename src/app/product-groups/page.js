'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Plus, Layers, Edit, Trash2, Percent } from 'lucide-react'

export default function ProductGroupsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadGroups()
  }, [])

  async function loadGroups() {
    try {
      const user = await getCurrentUser()
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const { data, error } = await supabase
        .from('product_groups')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('sort_order')

      if (error) throw error
      setGroups(data || [])
    } catch (error) {
      console.error('Error loading product groups:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Bu ürün grubunu silmek istediğinizden emin misiniz? Bu gruba bağlı ürünler etkilenebilir.')) return

    try {
      const { error } = await supabase
        .from('product_groups')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      setGroups(groups.filter(g => g.id !== id))
      alert('Ürün grubu başarıyla silindi')
    } catch (error) {
      console.error('Error deleting product group:', error)
      alert('Silme işlemi başarısız oldu')
    }
  }

  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const stats = {
    total: groups.length,
    active: groups.filter(g => g.is_active).length,
    avgDiscount: groups.length > 0 
      ? groups.reduce((sum, g) => sum + parseFloat(g.dealer_discount_percentage || 0), 0) / groups.length 
      : 0
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
              <h1 className="text-3xl font-bold text-gray-900">Ürün Grupları</h1>
              <p className="text-gray-600 mt-1">Ürün gruplarını ve bayi iskonto oranlarını yönetin</p>
            </div>
            <button 
              onClick={() => router.push('/product-groups/new')}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Yeni Grup
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card">
              <p className="text-sm text-gray-600">Toplam Grup</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600">Aktif Grup</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600">Ortalama İskonto</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                %{stats.avgDiscount.toFixed(0)}
              </p>
            </div>
          </div>

          {/* Info Box */}
          <div className="card bg-blue-50 border-blue-200 mb-6">
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Ürün Grupları Nedir?</h3>
                <p className="text-sm text-gray-700">
                  Ürün grupları, farklı tedarikçilerden gelen ürünlere bayi iskonto oranları atamak için kullanılır. 
                  Örneğin: A Grubu ürünlere %45, B Grubu ürünlere %25 bayi iskontosu uygulayabilirsiniz.
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="card mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Grup ara... (İsim, kod)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>

          {/* Groups List */}
          {filteredGroups.length === 0 ? (
            <div className="card text-center py-12">
              <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                {searchTerm ? 'Grup bulunamadı' : 'Henüz ürün grubu eklenmemiş'}
              </p>
              <button 
                onClick={() => router.push('/product-groups/new')}
                className="btn-primary"
              >
                İlk Grubu Ekle
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGroups.map(group => (
                <div 
                  key={group.id} 
                  className="card hover:shadow-lg transition-shadow"
                  style={{ borderLeftWidth: '4px', borderLeftColor: group.color_code || '#3b82f6' }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                        style={{ backgroundColor: group.color_code || '#3b82f6' }}
                      >
                        {group.code}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{group.name}</h3>
                        {group.is_active ? (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                            Aktif
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">
                            Pasif
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Bayi İskontosu</span>
                      <div className="flex items-center gap-1">
                        <Percent className="w-4 h-4 text-blue-600" />
                        <span className="text-2xl font-bold text-blue-600">
                          {parseFloat(group.dealer_discount_percentage).toFixed(0)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all"
                        style={{ 
                          width: `${group.dealer_discount_percentage}%`,
                          backgroundColor: group.color_code || '#3b82f6'
                        }}
                      ></div>
                    </div>
                  </div>

                  {group.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {group.description}
                    </p>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-gray-200">
                    <button 
                      onClick={() => router.push(`/product-groups/${group.id}/edit`)}
                      className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
                    >
                      <Edit className="w-4 h-4" />
                      Düzenle
                    </button>
                    <button 
                      onClick={() => handleDelete(group.id)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Fiyat Hesaplama Örneği */}
          <div className="mt-8 card bg-gradient-to-br from-purple-50 to-blue-50">
            <h3 className="font-semibold text-gray-900 mb-3">💡 Fiyat Hesaplama Örneği</h3>
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-white rounded-lg">
                <p className="text-gray-700">
                  <span className="font-semibold">A Grubu (%45 iskonto):</span> 
                  Liste Fiyatı 1.000₺ → Bayi Net: 550₺
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-gray-700">
                  <span className="font-semibold">B Grubu (%25 iskonto):</span> 
                  Liste Fiyatı 1.000₺ → Bayi Net: 750₺
                </p>
              </div>
              <p className="text-xs text-gray-600 mt-3">
                * Ürün ekleme/düzenleme sırasında grup seçildiğinde, bayi iskontosu otomatik olarak uygulanır.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
