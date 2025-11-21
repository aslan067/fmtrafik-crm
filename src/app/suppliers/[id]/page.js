'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { ArrowLeft, Edit, Phone, Mail, MapPin, ShoppingBag, TrendingUp, DollarSign, Calendar } from 'lucide-react'

export default function SupplierDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [supplier, setSupplier] = useState(null)
  const [loading, setLoading] = useState(true)

  // Gelecekte buraya 'purchases' verileri gelecek
  const stats = {
    totalOrders: 0,
    activeOrders: 0,
    totalVolume: 0,
    lastOrderDate: '-'
  }

  useEffect(() => {
    async function loadData() {
      try {
        const user = await getCurrentUser()
        const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()
        
        const { data, error } = await supabase.from('suppliers').select('*').eq('id', params.id).eq('company_id', profile.company_id).single()
        if (error) throw error
        setSupplier(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) return <DashboardLayout><div className="p-6">Yükleniyor...</div></DashboardLayout>
  if (!supplier) return <DashboardLayout><div className="p-6">Tedarikçi bulunamadı</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.push('/suppliers')} className="flex items-center text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft className="w-4 h-4 mr-1"/> Tedarikçilere Dön</button>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 font-bold text-2xl">
                {supplier.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{supplier.name}</h1>
                <p className="text-gray-500 font-mono text-sm">{supplier.code}</p>
              </div>
            </div>
            <button onClick={() => router.push(`/suppliers/${supplier.id}/edit`)} className="btn-secondary flex items-center gap-2"><Edit className="w-4 h-4"/> Düzenle</button>
          </div>
        </div>

        {/* Stats (Gelecek Özellik) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded text-blue-600"><ShoppingBag className="w-5 h-5"/></div>
              <div><p className="text-xs text-gray-500">Toplam Sipariş</p><p className="font-bold text-lg">0</p></div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded text-yellow-600"><Calendar className="w-5 h-5"/></div>
              <div><p className="text-xs text-gray-500">Son Sipariş</p><p className="font-bold text-lg">-</p></div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded text-green-600"><DollarSign className="w-5 h-5"/></div>
              <div><p className="text-xs text-gray-500">Toplam Hacim</p><p className="font-bold text-lg">₺0</p></div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded text-purple-600"><TrendingUp className="w-5 h-5"/></div>
              <div><p className="text-xs text-gray-500">Aktif Siparişler</p><p className="font-bold text-lg">0</p></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sol: Bilgiler */}
          <div className="space-y-6">
            <div className="card">
              <h3 className="font-semibold mb-4">Firma Bilgileri</h3>
              <div className="space-y-3 text-sm">
                {supplier.contact_name && <div className="flex gap-2"><span className="text-gray-500 w-24">Yetkili:</span><span>{supplier.contact_name}</span></div>}
                {supplier.contact_phone && <div className="flex gap-2"><Phone className="w-4 h-4 text-gray-400"/><a href={`tel:${supplier.contact_phone}`} className="hover:underline">{supplier.contact_phone}</a></div>}
                {supplier.contact_email && <div className="flex gap-2"><Mail className="w-4 h-4 text-gray-400"/><a href={`mailto:${supplier.contact_email}`} className="hover:underline">{supplier.contact_email}</a></div>}
                {supplier.address && <div className="flex gap-2"><MapPin className="w-4 h-4 text-gray-400"/><span>{supplier.address}</span></div>}
              </div>
            </div>

            <div className="card bg-gray-50 border-gray-200">
              <h3 className="font-semibold mb-2">Ticari Koşullar</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Tip:</span><span className="font-medium">{supplier.discount_type === 'percentage' ? 'İskonto Bazlı' : 'Net Fiyat'}</span></div>
                <div className="flex justify-between"><span>Değer:</span><span className="font-medium">{supplier.discount_type === 'percentage' ? `%${supplier.discount_value}` : `x${supplier.price_multiplier}`}</span></div>
                {supplier.payment_terms && <div className="pt-2 border-t mt-2"><span className="text-gray-500 block text-xs mb-1">Ödeme:</span>{supplier.payment_terms}</div>}
              </div>
            </div>
          </div>

          {/* Sağ: Geçmiş Siparişler (Placeholder) */}
          <div className="lg:col-span-2">
            <div className="card min-h-[300px] flex flex-col items-center justify-center text-center">
              <ShoppingBag className="w-12 h-12 text-gray-200 mb-3"/>
              <h3 className="font-semibold text-gray-900">Henüz Satınalma Kaydı Yok</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">Tedarikçiye ait sipariş geçmişi burada listelenecek.</p>
              <button className="btn-secondary text-sm" disabled>Yeni Satınalma Siparişi (Yakında)</button>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
