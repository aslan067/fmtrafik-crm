'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  TrendingUp, FileText, AlertTriangle, Package, 
  ArrowRight, Plus, ShoppingCart, Truck, Wallet,
  ChevronRight, Activity
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

      // Paralel Veri Çekme
      const [quotesRes, salesRes, productsRes, purchasesRes] = await Promise.all([
        supabase.from('quotes').select('id', { count: 'exact' }).eq('company_id', companyId).eq('status', 'sent'),
        supabase.from('sales').select('total_amount, currency').eq('company_id', companyId),
        supabase.from('products').select('id, name, stock_quantity, safety_stock, unit').eq('company_id', companyId).eq('is_active', true),
        supabase.from('purchase_orders').select('id', { count: 'exact' }).eq('company_id', companyId).in('status', ['ordered', 'partial'])
      ])

      // Hesaplamalar
      const totalRevenue = (salesRes.data || []).reduce((acc, curr) => acc + (curr.currency === 'TRY' ? curr.total_amount : 0), 0)
      const lowStockItems = (productsRes.data || []).filter(p => p.stock_quantity <= (p.safety_stock || 5))

      setStats({
        pendingQuotes: quotesRes.count || 0,
        monthlyRevenue: totalRevenue,
        lowStockCount: lowStockItems.length,
        activePurchases: purchasesRes.count || 0
      })

      setLowStockProducts(lowStockItems.slice(0, 5))

      // Son Satışlar
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
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Genel Bakış</h1>
            <p className="text-gray-500 text-sm mt-1">İşletmenizin performans özeti ve hızlı aksiyonlar.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/quotes/new')} className="btn-secondary text-sm shadow-sm bg-white">
              <Plus className="w-4 h-4 mr-2"/> Teklif Hazırla
            </button>
            <button onClick={() => router.push('/purchases/new')} className="btn-primary text-sm shadow-md shadow-blue-100">
              <Plus className="w-4 h-4 mr-2"/> Sipariş Ver
            </button>
          </div>
        </div>

        {/* --- KPI STAT CARDS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Ciro */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Toplam Ciro</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2 group-hover:text-blue-600 transition-colors">
                  {currencyFormatter.format(stats.monthlyRevenue)}
                </h3>
              </div>
              <div className="p-3 bg-green-50 rounded-xl text-green-600 group-hover:scale-110 transition-transform">
                <Wallet className="w-6 h-6"/>
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-green-600 font-medium">
              <TrendingUp className="w-3 h-3 mr-1"/> Güncel veri
            </div>
          </div>

          {/* Bekleyen Teklifler */}
          <div 
            onClick={() => router.push('/quotes')}
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Açık Teklifler</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2 group-hover:text-blue-600 transition-colors">
                  {stats.pendingQuotes}
                </h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6"/>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-400">Onay bekleyenler</div>
          </div>

          {/* Aktif Satınalma */}
          <div 
            onClick={() => router.push('/purchases')}
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Yoldaki Siparişler</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2 group-hover:text-blue-600 transition-colors">
                  {stats.activePurchases}
                </h3>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl text-purple-600 group-hover:scale-110 transition-transform">
                <Truck className="w-6 h-6"/>
              </div>
            </div>
            <div className="mt-4 text-xs text-purple-600 font-medium">Teslimat bekleniyor</div>
          </div>

          {/* Kritik Stok */}
          <div 
            onClick={() => router.push('/products')}
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Kritik Stok</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2 text-red-600">
                  {stats.lowStockCount}
                </h3>
              </div>
              <div className="p-3 bg-red-50 rounded-xl text-red-600 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-6 h-6"/>
              </div>
            </div>
            <div className="mt-4 text-xs text-red-500 font-medium">Ürün azalıyor!</div>
          </div>
        </div>

        {/* --- GRID CONTENT --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SOL: SON SATIŞLAR TABLOSU */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600"/> Son Satış Hareketleri
              </h2>
              <button onClick={() => router.push('/sales')} className="text-sm text-gray-500 hover:text-blue-600 flex items-center transition-colors">
                Tümü <ChevronRight className="w-4 h-4"/>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-xs border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4">Müşteri</th>
                      <th className="px-6 py-4">Tutar</th>
                      <th className="px-6 py-4">Durum</th>
                      <th className="px-6 py-4 text-right">Tarih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentSales.length === 0 ? (
                      <tr><td colSpan="4" className="text-center py-10 text-gray-400">Henüz satış kaydı yok.</td></tr>
                    ) : (
                      recentSales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">{sale.customers?.name}</td>
                          <td className="px-6 py-4 font-bold text-gray-900 font-mono">
                            {sale.currency === 'USD' ? '$' : sale.currency === 'EUR' ? '€' : '₺'}
                            {sale.total_amount.toLocaleString('tr-TR')}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              sale.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                              sale.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {sale.payment_status === 'paid' ? 'Ödendi' : sale.payment_status === 'partial' ? 'Kısmi' : 'Bekliyor'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-xs text-right">
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

          {/* SAĞ: KRİTİK STOK LİSTESİ */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 px-1">
              <AlertTriangle className="w-5 h-5 text-red-500"/> Kritik Stoklar
            </h2>
            
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-2 flex flex-col h-full max-h-[400px] overflow-y-auto custom-scrollbar">
              {lowStockProducts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                  <Package className="w-10 h-10 mb-2 opacity-20"/>
                  <p className="text-sm">Stoklarınız güvende.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {lowStockProducts.map(product => (
                    <div 
                      key={product.id} 
                      onClick={() => router.push('/products')}
                      className="flex items-center justify-between p-3 hover:bg-red-50/50 rounded-xl transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                         <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600 font-bold text-xs flex-shrink-0 border border-red-100 group-hover:bg-red-100 transition-colors">
                           !
                         </div>
                         <div className="min-w-0">
                           <p className="text-sm font-bold text-gray-800 truncate group-hover:text-red-700 transition-colors">{product.name}</p>
                           <p className="text-xs text-gray-500">Limit: {product.safety_stock} {product.unit}</p>
                         </div>
                      </div>
                      <div className="text-right pl-2">
                        <p className="text-lg font-bold text-red-600">{product.stock_quantity}</p>
                      </div>
                    </div>
                  ))}
                  
                  {stats.lowStockCount > 5 && (
                    <button onClick={() => router.push('/products')} className="w-full py-3 text-xs text-center text-blue-600 hover:text-blue-700 font-medium border-t border-gray-50 mt-2">
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
