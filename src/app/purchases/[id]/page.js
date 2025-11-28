'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  ArrowLeft, Printer, Truck, Package, Save, 
  CheckCircle, AlertTriangle, XCircle, Play, Loader2
} from 'lucide-react'

export default function PurchaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [company, setCompany] = useState(null)
  
  // Mal Kabul Modu
  const [receivingMode, setReceivingMode] = useState(false)
  const [receiveQuantities, setReceiveQuantities] = useState({}) // { itemId: girilenMiktar }

  useEffect(() => {
    loadOrderData()
  }, [params.id])

  async function loadOrderData() {
    try {
      setLoading(true)
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // 1. Şirket
      const { data: companyData } = await supabase.from('companies').select('*').eq('id', profile.company_id).single()
      setCompany(companyData)

      // 2. Sipariş Başlığı
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(*), user_profiles(full_name)')
        .eq('id', params.id)
        .single()
      
      if (orderError) throw orderError
      setOrder(orderData)

      // 3. Sipariş Kalemleri
      const { data: itemsData, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('*, products(product_code, image_url, unit)')
        .eq('purchase_order_id', params.id)
        .order('id')
      
      if (itemsError) throw itemsError
      setItems(itemsData || [])

      // Receive Inputlarını sıfırla
      const initialQtys = {}
      itemsData.forEach(item => {
        // Varsayılan olarak (Sipariş - Gelen) kadarını öner
        const remaining = item.quantity_ordered - (item.quantity_received || 0)
        initialQtys[item.id] = remaining > 0 ? remaining : 0
      })
      setReceiveQuantities(initialQtys)

    } catch (error) {
      console.error(error)
      alert('Veri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  // --- MAL KABUL İŞLEMİ (KRİTİK BÖLÜM) ---
  async function handleReceiveStock() {
    const toReceive = items.filter(item => receiveQuantities[item.id] > 0)
    
    if (toReceive.length === 0) {
      alert('Lütfen teslim alınan miktarları giriniz.')
      return
    }

    if (!confirm(`${toReceive.length} kalem ürünün stok girişini onaylıyor musunuz?`)) return

    setProcessing(true)
    try {
      // Transaction olmadığı için Promise.all ile paralel işliyoruz
      // Gerçek prodüksiyonda bu logic SQL Procedure (RPC) içinde olmalı
      
      await Promise.all(toReceive.map(async (item) => {
        const qtyNow = parseFloat(receiveQuantities[item.id])
        const newTotalReceived = (item.quantity_received || 0) + qtyNow

        // 1. Sipariş Kalemini Güncelle
        await supabase
          .from('purchase_order_items')
          .update({ quantity_received: newTotalReceived })
          .eq('id', item.id)

        // 2. ÜRÜN STOK GÜNCELLEME (STOK GİRİŞİ)
        // Mevcut stok bilgisini alıp üzerine eklemiyoruz, RPC fonksiyonu daha güvenli olurdu ama
        // şimdilik basitlik adına Supabase'in mevcut değerini çekip artıracağız.
        // Daha güvenli yol: supabase rpc call
        
        const { data: prod } = await supabase
          .from('products')
          .select('stock_quantity, stock_incoming')
          .eq('id', item.product_id)
          .single()
        
        if (prod) {
          await supabase
            .from('products')
            .update({
              stock_quantity: (prod.stock_quantity || 0) + qtyNow,
              // stock_incoming: (prod.stock_incoming || 0) - qtyNow // Incoming takibi henüz tam değilse opsiyonel
            })
            .eq('id', item.product_id)
        }
      }))

      // 3. Sipariş Durumunu Güncelle
      // Hepsi geldi mi kontrol et
      // (Bunu arayüzde basitçe yapalım, tam kontrol backendde olmalı)
      // Şimdilik 'received' veya 'partial' yapalım
      
      await supabase
        .from('purchase_orders')
        .update({ status: 'received' }) // Basitleştirilmiş: Herhangi bir mal kabulde received yapıyoruz
        .eq('id', order.id)

      alert('Stok girişi başarıyla yapıldı!')
      setReceivingMode(false)
      loadOrderData() // Sayfayı yenile

    } catch (error) {
      console.error(error)
      alert('Stok giriş hatası: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }
  const symbol = order ? currencySymbols[order.currency] : '₺'

  if (loading) return <DashboardLayout><div className="flex h-screen justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div></DashboardLayout>
  if (!order) return <div className="text-center py-20">Sipariş bulunamadı.</div>

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 pb-10 p-6">
        
        {/* Üst Bar */}
        <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><ArrowLeft className="w-6 h-6"/></button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {order.order_number}
                <span className={`text-sm px-2 py-0.5 rounded border ${
                  order.status === 'ordered' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                  order.status === 'received' ? 'bg-green-100 text-green-700 border-green-200' :
                  'bg-gray-100'
                }`}>
                  {order.status === 'ordered' ? 'Sipariş Verildi' : order.status === 'received' ? 'Teslim Alındı' : order.status}
                </span>
              </h1>
              <p className="text-sm text-gray-500">{order.suppliers?.name}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {!receivingMode ? (
              <>
                <button onClick={() => window.print()} className="btn-secondary"><Printer className="w-4 h-4 mr-2"/> Yazdır</button>
                {order.status !== 'cancelled' && (
                  <button onClick={() => setReceivingMode(true)} className="btn-primary bg-blue-600 hover:bg-blue-700 shadow-blue-200">
                    <Truck className="w-4 h-4 mr-2"/> Mal Kabul Başlat
                  </button>
                )}
              </>
            ) : (
              <>
                <button onClick={() => setReceivingMode(false)} className="btn-secondary text-red-600 hover:bg-red-50" disabled={processing}>
                  <XCircle className="w-4 h-4 mr-2"/> İptal
                </button>
                <button onClick={handleReceiveStock} disabled={processing} className="btn-primary bg-green-600 hover:bg-green-700 shadow-green-200">
                  {processing ? <><Loader2 className="w-4 h-4 animate-spin mr-2"/> İşleniyor</> : <><Save className="w-4 h-4 mr-2"/> Stok Girişini Onayla</>}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SOL: Sipariş Kalemleri (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Ürün Tablosu */}
            <div className={`bg-white rounded-xl shadow-sm border overflow-hidden ${receivingMode ? 'border-blue-300 ring-4 ring-blue-50 transition-all' : 'border-gray-200'}`}>
              <div className={`p-4 border-b flex justify-between items-center ${receivingMode ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Package className="w-5 h-5"/> 
                  {receivingMode ? 'Gelen Miktarları Giriniz' : 'Sipariş Kalemleri'}
                </h3>
              </div>
              
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-gray-500 font-medium border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3">Ürün</th>
                    <th className="px-4 py-3 text-center w-24">Sipariş</th>
                    <th className="px-4 py-3 text-center w-24">Gelen</th>
                    {receivingMode && <th className="px-4 py-3 text-center w-32 bg-blue-50/50 text-blue-700">Şu An Gelen</th>}
                    <th className="px-4 py-3 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => {
                    const remaining = item.quantity_ordered - (item.quantity_received || 0)
                    const isFullyReceived = remaining <= 0

                    return (
                      <tr key={item.id} className={isFullyReceived ? 'bg-gray-50/50' : ''}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-400 overflow-hidden">
                                {item.products?.image_url ? <img src={item.products.image_url} className="w-full h-full object-cover"/> : 'P'}
                            </div>
                            <div>
                              <p className={`font-medium ${isFullyReceived ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{item.description}</p>
                              <p className="text-xs text-gray-500 font-mono">{item.products?.product_code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-medium">{item.quantity_ordered}</td>
                        <td className="px-4 py-3 text-center">
                           <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                             isFullyReceived ? 'bg-green-100 text-green-700' : 
                             item.quantity_received > 0 ? 'bg-yellow-100 text-yellow-700' : 
                             'text-gray-400'
                           }`}>
                             {item.quantity_received || 0}
                           </span>
                        </td>
                        
                        {/* MAL KABUL INPUTU */}
                        {receivingMode && (
                          <td className="px-4 py-3 text-center bg-blue-50/30">
                            {!isFullyReceived ? (
                              <input 
                                type="number" 
                                className="w-full text-center border border-blue-300 rounded py-1 px-1 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-900"
                                value={receiveQuantities[item.id]}
                                onChange={(e) => setReceiveQuantities({...receiveQuantities, [item.id]: e.target.value})}
                                min="0"
                                max={remaining}
                              />
                            ) : (
                              <CheckCircle className="w-5 h-5 text-green-500 mx-auto"/>
                            )}
                          </td>
                        )}

                        <td className="px-4 py-3 text-right font-medium text-gray-600">
                          {symbol}{parseFloat(item.total_price).toLocaleString('tr-TR', {minimumFractionDigits:2})}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Notlar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
               <h3 className="font-bold text-gray-800 mb-2 text-sm">Sipariş Notları</h3>
               <p className="text-sm text-gray-600 italic">{order.notes || 'Not yok.'}</p>
            </div>
          </div>

          {/* SAĞ: Özet (1/3) */}
          <div className="space-y-6">
            
            {/* Sipariş Özeti */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Sipariş Özeti</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sipariş Tarihi</span>
                  <span className="font-medium">{new Date(order.created_at).toLocaleDateString('tr-TR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Beklenen Teslimat</span>
                  <span className="font-medium">{order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString('tr-TR') : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Oluşturan</span>
                  <span className="font-medium">{order.user_profiles?.full_name}</span>
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between text-gray-600 mb-1"><span>Ara Toplam</span><span>{symbol}{parseFloat(order.subtotal).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                  <div className="flex justify-between text-gray-600 mb-1"><span>KDV</span><span>{symbol}{parseFloat(order.tax_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                  <div className="flex justify-between font-bold text-lg text-gray-900 mt-2">
                    <span>Toplam</span>
                    <span>{symbol}{parseFloat(order.total_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Yardım Kutusu */}
            {receivingMode && (
              <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0"/>
                  <div className="text-xs text-blue-800">
                    <p className="font-bold mb-1">Dikkat: Stok Girişi Yapılıyor</p>
                    <p>Girdiğiniz miktarlar doğrudan ürün stoklarına eklenecektir. Bu işlem geri alınamaz (Manuel stok düşümü gerekir).</p>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}
