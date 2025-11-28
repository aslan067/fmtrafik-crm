'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  TrendingUp, FileText, AlertTriangle, Package, 
  ArrowRight, Plus, ShoppingCart, Truck, Wallet 
} from 'lucide-react'

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    monthlyRevenue: 0,
    pendingQuotes: 0,
    lowStockCount: 0,
    activePurchases: 0
  })
  const [recentSales, setRecentSales] = useState([])
  const [lowStockProducts, setLowStockProducts] = useState([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    try {
      const user = await getCurrentUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()
      const companyId = profile.company_id

      // 1. İstatistikler (Paralel Sorgu)
      const [quotesRes, salesRes, productsRes, purchasesRes] = await Promise.all([
        // Bekleyen Teklifler (Sent)
        supabase.from('quotes').select('id', { count: 'exact' }).eq('company_id', companyId).eq('status', 'sent'),
        // Toplam Ciro (Tüm zamanlar - Basit Toplam)
        supabase.from('sales').select('total_amount, currency').eq('company_id', companyId),
        // Kritik Stok (Safety stock altındakiler)
        // Not: Supabase JS filter içinde kolon karşılaştırması (lt: 'safety_stock') her zaman düzgün çalışmayabilir, 
        // bu yüzden tüm ürünleri çekip JS tarafında filtrelemek veya RPC yazmak daha güvenlidir.
        // Performans için şimdilik basit filtreleme yapalım:
        supabase.from('products').select('id, name, stock_quantity, safety_stock, unit').eq('company_id', companyId).eq('is_active', true),
        // Aktif Satınalmalar
        supabase.from('purchase_orders').select('id', { count: 'exact' }).eq('company_id', companyId).in('status', ['ordered', 'partial'])
      ])

      // Ciro Hesapla (Basit TRY toplamı)
      const totalRevenue = (salesRes.data || []).reduce((acc, curr) => acc + (curr.currency === 'TRY' ? curr.total_amount : 0), 0)

      // Kritik Stok Hesapla
      const lowStockItems = (productsRes.data || []).filter(p => p.stock_quantity <= (p.safety_stock || 5))

      setStats({
        pendingQuotes: quotesRes.count || 0,
        monthlyRevenue: totalRevenue,
        lowStockCount: lowStockItems.length,
        activePurchases: purchasesRes.count || 0
      })

      setLowStockProducts(lowStockItems.slice(0, 5)) // İlk 5 tanesini göster

      // 2. Son Satışlar
      const { data: recentSalesData } = await supabase
        .from('sales')
        .select('*, customers(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5)
      
      setRecentSales(recentSalesData || [])

    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const currencyFormatter = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })

  if (loading) return <DashboardLayout><div className="flex h-screen items-center justify-center">Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-8">
        
        {/* --- BAŞLIK & HIZLI AKSİYONLAR --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hoş Geldiniz</h1>
            <p className="text-gray-500 text-sm">İşletmenizin bugünkü durum özeti.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <button onClick={() => router.push('/quotes/new')} className="btn-secondary whitespace-nowrap text-xs md:text-sm">
              <Plus className="w-4 h-4 mr-1 md:mr-2"/> Yeni Teklif
            </button>
            <button onClick={() => router.push('/purchases/new')} className="btn-secondary whitespace-nowrap text-xs md:text-sm">
              <Plus className="w-4 h-4 mr-1 md:mr-2"/> Sipariş Ver
            </button>
            {/* Hızlı Satış Butonu İleride Eklenebilir */}
          </div>
        </div>

        {/* --- KPI KARTLARI (Responsive Grid) --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Ciro Kartı */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Toplam Ciro</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{currencyFormatter.format(stats.monthlyRevenue)}</h3>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-green-600"><Wallet className="w-6 h-6"/></div>
          </div>

          {/* Bekleyen Teklifler */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/quotes')}>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Açık Teklifler</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.pendingQuotes}</h3>
              <p className="text-xs text-blue-600 mt-1 font-medium">Müşteri onayı bekliyor</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><FileText className="w-6 h-6"/></div>
          </div>

          {/* Aktif Satınalma */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/purchases')}>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Yoldaki Siparişler</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.activePurchases}</h3>
              <p className="text-xs text-purple-600 mt-1 font-medium">Teslimat bekleniyor</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg text-purple-600"><Truck className="w-6 h-6"/></div>
          </div>

          {/* Stok Uyarısı */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/products')}>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kritik Stok</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.lowStockCount}</h3>
              <p className="text-xs text-red-600 mt-1 font-medium">Ürün azalıyor!</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg text-red-600"><AlertTriangle className="w-6 h-6"/></div>
          </div>
        </div>

        {/* --- DETAYLI BÖLÜMLER (Grid Layout) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SOL: Son Satışlar (2/3 Genişlik) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">Son Satışlar</h2>
              <button onClick={() => router.push('/sales')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center font-medium">
                Tümünü Gör <ArrowRight className="w-4 h-4 ml-1"/>
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-xs border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3">Müşteri</th>
                      <th className="px-6 py-3">Tutar</th>
                      <th className="px-6 py-3">Durum</th>
                      <th className="px-6 py-3">Tarih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentSales.length === 0 ? (
                      <tr><td colSpan="4" className="text-center py-8 text-gray-500">Henüz satış yok.</td></tr>
                    ) : (
                      recentSales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">{sale.customers?.name}</td>
                          <td className="px-6 py-4 font-bold text-gray-900">
                            {sale.currency === 'USD' ? '$' : sale.currency === 'EUR' ? '€' : '₺'}
                            {sale.total_amount.toLocaleString('tr-TR')}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              sale.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                              sale.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {sale.payment_status === 'paid' ? 'Ödendi' : sale.payment_status === 'partial' ? 'Kısmi' : 'Ödenmedi'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-xs">
                            {new Date(sale.created_at).toLocaleDateString('tr-TR')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SAĞ: Kritik Stok Listesi (1/3 Genişlik) */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500"/> Kritik Stoklar
            </h2>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
              {lowStockProducts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-50"/>
                  Stok durumu gayet iyi.
                </div>
              ) : (
                <div className="space-y-1">
                  {lowStockProducts.map(product => (
                    <div key={product.id} className="flex items-center justify-between p-3 hover:bg-red-50 rounded-lg transition-colors border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">!</div>
                         <div>
                           <p className="text-sm font-bold text-gray-800 line-clamp-1">{product.name}</p>
                           <p className="text-xs text-gray-500">Güvenlik Limiti: {product.safety_stock}</p>
                         </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">{product.stock_quantity}</p>
                        <p className="text-[10px] text-gray-400 uppercase">{product.unit}</p>
                      </div>
                    </div>
                  ))}
                  
                  {stats.lowStockCount > 5 && (
                    <button onClick={() => router.push('/products')} className="w-full py-2 text-xs text-center text-blue-600 hover:underline">
                      Tümünü Gör ({stats.lowStockCount - 5} daha)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}
