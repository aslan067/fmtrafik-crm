'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  Save, Plus, Trash2, Search, Calculator, FileText, 
  CreditCard, Globe, Image as ImageIcon, TrendingUp, AlertCircle, Check
} from 'lucide-react'

export default function NewQuotePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preSelectedCustomerId = searchParams.get('customer')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Veri setleri
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  
  // Form State
  const [formData, setFormData] = useState({
    customer_id: preSelectedCustomerId || '',
    title: '',
    valid_until: '',
    currency: 'TRY',
    exchange_rate: 1.00,
    template_code: 'standard_tr',
    bank_account_id: '',
    show_product_images: true,
    notes: '',
    terms: '1. Teklifimiz 15 gün geçerlidir.\n2. Teslimat süresi sipariş onayından itibaren 3 iş günüdür.\n3. Fiyatlara KDV dahil değildir.',
    tax_rate: 20,
    discount_percentage: 0
  })

  const [items, setItems] = useState([
    { id: Date.now(), product_id: '', description: '', quantity: 1, list_price: 0, discount_percentage: 0, unit_price: 0, total_price: 0, cost_price: 0 }
  ])

  // Şablon Seçenekleri
  const templates = [
    { id: 'standard_tr', name: 'Standart Türkçe', lang: 'TR', icon: FileText },
    { id: 'standard_en', name: 'Standart İngilizce', lang: 'EN', icon: Globe },
    { id: 'export', name: 'İhracat (Proforma)', lang: 'EN', icon: Globe },
  ]

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }

  useEffect(() => {
    loadInitialData()
    // Varsayılan tarih (15 gün sonrası)
    const date = new Date()
    date.setDate(date.getDate() + 15)
    setFormData(prev => ({ ...prev, valid_until: date.toISOString().split('T')[0] }))
  }, [])

  async function loadInitialData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      const [custRes, prodRes, bankRes] = await Promise.all([
        supabase.from('customers').select('*').eq('company_id', profile.company_id).eq('status', 'active').order('name'),
        supabase.from('products').select('*, product_groups(dealer_discount_percentage)').eq('company_id', profile.company_id).eq('is_active', true).order('name'),
        supabase.from('company_bank_accounts').select('*').eq('company_id', profile.company_id).eq('is_active', true)
      ])

      setCustomers(custRes.data || [])
      setProducts(prodRes.data || [])
      setBankAccounts(bankRes.data || [])

      // Varsayılan banka seçimi (Varsa TRY hesabı, yoksa ilki)
      const defaultBank = bankRes.data?.find(b => b.currency === 'TRY') || bankRes.data?.[0]
      if (defaultBank) setFormData(prev => ({ ...prev, bank_account_id: defaultBank.id }))

    } catch (err) {
      setError('Veriler yüklenirken hata oluştu')
    }
  }

  // --- Hesaplama Fonksiyonları ---

  const handleItemChange = (index, field, value) => {
    const newItems = [...items]
    const item = newItems[index]
    item[field] = value

    // Ürün seçildiyse bilgileri doldur
    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        item.description = product.name
        item.list_price = parseFloat(product.dealer_list_price) // Bayi Liste Fiyatı
        item.cost_price = parseFloat(product.our_cost_price) // Bizim maliyetimiz (Analiz için)
        // Varsayılan olarak ürün grubunun iskontosunu uygula?
        // item.discount_percentage = product.product_groups?.dealer_discount_percentage || 0
      }
    }

    // Satır Hesaplamaları
    const listPrice = parseFloat(item.list_price) || 0
    const quantity = parseFloat(item.quantity) || 0
    const discount = parseFloat(item.discount_percentage) || 0
    
    // İskontolu birim fiyat
    item.unit_price = listPrice * (1 - discount / 100)
    // Toplam
    item.total_price = item.unit_price * quantity

    setItems(newItems)
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0)
    const totalCost = items.reduce((sum, item) => sum + ((item.cost_price || 0) * (item.quantity || 0)), 0)
    
    const generalDiscountAmount = subtotal * (parseFloat(formData.discount_percentage) || 0) / 100
    const subtotalAfterDiscount = subtotal - generalDiscountAmount
    
    const taxAmount = subtotalAfterDiscount * (parseFloat(formData.tax_rate) || 0) / 100
    const total = subtotalAfterDiscount + taxAmount

    // Kar hesaplama (Sadece bilgi amaçlı)
    const estimatedProfit = subtotalAfterDiscount - totalCost
    const profitMargin = subtotalAfterDiscount > 0 ? (estimatedProfit / subtotalAfterDiscount) * 100 : 0

    return { subtotal, generalDiscountAmount, subtotalAfterDiscount, taxAmount, total, totalCost, estimatedProfit, profitMargin }
  }

  const totals = calculateTotals()

  // --- Kayıt Fonksiyonu ---

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!formData.customer_id) throw new Error('Lütfen bir müşteri seçin')
      if (items.length === 0 || !items[0].product_id) throw new Error('En az bir ürün eklemelisiniz')

      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // Teklif Numarası Oluştur (YYYY-001 formatı)
      const year = new Date().getFullYear()
      const { data: lastQuote } = await supabase
        .from('quotes')
        .select('quote_number')
        .eq('company_id', profile.company_id)
        .like('quote_number', `${year}-%`)
        .order('quote_number', { ascending: false })
        .limit(1)
        .single()

      let nextNum = 1
      if (lastQuote) nextNum = parseInt(lastQuote.quote_number.split('-')[1]) + 1
      const quoteNumber = `${year}-${String(nextNum).padStart(4, '0')}`

      // Ana Kayıt
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert([{
          company_id: profile.company_id,
          customer_id: formData.customer_id,
          quote_number: quoteNumber,
          title: formData.title || `Teklif #${quoteNumber}`,
          status: 'draft',
          template_code: formData.template_code,
          bank_account_id: formData.bank_account_id || null,
          show_product_images: formData.show_product_images,
          currency: formData.currency,
          subtotal: totals.subtotal,
          discount_percentage: formData.discount_percentage,
          discount_amount: totals.generalDiscountAmount,
          tax_rate: formData.tax_rate,
          tax_amount: totals.taxAmount,
          total_amount: totals.total,
          valid_until: formData.valid_until,
          notes: formData.notes,
          terms: formData.terms,
          created_by: user.id
        }])
        .select()
        .single()

      if (quoteError) throw quoteError

      // Kalemleri Kaydet
      const quoteItems = items.map((item, idx) => ({
        quote_id: quote.id,
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity,
        list_price: item.list_price,
        discount_percentage: item.discount_percentage,
        unit_price: item.unit_price,
        total_price: item.total_price,
        sort_order: idx
      }))

      const { error: itemsError } = await supabase.from('quote_items').insert(quoteItems)
      if (itemsError) throw itemsError

      router.push(`/quotes/${quote.id}`) 

    } catch (err) {
      console.error(err)
      setError(err.message || 'Kayıt hatası')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 min-h-screen bg-gray-50/50">
        <div className="max-w-[1600px] mx-auto">
          
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Yeni Teklif Oluştur</h1>
              <p className="text-gray-600">Müşterinize özel, profesyonel bir teklif hazırlayın.</p>
            </div>
            {/* Sağ Üst İstatistik (Sadece size görünür) */}
            <div className="hidden md:flex items-center gap-4 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
              <div className="text-right">
                <p className="text-xs text-gray-500">Tahmini Kâr</p>
                <p className={`font-bold ${totals.profitMargin < 15 ? 'text-red-600' : 'text-green-600'}`}>
                  {currencySymbols[formData.currency]}{totals.estimatedProfit.toLocaleString('tr-TR', {minimumFractionDigits:2})}
                </p>
              </div>
              <div className={`h-8 w-px bg-gray-200`}></div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Marj</p>
                <p className={`font-bold ${totals.profitMargin < 15 ? 'text-red-600' : 'text-green-600'}`}>
                  %{totals.profitMargin.toFixed(1)}
                </p>
              </div>
            </div>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2"><AlertCircle className="w-5 h-5"/>{error}</div>}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* SOL KOLON (AYARLAR VE BAŞLIKLAR) - 3/12 */}
            <div className="xl:col-span-3 space-y-6">
              
              {/* Müşteri & Genel */}
              <div className="card space-y-4">
                <h3 className="font-semibold text-gray-900">Müşteri Bilgileri</h3>
                <div>
                  <label className="label-text">Müşteri</label>
                  <select name="customer_id" value={formData.customer_id} onChange={(e)=>setFormData({...formData, customer_id:e.target.value})} className="input-field" required>
                    <option value="">Seçiniz...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-text">Teklif Başlığı</label>
                  <input type="text" value={formData.title} onChange={(e)=>setFormData({...formData, title:e.target.value})} className="input-field" placeholder="Örn: Yıllık Bakım Teklifi" />
                </div>
                <div>
                  <label className="label-text">Geçerlilik Tarihi</label>
                  <input type="date" value={formData.valid_until} onChange={(e)=>setFormData({...formData, valid_until:e.target.value})} className="input-field" />
                </div>
              </div>

              {/* Şablon ve Görünüm */}
              <div className="card space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Globe className="w-4 h-4"/> Şablon Seçimi</h3>
                <div className="grid grid-cols-1 gap-2">
                  {templates.map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setFormData({...formData, template_code: t.id})}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        formData.template_code === t.id 
                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`p-2 rounded ${formData.template_code === t.id ? 'bg-blue-200' : 'bg-gray-100'}`}>
                        <t.icon className="w-4 h-4"/>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs opacity-70">{t.lang} Dili</p>
                      </div>
                      {formData.template_code === t.id && <Check className="w-4 h-4"/>}
                    </button>
                  ))}
                </div>

                <div className="pt-4 border-t">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.show_product_images} onChange={(e)=>setFormData({...formData, show_product_images:e.target.checked})} className="rounded text-blue-600" />
                    <span className="text-sm text-gray-700 flex items-center gap-1"><ImageIcon className="w-4 h-4"/> Ürün Görsellerini Göster</span>
                  </label>
                </div>
              </div>

              {/* Banka Seçimi */}
              <div className="card space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><CreditCard className="w-4 h-4"/> Ödeme Bilgileri</h3>
                <select value={formData.bank_account_id} onChange={(e)=>setFormData({...formData, bank_account_id:e.target.value})} className="input-field">
                  <option value="">Banka Hesabı Seçin</option>
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>{b.bank_name} - {b.currency}</option>
                  ))}
                </select>
                <select value={formData.currency} onChange={(e)=>setFormData({...formData, currency:e.target.value})} className="input-field">
                  <option value="TRY">Türk Lirası (TRY)</option>
                  <option value="USD">Amerikan Doları (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </select>
              </div>

            </div>

            {/* SAĞ KOLON (ÜRÜNLER VE HESAPLAMA) - 9/12 */}
            <div className="xl:col-span-9 space-y-6">
              
              {/* Ürün Listesi */}
              <div className="card min-h-[400px]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">Teklif Kalemleri</h3>
                  <button type="button" onClick={() => setItems([...items, { id: Date.now(), product_id: '', quantity: 1, list_price:0, discount_percentage:0, unit_price:0, total_price:0 }])} className="btn-secondary text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4"/> Satır Ekle
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left border-b border-gray-200">
                        <th className="p-3 font-medium text-gray-600 w-[30%]">Ürün / Hizmet</th>
                        <th className="p-3 font-medium text-gray-600 w-[10%] text-center">Miktar</th>
                        <th className="p-3 font-medium text-gray-600 w-[15%] text-right">Liste Fiyatı</th>
                        <th className="p-3 font-medium text-gray-600 w-[10%] text-center">İsk. %</th>
                        <th className="p-3 font-medium text-gray-600 w-[15%] text-right">Net Birim</th>
                        <th className="p-3 font-medium text-gray-600 w-[15%] text-right">Toplam</th>
                        <th className="p-3 w-[5%]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item, index) => (
                        <tr key={item.id} className="group hover:bg-blue-50/50 transition-colors">
                          <td className="p-2">
                            <select 
                              value={item.product_id} 
                              onChange={(e)=>handleItemChange(index, 'product_id', e.target.value)} 
                              className="input-field mb-1 text-sm"
                            >
                              <option value="">Ürün Seçin...</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <input 
                              type="text" 
                              value={item.description} 
                              onChange={(e)=>handleItemChange(index, 'description', e.target.value)}
                              className="input-field text-xs bg-transparent border-transparent focus:bg-white focus:border-blue-500 px-1" 
                              placeholder="Açıklama ekle..."
                            />
                          </td>
                          <td className="p-2">
                            <input type="number" value={item.quantity} onChange={(e)=>handleItemChange(index, 'quantity', e.target.value)} className="input-field text-center" min="1" />
                          </td>
                          <td className="p-2">
                            <input type="number" value={item.list_price} onChange={(e)=>handleItemChange(index, 'list_price', e.target.value)} className="input-field text-right" step="0.01" />
                          </td>
                          <td className="p-2">
                            <input type="number" value={item.discount_percentage} onChange={(e)=>handleItemChange(index, 'discount_percentage', e.target.value)} className="input-field text-center text-red-600" min="0" max="100" />
                          </td>
                          <td className="p-2 text-right font-medium">
                            {currencySymbols[formData.currency]}{item.unit_price.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}
                          </td>
                          <td className="p-2 text-right font-bold text-gray-900">
                            {currencySymbols[formData.currency]}{item.total_price.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}
                          </td>
                          <td className="p-2 text-center">
                            <button type="button" onClick={()=>setItems(items.filter((_,i)=>i!==index))} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Alt Toplamlar ve Notlar */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Sol: Şartlar ve Notlar */}
                <div className="card space-y-4">
                  <h3 className="font-semibold text-gray-900">Şartlar ve Notlar</h3>
                  <div>
                    <label className="label-text">Teklif Şartları</label>
                    <textarea value={formData.terms} onChange={(e)=>setFormData({...formData, terms:e.target.value})} rows={4} className="input-field text-sm" />
                  </div>
                  <div>
                    <label className="label-text">Özel Notlar</label>
                    <textarea value={formData.notes} onChange={(e)=>setFormData({...formData, notes:e.target.value})} rows={2} className="input-field text-sm" placeholder="Müşteriye özel not..." />
                  </div>
                </div>

                {/* Sağ: Genel Toplam Hesaplaması */}
                <div className="card bg-gray-50 border border-gray-200">
                  <div className="space-y-3">
                    <div className="flex justify-between text-gray-600">
                      <span>Ara Toplam</span>
                      <span className="font-medium">{currencySymbols[formData.currency]}{totals.subtotal.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-gray-600">
                      <span className="flex items-center gap-2">Genel İskonto 
                        <input 
                          type="number" 
                          value={formData.discount_percentage} 
                          onChange={(e)=>setFormData({...formData, discount_percentage:e.target.value})} 
                          className="w-16 input-field py-0 px-1 text-center text-sm" 
                          min="0" max="100"
                        /> %
                      </span>
                      <span className="text-red-600">-{currencySymbols[formData.currency]}{totals.generalDiscountAmount.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
                    </div>

                    <div className="flex justify-between items-center text-gray-600">
                      <span className="flex items-center gap-2">KDV 
                        <input 
                          type="number" 
                          value={formData.tax_rate} 
                          onChange={(e)=>setFormData({...formData, tax_rate:e.target.value})} 
                          className="w-16 input-field py-0 px-1 text-center text-sm" 
                        /> %
                      </span>
                      <span>{currencySymbols[formData.currency]}{totals.taxAmount.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
                    </div>

                    <div className="pt-4 border-t border-gray-300 flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">GENEL TOPLAM</span>
                      <span className="text-2xl font-bold text-blue-700">
                        {currencySymbols[formData.currency]}{totals.total.toLocaleString('tr-TR', {minimumFractionDigits:2})}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-lg shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
                      {loading ? 'Kaydediliyor...' : <><Save className="w-5 h-5"/> Teklifi Oluştur</>}
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </form>
        </div>
      </div>
      <style jsx>{`
        .label-text { @apply block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide; }
      `}</style>
    </DashboardLayout>
  )
}
