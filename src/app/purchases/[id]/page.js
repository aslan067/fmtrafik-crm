'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  ArrowLeft, Printer, Truck, Package, Save, 
  CheckCircle, AlertTriangle, XCircle, Clock, Check
} from 'lucide-react'

export default function PurchaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const [processing, setProcessing] = useState(false)
  
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [company, setCompany] = useState(null)
  
  // Mal Kabul Modu
  const [receivingMode, setReceivingMode] = useState(false)
  const [receiveQuantities, setReceiveQuantities] = useState({}) 

  useEffect(() => {
    loadOrderData()
  }, [params.id])

  async function loadOrderData() {
    try {
      setLoading(true)
      setErrorMsg(null)

      const user = await getCurrentUser()
      if (!user) return

      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // 1. Şirket
      const { data: companyData } = await supabase.from('companies').select('*').eq('id', profile.company_id).single()
      setCompany(companyData)

      // 2. Sipariş Başlığı
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(*)') 
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
      if (itemsData) {
        itemsData.forEach(item => {
          const remaining = item.quantity_ordered - (item.quantity_received || 0)
          initialQtys[item.id] = remaining > 0 ? remaining : 0
        })
      }
      setReceiveQuantities(initialQtys)

    } catch (error) {
      console.error('Detay Yükleme Hatası:', error)
      setErrorMsg(error.message)
    } finally {
      setLoading(false)
    }
  }

  // --- AKILLI MAL KABUL İŞLEMİ ---
  async function handleReceiveStock() {
    const toReceive = items.filter(item => parseFloat(receiveQuantities[item.id] || 0) > 0)
    
    if (toReceive.length === 0) {
      alert('Lütfen teslim alınan miktarları giriniz.')
      return
    }

    if (!confirm(`${toReceive.length} kalem ürünün stok girişini ve durum güncellemesini onaylıyor musunuz?`)) return

    setProcessing(true)
    try {
      let totalOrderedCount = 0
      let totalReceivedCount = 0

      for (const item of items) {
        const qtyNow = parseFloat(receiveQuantities[item.id] || 0)
        const currentReceived = parseFloat(item.quantity_received || 0)
        const newTotalReceived = currentReceived + qtyNow
        
        totalOrderedCount += parseFloat(item.quantity_ordered)
        totalReceivedCount += newTotalReceived

        if (qtyNow > 0) {
          // A. Sipariş Kalemini Güncelle
          await supabase
            .from('purchase_order_items')
            .update({ quantity_received: newTotalReceived })
            .eq('id', item.id)

          // B. ÜRÜN STOK GÜNCELLEME
          const { data: prod } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .single()
          
          if (prod) {
            await supabase
              .from('products')
              .update({ stock_quantity: (prod.stock_quantity || 0) + qtyNow })
              .eq('id', item.product_id)
          }
        }
      }

      let newStatus = 'ordered'
      if (totalReceivedCount >= totalOrderedCount) {
        newStatus = 'completed'
      } else if (totalReceivedCount > 0) {
        newStatus = 'partial'
      }

      await supabase
        .from('purchase_orders')
        .update({ status: newStatus })
        .eq('id', order.id)

      alert(newStatus === 'completed' 
        ? 'Tüm ürünler teslim alındı. Sipariş TAMAMLANDI.' 
        : 'Kısmi teslimat kaydedildi. Sipariş açık kalmaya devam edecek.')
      
      setReceivingMode(false)
      loadOrderData()

    } catch (error) {
      console.error(error)
      alert('İşlem hatası: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }
  const symbol = order ? currencySymbols[order.currency] : '₺'

  const getStatusBadge = (status) => {
    const configs = {
      draft: { color: 'bg-gray-100 text-gray-700', label: 'Taslak', icon: Clock },
      ordered: { color: 'bg-blue-100 text-blue-700', label: 'Sipariş Verildi', icon: Truck },
      partial: { color: 'bg-orange-100 text-orange-700', label: 'Kısmi Teslimat', icon: AlertTriangle },
      completed: { color: 'bg-green-100 text-green-700', label: 'Tamamlandı', icon: CheckCircle },
      received: { color: 'bg-green-100 text-green-700', label: 'Tamamlandı', icon: CheckCircle },
      cancelled: { color: 'bg-red-100 text-red-700', label: 'İptal', icon: XCircle },
    }
    const config = configs[status] || configs.draft
    const Icon = config.icon
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border border-transparent flex items-center gap-1.5 ${config.color}`}>
        <Icon className="w-3.5 h-3.5"/> {config.label}
      </span>
    )
  }

  if (loading) return <DashboardLayout><div className="flex h-screen justify-center items-center">Yükleniyor...</div></DashboardLayout>
  if (errorMsg) return <DashboardLayout><div className="p-10 text-center text-red-500">{errorMsg}</div></DashboardLayout>
  if (!order) return <div className="text-center py-20">Sipariş bulunamadı.</div>

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 pb-10 p-6 print:hidden">
        
        {/* Üst Bar */}
        <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><ArrowLeft className="w-6 h-6"/></button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{order.order_number}</h1>
                {getStatusBadge(order.status)}
              </div>
              <p className="text-sm text-gray-500">{order.suppliers?.name}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {!receivingMode ? (
              <>
                <button onClick={() => window.print()} className="btn-secondary"><Printer className="w-4 h-4 mr-2"/> Sipariş Formu Yazdır</button>
                {order.status !== 'cancelled' && order.status !== 'completed' && (
                  <button onClick={() => setReceivingMode(true)} className="btn-primary bg-blue-600 hover:bg-blue-700 shadow-blue-200">
                    <Truck className="w-4 h-4 mr-2"/> Mal Kabul / Stok Girişi
                  </button>
                )}
              </>
            ) : (
              <>
                <button onClick={() => setReceivingMode(false)} className="btn-secondary text-red-600 hover:bg-red-50" disabled={processing}>
                  <XCircle className="w-4 h-4 mr-2"/> İptal
                </button>
                <button onClick={handleReceiveStock} disabled={processing} className="btn-primary bg-green-600 hover:bg-green-700 shadow-green-200">
                  {processing ? 'İşleniyor...' : <><Save className="w-4 h-4 mr-2"/> Girişi Onayla</>}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SOL: Sipariş Kalemleri */}
          <div className="lg:col-span-2 space-y-6">
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
                    <th className="px-4 py-3 text-center w-32">Teslim Durumu</th>
                    {receivingMode && <th className="px-4 py-3 text-center w-32 bg-blue-50/50 text-blue-700">Şu An Gelen</th>}
                    <th className="px-4 py-3 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => {
                    const remaining = item.quantity_ordered - (item.quantity_received || 0)
                    const isFullyReceived = remaining <= 0
                    const receivedPercent = Math.min(100, ((item.quantity_received || 0) / item.quantity_ordered) * 100)

                    return (
                      <tr key={item.id} className={isFullyReceived ? 'bg-green-50/40' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-400 overflow-hidden">
                                {item.products?.image_url ? <img src={item.products.image_url} className="w-full h-full object-cover"/> : item.products?.product_code?.substring(0,2) || 'P'}
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* YENİ TASARIM: Çizgi yerine silikleştirme ve İkon */}
                              <div className="flex items-center gap-2">
                                <p className={`font-medium truncate ${isFullyReceived ? 'text-gray-500' : 'text-gray-900'}`}>
                                  {item.description}
                                </p>
                                {isFullyReceived && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                              </div>
                              <p className="text-xs text-gray-500 font-mono">{item.products?.product_code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-gray-700">{item.quantity_ordered}</td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-[10px] text-gray-500">
                              <span>{item.quantity_received || 0} Gelen</span>
                              {remaining > 0 ? (
                                <span className="text-orange-600 font-bold">{remaining} Bekleyen</span>
                              ) : (
                                <span className="text-green-600 font-bold">Tamamlandı</span>
                              )}
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-1.5 rounded-full ${isFullyReceived ? 'bg-green-500' : 'bg-orange-400'}`} style={{ width: `${receivedPercent}%` }}></div>
                            </div>
                          </div>
                        </td>
                        
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
                              <span className="text-xs font-bold text-green-600 flex items-center justify-center gap-1">
                                <Check className="w-3 h-3"/> Tamam
                              </span>
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
               <h3 className="font-bold text-gray-800 mb-2 text-sm">Sipariş Notları</h3>
               <p className="text-sm text-gray-600 italic">{order.notes || 'Not yok.'}</p>
            </div>
          </div>

          {/* SAĞ: Özet */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Sipariş Özeti</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Sipariş Tarihi</span><span className="font-medium">{new Date(order.created_at).toLocaleDateString('tr-TR')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Beklenen Teslimat</span><span className="font-medium">{order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString('tr-TR') : '-'}</span></div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between text-gray-600 mb-1"><span>Ara Toplam</span><span>{symbol}{parseFloat(order.subtotal).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                  <div className="flex justify-between text-gray-600 mb-1"><span>KDV</span><span>{symbol}{parseFloat(order.tax_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                  <div className="flex justify-between font-bold text-lg text-gray-900 mt-2"><span>Toplam</span><span>{symbol}{parseFloat(order.total_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                </div>
              </div>
            </div>

            {receivingMode && (
              <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0"/>
                  <div className="text-xs text-blue-800">
                    <p className="font-bold mb-1">Stok Güncellemesi</p>
                    <p>Onayladığınız miktarlar otomatik olarak ürün stoğuna eklenecektir. Eksik kalan ürünler için sipariş "Kısmi Teslimat" durumuna geçecektir.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- A4 YAZDIRMA ŞABLONU --- */}
      <div id="print-area" className="hidden print:block bg-white text-black p-[10mm]">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-8">
          <div className="flex items-center gap-4">
             {company?.logo_url && <img src={company.logo_url} className="h-20 object-contain" alt="Logo"/>}
             <div>
               <h1 className="text-2xl font-bold uppercase tracking-tight">{company?.name}</h1>
               <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                 <p>{company?.address}</p>
                 <p>{company?.phone} - {company?.email}</p>
                 <p>V.D: {company?.tax_office} - No: {company?.tax_number}</p>
               </div>
             </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold text-gray-900 uppercase">Satınalma Siparişi</h2>
            <p className="text-sm font-bold mt-1">Sipariş No: {order.order_number}</p>
            <p className="text-sm text-gray-600">Tarih: {new Date(order.created_at).toLocaleDateString('tr-TR')}</p>
          </div>
        </div>

        {/* Tedarikçi Bilgileri */}
        <div className="mb-8 border rounded p-4 bg-gray-50">
           <h3 className="text-xs font-bold uppercase text-gray-500 mb-1 border-b pb-1 w-full">TEDARİKÇİ (SAYIN)</h3>
           <p className="font-bold text-lg">{order.suppliers?.name}</p>
           <p className="text-sm text-gray-700">{order.suppliers?.contact_name}</p>
           <p className="text-sm text-gray-600">{order.suppliers?.email} - {order.suppliers?.phone}</p>
           <p className="text-sm text-gray-600">{order.suppliers?.address}</p>
        </div>

        {/* Tablo */}
        <table className="w-full mb-8 border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-gray-800 bg-gray-100 uppercase text-xs font-bold">
              <th className="py-2 px-2 text-center border w-10">#</th>
              <th className="py-2 px-2 text-left border">Ürün / Açıklama</th>
              <th className="py-2 px-2 text-center border w-20">Miktar</th>
              <th className="py-2 px-2 text-right border w-24">Birim Fiyat</th>
              <th className="py-2 px-2 text-right border w-28">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="py-2 px-2 text-center border">{idx + 1}</td>
                <td className="py-2 px-2 border">
                  <p className="font-bold">{item.description}</p>
                  <p className="text-xs text-gray-500">{item.products?.product_code}</p>
                </td>
                <td className="py-2 px-2 text-center border font-bold">{item.quantity_ordered} {item.products?.unit}</td>
                <td className="py-2 px-2 text-right border">{symbol}{parseFloat(item.unit_price).toLocaleString('tr-TR', {minimumFractionDigits:2})}</td>
                <td className="py-2 px-2 text-right border font-bold">{symbol}{parseFloat(item.total_price).toLocaleString('tr-TR', {minimumFractionDigits:2})}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Alt Toplamlar */}
        <div className="flex justify-end mb-12">
           <div className="w-64 space-y-1 text-right text-sm">
             <div className="flex justify-between border-b border-dashed pb-1"><span>Ara Toplam:</span><span>{symbol}{parseFloat(order.subtotal).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
             <div className="flex justify-between border-b border-dashed pb-1"><span>KDV Toplam:</span><span>{symbol}{parseFloat(order.tax_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
             <div className="flex justify-between font-bold text-lg pt-1"><span>GENEL TOPLAM:</span><span>{symbol}{parseFloat(order.total_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
           </div>
        </div>

        {/* Notlar ve İmza */}
        <div className="grid grid-cols-2 gap-10 text-sm">
          <div>
            <h4 className="font-bold uppercase border-b mb-2 pb-1">Sipariş Notları</h4>
            <p className="text-gray-700 italic">{order.notes || '-'}</p>
          </div>
          <div className="text-center mt-8">
            <div className="h-20"></div>
            <div className="border-t border-black pt-2 w-2/3 mx-auto">
              <p className="font-bold">Kaşe / İmza</p>
              <p className="text-xs text-gray-500">Yetkili Onayı</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          @page { size: auto; margin: 10mm; }
        }
      `}</style>
    </DashboardLayout>
  )
}
