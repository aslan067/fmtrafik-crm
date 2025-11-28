'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  ArrowLeft, Printer, Truck, Package, Save, 
  CheckCircle, AlertTriangle, XCircle, FileText, 
  Calendar, DollarSign, Box, ClipboardCheck
} from 'lucide-react'

export default function PurchaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [company, setCompany] = useState(null)
  
  // Modlar: 'view' (Görüntüleme), 'receiving' (Mal Kabul - Depo), 'invoice' (Fatura - Muhasebe)
  const [mode, setMode] = useState('view') 
  const [receiveQuantities, setReceiveQuantities] = useState({})
  
  // Fatura Girişi State'i
  const [invoiceData, setInvoiceData] = useState({
    invoice_number: '',
    invoice_date: '',
    invoice_amount: '' // Kontrol için
  })

  useEffect(() => {
    loadOrderData()
  }, [params.id])

  async function loadOrderData() {
    try {
      setLoading(true)
      const user = await getCurrentUser()
      if (!user) return

      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()
      const { data: companyData } = await supabase.from('companies').select('*').eq('id', profile.company_id).single()
      setCompany(companyData)

      // Sipariş Verisi (Fatura alanları veritabanında varsa çekilmeli, yoksa simüle ediyoruz)
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(*)') 
        .eq('id', params.id)
        .single()
      
      if (orderError) throw orderError
      setOrder(orderData)
      
      // Varsa mevcut fatura bilgilerini state'e at
      setInvoiceData({
        invoice_number: orderData.invoice_number || '',
        invoice_date: orderData.invoice_date || '',
        invoice_amount: orderData.invoice_amount || ''
      })

      const { data: itemsData, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('*, products(product_code, image_url, unit)')
        .eq('purchase_order_id', params.id)
        .order('id')
      
      if (itemsError) throw itemsError
      setItems(itemsData || [])

      // Mal Kabul inputları için önerilen değerler
      const initialQtys = {}
      if (itemsData) {
        itemsData.forEach(item => {
          const remaining = item.quantity_ordered - (item.quantity_received || 0)
          initialQtys[item.id] = remaining > 0 ? remaining : 0
        })
      }
      setReceiveQuantities(initialQtys)

    } catch (error) {
      console.error(error)
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  // --- 1. MAL KABUL (DEPO) İŞLEMİ ---
  async function handleReceiveStock() {
    const toReceive = items.filter(item => parseFloat(receiveQuantities[item.id] || 0) > 0)
    if (toReceive.length === 0) return alert('Lütfen teslim alınan miktarları giriniz.')
    if (!confirm(`${toReceive.length} kalem ürünün DEPO GİRİŞİNİ onaylıyor musunuz?`)) return

    setProcessing(true)
    try {
      let totalOrdered = 0
      let totalReceived = 0

      for (const item of items) {
        const qtyNow = parseFloat(receiveQuantities[item.id] || 0)
        const currentReceived = parseFloat(item.quantity_received || 0)
        const newTotalReceived = currentReceived + qtyNow
        
        totalOrdered += parseFloat(item.quantity_ordered)
        totalReceived += newTotalReceived

        if (qtyNow > 0) {
          // A. Kalem Güncelle
          await supabase.from('purchase_order_items').update({ quantity_received: newTotalReceived }).eq('id', item.id)
          // B. Stok Artır
          const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single()
          if (prod) {
            await supabase.from('products').update({ stock_quantity: (prod.stock_quantity || 0) + qtyNow }).eq('id', item.product_id)
          }
        }
      }

      // Durum: Hepsini aldıysak 'received' (Muhasebe onayı bekliyor), yoksa 'partial'
      const newStatus = totalReceived >= totalOrdered ? 'received' : 'partial'
      
      await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', order.id)

      alert('Mal kabul işlemi yapıldı ve stoklara işlendi.')
      setMode('view')
      loadOrderData()
    } catch (error) {
      alert('Hata: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }

  // --- 2. FATURA GİRİŞİ (MUHASEBE) İŞLEMİ ---
  async function handleInvoiceSave() {
    if (!invoiceData.invoice_number) return alert('Lütfen fatura numarasını giriniz.')

    setProcessing(true)
    try {
      // Veritabanında bu alanlar yoksa SQL ile eklenmeli:
      // ALTER TABLE purchase_orders ADD COLUMN invoice_number text, ADD COLUMN invoice_date date;
      
      await supabase
        .from('purchase_orders')
        .update({
          invoice_number: invoiceData.invoice_number,
          invoice_date: invoiceData.invoice_date || new Date(),
          status: 'completed' // Fatura da girilince süreç tamamen biter
        })
        .eq('id', order.id)

      alert('Fatura bilgileri kaydedildi ve sipariş KAPATILDI.')
      setMode('view')
      loadOrderData()
    } catch (error) {
      console.error(error)
      alert('Kaydetme hatası (Veritabanı sütunları eksik olabilir).')
    } finally {
      setProcessing(false)
    }
  }

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }
  const symbol = order ? currencySymbols[order.currency] : '₺'

  if (loading) return <DashboardLayout><div className="flex h-screen justify-center items-center">Yükleniyor...</div></DashboardLayout>
  if (!order) return <div className="text-center py-20">Sipariş bulunamadı.</div>

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 pb-20 p-4 md:p-6 print:hidden">
        
        {/* --- HEADER (Mobil Uyumlu) --- */}
        <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><ArrowLeft className="w-6 h-6"/></button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">{order.order_number}</h1>
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                  order.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                  order.status === 'received' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                  'bg-orange-100 text-orange-700 border-orange-200'
                }`}>
                  {order.status === 'ordered' ? 'Sipariş Verildi' : 
                   order.status === 'received' ? 'Depo Teslim Aldı' : 
                   order.status === 'completed' ? 'Faturası İşlendi' : 
                   order.status === 'partial' ? 'Kısmi Teslimat' : order.status}
                </span>
              </div>
              <p className="text-sm text-gray-500">{order.suppliers?.name}</p>
            </div>
          </div>
          
          {/* Aksiyon Butonları */}
          <div className="flex flex-wrap gap-2">
            {mode === 'view' && (
              <>
                <button onClick={() => window.print()} className="btn-secondary text-xs"><Printer className="w-4 h-4 md:mr-2"/> <span className="hidden md:inline">Yazdır</span></button>
                
                {/* Muhasebe Butonu */}
                <button onClick={() => setMode('invoice')} className="btn-secondary bg-white text-purple-700 border-purple-200 hover:bg-purple-50 text-xs">
                  <FileText className="w-4 h-4 md:mr-2"/> <span className="hidden md:inline">Fatura Girişi</span><span className="md:hidden">Fatura</span>
                </button>

                {/* Depo Butonu */}
                {order.status !== 'completed' && (
                  <button onClick={() => setMode('receiving')} className="btn-primary bg-blue-600 hover:bg-blue-700 shadow-blue-200 text-xs">
                    <Truck className="w-4 h-4 md:mr-2"/> <span className="hidden md:inline">Mal Kabul</span><span className="md:hidden">Depo</span>
                  </button>
                )}
              </>
            )}

            {(mode === 'receiving' || mode === 'invoice') && (
              <>
                <button onClick={() => setMode('view')} className="btn-secondary text-red-600 hover:bg-red-50 text-xs" disabled={processing}>
                  <XCircle className="w-4 h-4 md:mr-2"/> İptal
                </button>
                {mode === 'receiving' && (
                  <button onClick={handleReceiveStock} disabled={processing} className="btn-primary bg-green-600 hover:bg-green-700 shadow-green-200 text-xs">
                    {processing ? 'İşleniyor...' : <><Save className="w-4 h-4 md:mr-2"/> Stok Girişini Onayla</>}
                  </button>
                )}
                {mode === 'invoice' && (
                  <button onClick={handleInvoiceSave} disabled={processing} className="btn-primary bg-purple-600 hover:bg-purple-700 shadow-purple-200 text-xs">
                    {processing ? 'Kaydediliyor...' : <><CheckCircle className="w-4 h-4 md:mr-2"/> Faturayı İşle & Kapat</>}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* --- MUHASEBE MODU: FATURA GİRİŞ PANELİ --- */}
        {mode === 'invoice' && (
          <div className="max-w-6xl mx-auto mb-6 bg-purple-50 border border-purple-100 rounded-xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4">
            <h3 className="font-bold text-purple-900 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5"/> Muhasebe / Fatura İşlemleri</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-purple-700 mb-1">Tedarikçi Fatura No</label>
                <input 
                  type="text" 
                  className="input-field border-purple-200 focus:ring-purple-500"
                  placeholder="Örn: ABC2025..."
                  value={invoiceData.invoice_number}
                  onChange={(e) => setInvoiceData({...invoiceData, invoice_number: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-purple-700 mb-1">Fatura Tarihi</label>
                <input 
                  type="date" 
                  className="input-field border-purple-200 focus:ring-purple-500"
                  value={invoiceData.invoice_date}
                  onChange={(e) => setInvoiceData({...invoiceData, invoice_date: e.target.value})}
                />
              </div>
              <div className="flex items-end pb-1 text-sm text-purple-800">
                <p>Sipariş Toplamı: <span className="font-bold">{symbol}{parseFloat(order.total_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></p>
              </div>
            </div>
            <div className="mt-4 text-xs text-purple-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4"/>
              Fatura bilgilerini girip onayladığınızda sipariş durumu "Tamamlandı" olarak güncellenecektir.
            </div>
          </div>
        )}

        {/* --- İÇERİK ALANI --- */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SOL: ÜRÜN LİSTESİ (Mobil Uyumlu) */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Başlık */}
            <div className={`rounded-xl shadow-sm border p-4 flex justify-between items-center ${mode === 'receiving' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>
              <h3 className="font-bold flex items-center gap-2">
                {mode === 'receiving' ? <><Box className="w-5 h-5"/> Depo Giriş Ekranı</> : <><Package className="w-5 h-5"/> Sipariş Kalemleri</>}
              </h3>
              {mode === 'receiving' && <span className="text-xs bg-blue-500 px-2 py-1 rounded text-white border border-blue-400">Fiyatlar Gizlendi</span>}
            </div>

            {/* Ürün Listesi Container */}
            <div className="space-y-3">
              {items.map((item) => {
                const remaining = item.quantity_ordered - (item.quantity_received || 0)
                const isFullyReceived = remaining <= 0
                const receivedPercent = Math.min(100, ((item.quantity_received || 0) / item.quantity_ordered) * 100)

                return (
                  // KART YAPISI (Hem Mobil Hem Desktop İçin Ortak Kullanılabilir Modern Kart)
                  <div key={item.id} className={`bg-white rounded-lg border shadow-sm p-4 transition-all ${
                    isFullyReceived ? 'border-gray-100 bg-gray-50 opacity-80' : 
                    mode === 'receiving' ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-200'
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      
                      {/* Sol: Ürün Bilgisi */}
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-400 overflow-hidden flex-shrink-0">
                          {item.products?.image_url ? <img src={item.products.image_url} className="w-full h-full object-cover"/> : 'P'}
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${isFullyReceived ? 'text-gray-500' : 'text-gray-900'}`}>{item.description}</p>
                          <p className="text-xs text-gray-500 font-mono">{item.products?.product_code}</p>
                          
                          {/* Sadece View ve Invoice modunda fiyatı göster */}
                          {mode !== 'receiving' && (
                            <p className="text-xs font-medium text-gray-600 mt-1">
                              Birim: {symbol}{parseFloat(item.unit_price).toLocaleString('tr-TR')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Sağ: Durum ve Miktar */}
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">Sipariş</div>
                        <div className="text-lg font-bold text-gray-900">{item.quantity_ordered} <span className="text-xs font-normal text-gray-500">{item.products?.unit}</span></div>
                      </div>
                    </div>

                    {/* Progress Bar & Durum Özeti */}
                    <div className="mt-3 bg-gray-100 rounded-full h-2 w-full overflow-hidden">
                       <div className={`h-full ${isFullyReceived ? 'bg-green-500' : 'bg-orange-400'}`} style={{ width: `${receivedPercent}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs mt-1 font-medium">
                      <span className="text-gray-500">{item.quantity_received || 0} Teslim Alındı</span>
                      <span className={remaining > 0 ? 'text-orange-600' : 'text-green-600'}>
                        {remaining > 0 ? `${remaining} Bekleyen` : 'Tamamlandı'}
                      </span>
                    </div>

                    {/* --- DEPO GİRİŞ MODU INPUT ALANI --- */}
                    {mode === 'receiving' && !isFullyReceived && (
                      <div className="mt-4 pt-4 border-t border-dashed border-blue-200">
                        <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                          <span className="text-sm font-bold text-blue-800">Şu An Gelen:</span>
                          <div className="flex items-center gap-2">
                             <input 
                               type="number" 
                               className="w-24 text-center text-lg font-bold text-blue-900 bg-white border border-blue-300 rounded-md py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                               value={receiveQuantities[item.id]}
                               onChange={(e) => setReceiveQuantities({...receiveQuantities, [item.id]: e.target.value})}
                               placeholder="0"
                               min="0"
                               max={remaining}
                             />
                             <span className="text-xs font-bold text-blue-400">{item.products?.unit}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
               <h3 className="font-bold text-gray-800 mb-2 text-sm">Sipariş Notları</h3>
               <p className="text-sm text-gray-600 italic">{order.notes || 'Not yok.'}</p>
            </div>
          </div>

          {/* SAĞ: FİNANSAL ÖZET (Sadece View ve Invoice modunda görünür) */}
          {mode !== 'receiving' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide border-b pb-2">Sipariş Finansalları</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Ara Toplam</span><span>{symbol}{parseFloat(order.subtotal).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">KDV Tutarı</span><span>{symbol}{parseFloat(order.tax_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                  <div className="flex justify-between font-bold text-lg text-gray-900 border-t pt-2 mt-2">
                    <span>Toplam Tutar</span>
                    <span>{symbol}{parseFloat(order.total_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
                  </div>
                </div>
                
                {/* Fatura Bilgisi Varsa Göster */}
                {order.invoice_number && (
                  <div className="mt-4 bg-purple-50 p-3 rounded border border-purple-100 text-xs">
                    <p className="font-bold text-purple-800">İşlenen Fatura:</p>
                    <p className="text-purple-700">No: {order.invoice_number}</p>
                    <p className="text-purple-700">Tarih: {new Date(order.invoice_date).toLocaleDateString('tr-TR')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SAĞ: DEPO UYARI KUTUSU (Sadece Receiving modunda) */}
          {mode === 'receiving' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sticky top-6">
                <div className="flex flex-col items-center text-center">
                  <ClipboardCheck className="w-12 h-12 text-blue-600 mb-3"/>
                  <h3 className="font-bold text-gray-900">Mal Kabul Modu</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    Şu anda depo giriş ekranındasınız. Lütfen araçtan inen ürünleri sayarak ilgili kutucuklara giriniz.
                  </p>
                  <div className="mt-4 w-full bg-blue-50 p-3 rounded text-left text-xs text-blue-800 border border-blue-100">
                    <p className="font-bold mb-1">Hatırlatma:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Kırık/Hasarlı ürünleri teslim almayınız.</li>
                      <li>Fazla gelen ürünleri sisteme girmeyiniz.</li>
                      <li>Onayladığınız an stoklar artacaktır.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- A4 YAZDIRMA ŞABLONU (Değişmedi - Aynı kalabilir) --- */}
      <div id="print-area" className="hidden print:block bg-white text-black p-[10mm]">
         {/* ... (Önceki yazdırma kodu ile aynı bırakabilirsiniz) ... */}
         <div className="text-center font-bold text-xl py-10 border border-black">A4 Yazdırma Şablonu Buraya Gelecek</div>
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
