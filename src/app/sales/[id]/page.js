'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { 
  ArrowLeft, Printer, Truck, CreditCard, FileText, 
  Save, CheckCircle, AlertCircle, Package, Calendar
} from 'lucide-react'

export default function SaleDetailPage() {
  const router = useRouter()
  const params = useParams()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sale, setSale] = useState(null)
  const [items, setItems] = useState([])
  const [company, setCompany] = useState(null)
  
  // Düzenlenebilir Alanlar State'i
  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: '',
    payment_status: '',
    delivery_status: '',
    notes: ''
  })

  useEffect(() => {
    loadSaleData()
  }, [params.id])

  async function loadSaleData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // 1. Şirket Bilgisi
      const { data: companyData } = await supabase.from('companies').select('*').eq('id', profile.company_id).single()
      setCompany(companyData)

      // 2. Satış Detayı
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .select('*, customers(*)')
        .eq('id', params.id)
        .single()
      
      if (saleError) throw saleError
      setSale(saleData)
      setFormData({
        invoice_number: saleData.invoice_number || '',
        invoice_date: saleData.invoice_date || '',
        payment_status: saleData.payment_status || 'unpaid',
        delivery_status: saleData.delivery_status || 'pending',
        notes: saleData.notes || ''
      })

      // 3. Satış Kalemleri
      const { data: itemsData, error: itemsError } = await supabase
        .from('sale_items')
        .select('*, products(product_code, image_url)')
        .eq('sale_id', params.id)
      
      if (itemsError) throw itemsError
      setItems(itemsData || [])

    } catch (error) {
      console.error('Veri yükleme hatası:', error)
      alert('Satış verisi yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  // Durum Güncelleme ve Kaydetme
  async function handleUpdate() {
    setSaving(true)
    try {
      // İleride buraya e-fatura entegrasyonu hook'u eklenebilir
      // Örn: if (integrationActive) sendToParasut(formData)...

      const { error } = await supabase
        .from('sales')
        .update({
          invoice_number: formData.invoice_number,
          invoice_date: formData.invoice_date || null,
          payment_status: formData.payment_status,
          delivery_status: formData.delivery_status,
          notes: formData.notes
        })
        .eq('id', params.id)

      if (error) throw error
      
      // State'i güncelle
      setSale({ ...sale, ...formData })
      alert('Sipariş/Satış bilgileri güncellendi.')

    } catch (error) {
      console.error(error)
      alert('Güncelleme sırasında hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }
  const symbol = sale ? currencySymbols[sale.currency] : '₺'

  if (loading) return <div className="flex h-screen justify-center items-center">Yükleniyor...</div>
  if (!sale) return <div className="text-center py-20">Satış bulunamadı.</div>

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      
      {/* Üst Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" /> Geri
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                {sale.sale_number}
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200">SATIŞ</span>
              </h1>
              <p className="text-xs text-gray-500">{sale.customers?.name}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="btn-secondary text-sm"><Printer className="w-4 h-4 mr-2"/> Yazdır</button>
            <button onClick={handleUpdate} disabled={saving} className="btn-primary text-sm bg-blue-600 hover:bg-blue-700">
              {saving ? 'Kaydediliyor...' : <><Save className="w-4 h-4 mr-2"/> Değişiklikleri Kaydet</>}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SOL KOLON: Ürünler ve Toplamlar (2 birim genişlik) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Ürün Listesi */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Package className="w-4 h-4"/> Sipariş Kalemleri</h3>
              <span className="text-xs text-gray-500">{items.length} Kalem</span>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3">Ürün</th>
                  <th className="px-4 py-3 text-center">Miktar</th>
                  <th className="px-4 py-3 text-right">Birim Fiyat</th>
                  <th className="px-4 py-3 text-right">Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.products?.image_url ? (
                          <img src={item.products.image_url} className="w-10 h-10 object-contain rounded border bg-gray-50" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">Yok</div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{item.description}</p>
                          <p className="text-xs text-gray-500 font-mono">{item.products?.product_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{symbol}{parseFloat(item.unit_price).toLocaleString('tr-TR', {minimumFractionDigits:2})}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{symbol}{parseFloat(item.total_price).toLocaleString('tr-TR', {minimumFractionDigits:2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Finansal Özet */}
          <div className="flex justify-end">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 w-full max-w-sm">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600"><span>Ara Toplam</span><span>{symbol}{parseFloat(sale.subtotal).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                {sale.discount_amount > 0 && <div className="flex justify-between text-red-600"><span>İskonto</span><span>-{symbol}{parseFloat(sale.discount_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>}
                <div className="flex justify-between text-gray-600"><span>KDV Toplam</span><span>{symbol}{parseFloat(sale.tax_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-900">
                  <span>Genel Toplam</span>
                  <span>{symbol}{parseFloat(sale.total_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SAĞ KOLON: Yönetim Paneli (1 birim genişlik) */}
        <div className="space-y-6">
          
          {/* Fatura Bilgileri (E-Fatura Entegrasyonuna Hazır Alan) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600"/> Fatura Bilgileri</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fatura Numarası</label>
                <input 
                  type="text" 
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                  className="input-field font-mono text-sm"
                  placeholder="Örn: F20250001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fatura Tarihi</label>
                <input 
                  type="date" 
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({...formData, invoice_date: e.target.value})}
                  className="input-field text-sm"
                />
              </div>
              
              {/* Gelecekte buraya "E-Fatura Oluştur" butonu gelecek */}
              <div className="pt-2 border-t border-gray-100">
                 <p className="text-[10px] text-gray-400 italic text-center">Entegrasyon aktif değil</p>
              </div>
            </div>
          </div>

          {/* Durum Yönetimi */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-600"/> Sipariş Durumu</h3>
            <div className="space-y-4">
              
              {/* Ödeme Durumu */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Ödeme Durumu</label>
                <div className="relative">
                  <select 
                    value={formData.payment_status}
                    onChange={(e) => setFormData({...formData, payment_status: e.target.value})}
                    className={`input-field appearance-none pl-9 font-medium ${
                      formData.payment_status === 'paid' ? 'text-green-700 bg-green-50 border-green-200' :
                      formData.payment_status === 'unpaid' ? 'text-red-700 bg-red-50 border-red-200' :
                      'text-yellow-700 bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <option value="unpaid">Ödenmedi (Açık Hesap)</option>
                    <option value="partial">Kısmi Ödeme</option>
                    <option value="paid">Tamamı Ödendi</option>
                  </select>
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50"/>
                </div>
              </div>

              {/* Teslimat Durumu */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Teslimat Durumu</label>
                <div className="relative">
                  <select 
                    value={formData.delivery_status}
                    onChange={(e) => setFormData({...formData, delivery_status: e.target.value})}
                    className={`input-field appearance-none pl-9 font-medium ${
                      formData.delivery_status === 'delivered' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                      formData.delivery_status === 'shipped' ? 'text-purple-700 bg-purple-50 border-purple-200' :
                      'text-orange-700 bg-orange-50 border-orange-200'
                    }`}
                  >
                    <option value="pending">Hazırlanıyor (Beklemede)</option>
                    <option value="shipped">Kargoya Verildi / Sevk Edildi</option>
                    <option value="delivered">Müşteriye Teslim Edildi</option>
                  </select>
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50"/>
                </div>
              </div>

            </div>
          </div>

          {/* Notlar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-bold text-gray-800 mb-2 text-sm">Sipariş Notları</h3>
            <textarea 
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="input-field text-sm"
              placeholder="Özel notlar, kargo takip no vb..."
            />
          </div>

        </div>

      </div>
    </div>
  )
}
