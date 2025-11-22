'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  Save, Plus, Trash2, Search, Calculator, FileText, 
  CreditCard, Globe, Image as ImageIcon, TrendingUp, AlertCircle, 
  Check, RefreshCw, User, Copy, ChevronDown, Settings, Ruler, Lock, Unlock, AlertTriangle
} from 'lucide-react'

// --- AKILLI FİYAT GİRİŞ BİLEŞENİ (PriceInput) ---
// Bu bileşen, giriş yapılırken ve gösterilirken TR formatını (1.234,56) uygular.
function PriceInput({ value, onChange, disabled, className, placeholder }) {
  const [localValue, setLocalValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  // Dışarıdan value değiştiğinde (ör: döviz kuru değişimi) güncelle
  useEffect(() => {
    if (!isFocused) {
      if (value === '' || value === null || isNaN(value)) {
        setLocalValue('')
      } else {
        // TR Formatı: 1.234,56
        setLocalValue(new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value))
      }
    }
  }, [value, isFocused])

  const handleChange = (e) => {
    const val = e.target.value
    setLocalValue(val)
    
    // Arka plan için sayıya çevir: 1.234,56 -> 1234.56
    // Noktaları (binlik) sil, virgülü (ondalık) noktaya çevir
    const raw = val.replace(/\./g, '').replace(',', '.')
    const num = parseFloat(raw)
    onChange(isNaN(num) ? 0 : num)
  }

  const handleFocus = () => {
    setIsFocused(true)
    // Düzenleme moduna geçince binlik ayıraçlarını kaldır ki kullanıcı rahat silsin/yazsın
    if (value !== undefined && value !== null && !isNaN(value)) {
      // 1234.56 -> "1234,56" (Excel mantığı)
      setLocalValue(value.toString().replace('.', ','))
    }
  }

  return (
    <input
      type="text"
      className={className}
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={() => setIsFocused(false)}
      disabled={disabled}
      placeholder={placeholder}
    />
  )
}

export default function NewQuotePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preSelectedCustomerId = searchParams.get('customer')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // UI State
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false)
  const bankDropdownRef = useRef(null)

  // Veri Setleri
  const [customers, setCustomers] = useState([])
  const [customerContacts, setCustomerContacts] = useState([])
  const [products, setProducts] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [companyTerms, setCompanyTerms] = useState({ tr: '', en: '' })
  
  // Form State
  const [formData, setFormData] = useState({
    customer_id: preSelectedCustomerId || '',
    contact_id: '',
    title: '',
    valid_until: '',
    currency: 'TRY',
    exchange_rate: 1.00,
    template_code: 'standard_tr',
    selected_bank_ids: [],
    show_product_images: true,
    show_specifications: false,
    notes: '',
    terms: '', 
    default_tax_rate: 20,
    discount_percentage: 0
  })

  const [items, setItems] = useState([
    { 
      id: Date.now(), 
      product_id: '', 
      description: '', 
      quantity: 1, 
      list_price: 0, 
      discount_percentage: 0, 
      tax_rate: 20, 
      unit_price: 0, 
      total_price: 0, 
      cost_price: 0, 
      original_currency: 'TRY',
      is_price_editable: true 
    }
  ])

  const templates = [
    { id: 'standard_tr', name: 'Standart Türkçe', lang: 'TR', icon: FileText },
    { id: 'standard_en', name: 'Standart İngilizce', lang: 'EN', icon: Globe },
    { id: 'export', name: 'İhracat (Proforma)', lang: 'EN', icon: Globe },
  ]

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }

  // --- Effect'ler ---

  useEffect(() => {
    loadInitialData()
    const date = new Date()
    date.setDate(date.getDate() + 15)
    setFormData(prev => ({ ...prev, valid_until: date.toISOString().split('T')[0] }))

    function handleClickOutside(event) {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(event.target)) {
        setIsBankDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (formData.customer_id) loadCustomerContacts(formData.customer_id)
    else setCustomerContacts([])
  }, [formData.customer_id])

  useEffect(() => {
    if (formData.template_code === 'standard_tr') {
      setFormData(prev => ({ ...prev, terms: companyTerms.tr }))
    } else {
      setFormData(prev => ({ ...prev, terms: companyTerms.en }))
    }
  }, [formData.template_code, companyTerms])

  useEffect(() => {
    if (items.length > 0 && items[0].product_id) recalculateAllItems()
  }, [formData.currency, formData.exchange_rate])

  useEffect(() => {
    setItems(prev => prev.map(item => 
      !item.product_id ? { ...item, tax_rate: formData.default_tax_rate } : item
    ))
  }, [formData.default_tax_rate])

  // --- Veri Yükleme ---

  async function loadInitialData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      const [custRes, prodRes, bankRes, compRes] = await Promise.all([
        supabase.from('customers').select('*').eq('company_id', profile.company_id).eq('status', 'active').order('name'),
        supabase.from('products').select('*, product_groups(dealer_discount_percentage)').eq('company_id', profile.company_id).eq('is_active', true).order('name'),
        supabase.from('company_bank_accounts').select('*').eq('company_id', profile.company_id).eq('is_active', true),
        supabase.from('companies').select('default_terms_tr, default_terms_en, default_quote_terms').eq('id', profile.company_id).single()
      ])

      setCustomers(custRes.data || [])
      setProducts(prodRes.data || [])
      setBankAccounts(bankRes.data || [])

      const trTerms = compRes.data?.default_terms_tr || compRes.data?.default_quote_terms || ''
      const enTerms = compRes.data?.default_terms_en || ''
      setCompanyTerms({ tr: trTerms, en: enTerms })
      setFormData(prev => ({ ...prev, terms: trTerms }))

      if (bankRes.data?.length > 0) {
        const defaultBanks = bankRes.data.filter(b => b.currency === 'TRY').map(b => b.id)
        if(defaultBanks.length > 0) setFormData(prev => ({ ...prev, selected_bank_ids: defaultBanks }))
        else setFormData(prev => ({ ...prev, selected_bank_ids: [bankRes.data[0].id] }))
      }

    } catch (err) {
      console.error(err)
      setError('Veriler yüklenirken hata oluştu')
    }
  }

  async function loadCustomerContacts(customerId) {
    const { data } = await supabase.from('customer_contacts').select('*').eq('customer_id', customerId)
    setCustomerContacts(data || [])
    const primary = data?.find(c => c.is_primary)
    if (primary) setFormData(prev => ({ ...prev, contact_id: primary.id }))
    else setFormData(prev => ({ ...prev, contact_id: '' }))
  }

  // --- Fiyat Motoru ---

  const convertPrice = (price, fromCurrency, toCurrency, rate) => {
    if (!price) return 0
    if (fromCurrency === toCurrency) return price
    const exchangeRate = parseFloat(rate) || 1
    let result = price
    
    if (fromCurrency !== 'TRY' && toCurrency === 'TRY') result = price * exchangeRate
    else if (fromCurrency === 'TRY' && toCurrency !== 'TRY') result = price / exchangeRate
    
    // Çeviri sonrası daima 2 hane hassasiyetle dön
    return parseFloat(result.toFixed(2))
  }

  const recalculateAllItems = () => {
    const newItems = items.map(item => {
      if (!item.product_id) return item

      const convertedListPrice = convertPrice(
        item.original_list_price || 0, 
        item.original_currency || 'TRY', 
        formData.currency, 
        formData.exchange_rate
      )

      const convertedCostPrice = convertPrice(
        item.original_cost_price || 0,
        item.original_currency || 'TRY',
        formData.currency,
        formData.exchange_rate
      )

      const listPriceToUse = item.is_price_editable ? item.list_price : convertedListPrice
      const unitPrice = listPriceToUse * (1 - (item.discount_percentage || 0) / 100)
      
      return {
        ...item,
        list_price: parseFloat(listPriceToUse.toFixed(2)),
        cost_price: parseFloat(convertedCostPrice.toFixed(2)),
        unit_price: parseFloat(unitPrice.toFixed(2)),
        total_price: parseFloat((unitPrice * (item.quantity || 1)).toFixed(2))
      }
    })
    setItems(newItems)
  }

  const togglePriceLock = (index) => {
    const newItems = [...items]
    newItems[index].is_price_editable = !newItems[index].is_price_editable
    setItems(newItems)
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...items]
    const item = newItems[index]
    item[field] = value

    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        item.description = product.name
        item.original_currency = product.currency || 'TRY'
        item.original_list_price = parseFloat(product.dealer_list_price)
        item.original_cost_price = parseFloat(product.our_cost_price)
        item.tax_rate = formData.default_tax_rate
        
        const convertedList = convertPrice(item.original_list_price, item.original_currency, formData.currency, formData.exchange_rate)
        const convertedCost = convertPrice(item.original_cost_price, item.original_currency, formData.currency, formData.exchange_rate)
        
        item.list_price = convertedList
        item.cost_price = convertedCost
        item.unit_price = item.list_price
        item.discount_percentage = 0
        
        item.is_price_editable = (convertedList <= 0)
      } else {
        item.is_price_editable = true
      }
    }

    // HESAPLAMALAR (Hassasiyet ayarlı)
    if (field === 'list_price') {
      const listPrice = parseFloat(value) || 0
      const discount = item.discount_percentage || 0
      item.unit_price = parseFloat((listPrice * (1 - discount / 100)).toFixed(2))
    }

    if (field === 'discount_percentage') {
      const discount = parseFloat(value) || 0
      const listPrice = item.list_price || 0
      item.unit_price = parseFloat((listPrice * (1 - discount / 100)).toFixed(2))
    }

    if (field === 'unit_price') {
      const newListPrice = item.list_price || 0
      const newUnitPrice = parseFloat(value) || 0
      item.unit_price = newUnitPrice // Kullanıcının girdiği net değer kalmalı
      
      if (newListPrice > 0) {
        const discount = ((newListPrice - newUnitPrice) / newListPrice) * 100
        // İskontoyu da 2 hane sabitle
        item.discount_percentage = parseFloat(discount.toFixed(2))
      } else {
        item.discount_percentage = 0
      }
    }

    const quantity = parseFloat(item.quantity) || 0
    const unitPrice = parseFloat(item.unit_price) || 0
    item.total_price = parseFloat((unitPrice * quantity).toFixed(2))

    setItems(newItems)
  }

  const cloneItem = (index) => {
    const itemToClone = items[index]
    const newItem = { ...itemToClone, id: Date.now() }
    const newItems = [...items]
    newItems.splice(index + 1, 0, newItem)
    setItems(newItems)
  }

  const toggleBankSelection = (bankId) => {
    const current = formData.selected_bank_ids || []
    if (current.includes(bankId)) {
      setFormData(prev => ({ ...prev, selected_bank_ids: current.filter(id => id !== bankId) }))
    } else {
      setFormData(prev => ({ ...prev, selected_bank_ids: [...current, bankId] }))
    }
  }

  const calculateTotals = () => {
    let subtotal = 0
    let totalTax = 0
    let totalCost = 0

    items.forEach(item => {
      const lineTotal = item.total_price || 0
      subtotal += lineTotal
      totalTax += lineTotal * ((item.tax_rate || 0) / 100)
      totalCost += (item.cost_price || 0) * (item.quantity || 0)
    })
    
    const generalDiscountAmount = subtotal * (parseFloat(formData.discount_percentage) || 0) / 100
    const subtotalAfterDiscount = subtotal - generalDiscountAmount
    
    const taxMultiplier = subtotal > 0 ? subtotalAfterDiscount / subtotal : 1
    const finalTaxAmount = totalTax * taxMultiplier
    
    const total = subtotalAfterDiscount + finalTaxAmount
    const estimatedProfit = subtotalAfterDiscount - totalCost
    const profitMargin = subtotalAfterDiscount > 0 ? (estimatedProfit / subtotalAfterDiscount) * 100 : 0

    return { subtotal, generalDiscountAmount, subtotalAfterDiscount, finalTaxAmount, total, estimatedProfit, profitMargin }
  }

  const totals = calculateTotals()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!formData.customer_id) throw new Error('Lütfen bir müşteri seçin')
      if (items.length === 0 || (items.length === 1 && !items[0].product_id && !items[0].description)) throw new Error('En az bir ürün eklemelisiniz')

      const zeroPriceItems = items.filter(i => (i.unit_price <= 0 && i.total_price <= 0))
      if (zeroPriceItems.length > 0) {
        if(!confirm('Bazı ürünlerin fiyatı 0.00 olarak görünüyor. Yine de kaydetmek istiyor musunuz?')) {
          setLoading(false)
          return
        }
      }

      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      const { data: quoteNumber, error: rpcError } = await supabase
        .rpc('generate_quote_number', { p_company_id: profile.company_id })

      if (rpcError) throw rpcError

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert([{
          company_id: profile.company_id,
          customer_id: formData.customer_id,
          contact_id: formData.contact_id || null,
          quote_number: quoteNumber,
          title: formData.title || `Teklif #${quoteNumber}`,
          status: 'draft',
          template_code: formData.template_code,
          selected_bank_ids: formData.selected_bank_ids,
          show_product_images: formData.show_product_images,
          show_specifications: formData.show_specifications,
          currency: formData.currency,
          exchange_rate: parseFloat(formData.exchange_rate),
          subtotal: totals.subtotal,
          discount_percentage: formData.discount_percentage,
          discount_amount: totals.generalDiscountAmount,
          tax_amount: totals.finalTaxAmount,
          total_amount: totals.total,
          valid_until: formData.valid_until,
          notes: formData.notes,
          terms: formData.terms,
          created_by: user.id
        }])
        .select()
        .single()

      if (quoteError) throw quoteError

      const quoteItems = items.map((item, idx) => ({
        quote_id: quote.id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        list_price: item.list_price,
        discount_percentage: item.discount_percentage,
        tax_rate: item.tax_rate,
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
            
            {/* SOL KOLON (3/12) */}
            <div className="xl:col-span-3 space-y-6">
              
              <div className="card space-y-4">
                <h3 className="font-semibold text-gray-900">Müşteri Bilgileri</h3>
                <div>
                  <label className="label-text">Müşteri</label>
                  <select name="customer_id" value={formData.customer_id} onChange={(e)=>setFormData({...formData, customer_id:e.target.value})} className="input-field" required>
                    <option value="">Seçiniz...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                
                {formData.customer_id && (
                  <div>
                    <label className="label-text">İlgili Kişi</label>
                    <select name="contact_id" value={formData.contact_id} onChange={(e)=>setFormData({...formData, contact_id:e.target.value})} className="input-field">
                      <option value="">Seçiniz...</option>
                      {customerContacts.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.role ? `(${c.role})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label-text">Teklif Başlığı</label>
                  <input type="text" value={formData.title} onChange={(e)=>setFormData({...formData, title:e.target.value})} className="input-field" placeholder="Otomatik" />
                </div>
                <div>
                  <label className="label-text">Geçerlilik Tarihi</label>
                  <input type="date" value={formData.valid_until} onChange={(e)=>setFormData({...formData, valid_until:e.target.value})} className="input-field" />
                </div>
              </div>

              <div className="card space-y-4 bg-blue-50/50 border-blue-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><CreditCard className="w-4 h-4"/> Para Birimi & Kur</h3>
                <div>
                  <label className="label-text">Teklif Para Birimi</label>
                  <select value={formData.currency} onChange={(e)=>setFormData({...formData, currency:e.target.value})} className="input-field">
                    <option value="TRY">Türk Lirası (TRY)</option>
                    <option value="USD">Amerikan Doları (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                  </select>
                </div>
                <div>
                  <label className="label-text flex justify-between">
                    <span>Kur (Exchange Rate)</span>
                    <span className="text-blue-600 cursor-pointer" onClick={()=>setFormData({...formData, exchange_rate: 1})}>Sıfırla</span>
                  </label>
                  <div className="relative">
                    <input type="number" value={formData.exchange_rate} onChange={(e)=>setFormData({...formData, exchange_rate: e.target.value})} className="input-field pr-10 font-bold" step="0.0001" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2"><RefreshCw className="w-4 h-4 text-gray-400" /></div>
                  </div>
                </div>
                
                <div className="relative" ref={bankDropdownRef}>
                  <label className="label-text mb-1">Banka Hesapları</label>
                  <button 
                    type="button"
                    onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                    className="input-field w-full text-left flex justify-between items-center bg-white"
                  >
                    <span className="truncate text-sm">
                      {formData.selected_bank_ids.length > 0 
                        ? `${formData.selected_bank_ids.length} banka seçildi` 
                        : 'Banka Seçiniz'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500"/>
                  </button>
                  
                  {isBankDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {bankAccounts.map(b => (
                        <label key={b.id} className="flex items-center gap-3 p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 border-gray-50 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={formData.selected_bank_ids.includes(b.id)}
                            onChange={() => toggleBankSelection(b.id)}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{b.bank_name}</p>
                            <p className="text-xs text-gray-500">{b.currency} - {b.iban}</p>
                          </div>
                        </label>
                      ))}
                      {bankAccounts.length === 0 && <p className="p-4 text-sm text-gray-500 text-center">Kayıtlı banka hesabı yok.</p>}
                    </div>
                  )}
                </div>
              </div>

              <div className="card space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Settings className="w-4 h-4"/> Şablon & Görünüm</h3>
                <div className="grid grid-cols-1 gap-2">
                  {templates.map(t => (
                    <button type="button" key={t.id} onClick={() => setFormData({...formData, template_code: t.id})} className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${formData.template_code === t.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className={`p-2 rounded ${formData.template_code === t.id ? 'bg-blue-200' : 'bg-gray-100'}`}><t.icon className="w-4 h-4"/></div>
                      <div className="flex-1"><p className="text-sm font-medium">{t.name}</p><p className="text-xs opacity-70">{t.lang}</p></div>
                      {formData.template_code === t.id && <Check className="w-4 h-4"/>}
                    </button>
                  ))}
                </div>
                
                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition-all">
                    <input type="checkbox" checked={formData.show_product_images} onChange={(e)=>setFormData({...formData, show_product_images:e.target.checked})} className="rounded text-blue-600 w-4 h-4" />
                    <span className="text-sm text-gray-700 flex items-center gap-2 font-medium"><ImageIcon className="w-4 h-4 text-blue-500"/> Görselleri Göster</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition-all">
                    <input type="checkbox" checked={formData.show_specifications} onChange={(e)=>setFormData({...formData, show_specifications:e.target.checked})} className="rounded text-blue-600 w-4 h-4" />
                    <span className="text-sm text-gray-700 flex items-center gap-2 font-medium"><Ruler className="w-4 h-4 text-purple-500"/> Teknik Özellikleri Göster</span>
                  </label>
                </div>
              </div>

            </div>

            {/* SAĞ KOLON (9/12) */}
            <div className="xl:col-span-9 space-y-6">
              <div className="card min-h-[400px]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">Teklif Kalemleri</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-lg border border-gray-200">
                      <span className="text-xs text-gray-600 font-medium">Varsayılan KDV:</span>
                      <input 
                        type="number" 
                        value={formData.default_tax_rate}
                        onChange={(e) => setFormData({...formData, default_tax_rate: parseFloat(e.target.value) || 0})}
                        className="w-12 bg-transparent font-bold text-sm text-center outline-none border-b border-gray-300 focus:border-blue-500"
                      />
                      <span className="text-xs font-bold">%</span>
                    </div>
                    <button type="button" onClick={() => setItems([...items, { id: Date.now(), product_id: '', quantity: 1, list_price:0, discount_percentage:0, unit_price:0, total_price:0, tax_rate: formData.default_tax_rate, is_price_editable: true }])} className="btn-secondary text-sm flex items-center gap-2">
                      <Plus className="w-4 h-4"/> Satır Ekle
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left border-b border-gray-200">
                        <th className="p-3 w-[30%] text-gray-600 font-semibold">Ürün / Hizmet</th>
                        <th className="p-3 w-[10%] text-center text-gray-600 font-semibold">Miktar</th>
                        <th className="p-3 w-[12%] text-right text-gray-600 font-semibold">Liste Fiyatı</th>
                        <th className="p-3 w-[10%] text-center text-gray-600 font-semibold">İsk. %</th>
                        <th className="p-3 w-[12%] text-right text-gray-600 font-semibold">Net Birim</th>
                        <th className="p-3 w-[8%] text-center text-gray-600 font-semibold">KDV</th>
                        <th className="p-3 w-[13%] text-right text-gray-600 font-semibold">Toplam</th>
                        <th className="p-3 w-[5%]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item, index) => {
                        const isProfitable = item.unit_price > (item.cost_price || 0)
                        const isCritical = item.unit_price > 0 && item.unit_price < (item.cost_price * 1.1)
                        const isZeroPrice = item.list_price <= 0 && item.product_id

                        return (
                          <tr key={item.id} className={`group transition-colors ${isZeroPrice ? 'bg-red-50' : 'hover:bg-blue-50/50'}`}>
                            <td className="p-2 relative">
                              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r ${isProfitable ? (isCritical ? 'bg-yellow-400' : 'bg-green-500') : 'bg-red-500'}`} title="Kârlılık Durumu"></div>
                              <select value={item.product_id} onChange={(e)=>handleItemChange(index, 'product_id', e.target.value)} className="input-field mb-1 text-sm font-medium">
                                <option value="">Ürün Seçin...</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                              <input type="text" value={item.description} onChange={(e)=>handleItemChange(index, 'description', e.target.value)} className="input-field text-xs bg-transparent border-transparent focus:bg-white focus:border-blue-500 px-1 text-gray-500" placeholder="Açıklama..." />
                            </td>
                            <td className="p-2"><input type="number" value={item.quantity} onChange={(e)=>handleItemChange(index, 'quantity', e.target.value)} className="input-field text-center" min="1" /></td>
                            
                            {/* AKILLI FİYAT ALANI (PriceInput) */}
                            <td className="p-2 relative group/price">
                              <div className="relative">
                                <PriceInput 
                                  value={item.list_price} 
                                  onChange={(val)=>handleItemChange(index, 'list_price', val)} 
                                  className={`input-field text-right pr-8 ${item.is_price_editable ? 'bg-white border-blue-300 text-blue-700' : 'bg-gray-50 text-gray-500'}`} 
                                  disabled={!item.is_price_editable} 
                                />
                                <button 
                                  type="button"
                                  onClick={() => togglePriceLock(index)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                                  title={item.is_price_editable ? "Fiyatı Kilitle" : "Kilidi Aç ve Düzenle"}
                                >
                                  {item.is_price_editable ? <Unlock className="w-3 h-3"/> : <Lock className="w-3 h-3"/>}
                                </button>
                              </div>
                              {isZeroPrice && (
                                <div className="absolute -top-2 right-0 flex items-center gap-1 bg-red-100 text-red-600 text-[10px] px-1 rounded">
                                  <AlertTriangle className="w-3 h-3"/> Fiyat Giriniz
                                </div>
                              )}
                            </td>

                            <td className="p-2"><input type="number" value={item.discount_percentage} onChange={(e)=>handleItemChange(index, 'discount_percentage', e.target.value)} className="input-field text-center text-red-600 font-medium" min="0" max="100" step="0.01" /></td>
                            <td className="p-2">
                              <PriceInput 
                                value={item.unit_price} 
                                onChange={(val)=>handleItemChange(index, 'unit_price', val)} 
                                className="input-field text-right font-bold text-gray-800" 
                              />
                            </td>
                            <td className="p-2"><input type="number" value={item.tax_rate} onChange={(e)=>handleItemChange(index, 'tax_rate', e.target.value)} className="input-field text-center text-xs" /></td>
                            <td className="p-2 text-right font-bold text-gray-900">{currencySymbols[formData.currency]}{item.total_price.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                            <td className="p-2 text-center flex flex-col gap-1">
                              <button type="button" onClick={()=>cloneItem(index)} className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors" title="Kopyala"><Copy className="w-4 h-4"/></button>
                              <button type="button" onClick={()=>setItems(items.filter((_,i)=>i!==index))} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors" title="Sil"><Trash2 className="w-4 h-4"/></button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card space-y-4">
                  <h3 className="font-semibold text-gray-900">Şartlar ve Notlar</h3>
                  <div><label className="label-text">Teklif Şartları</label><textarea value={formData.terms} onChange={(e)=>setFormData({...formData, terms:e.target.value})} rows={6} className="input-field text-sm font-mono bg-gray-50" /></div>
                  <div><label className="label-text">Özel Notlar</label><textarea value={formData.notes} onChange={(e)=>setFormData({...formData, notes:e.target.value})} rows={2} className="input-field text-sm" placeholder="Müşteriye not..." /></div>
                </div>

                <div className="card bg-gray-50 border border-gray-200">
                  <div className="space-y-3">
                    <div className="flex justify-between text-gray-600"><span>Ara Toplam</span><span className="font-medium">{currencySymbols[formData.currency]}{totals.subtotal.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                    <div className="flex justify-between items-center text-gray-600"><span className="flex items-center gap-2">Genel İskonto <input type="number" value={formData.discount_percentage} onChange={(e)=>setFormData({...formData, discount_percentage:e.target.value})} className="w-16 input-field py-0 px-1 text-center text-sm" min="0" max="100" step="0.01"/> %</span><span className="text-red-600">-{currencySymbols[formData.currency]}{totals.generalDiscountAmount.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                    <div className="flex justify-between items-center text-gray-600"><span className="flex items-center gap-2">KDV Toplamı</span><span>{currencySymbols[formData.currency]}{totals.finalTaxAmount.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                    <div className="pt-4 border-t border-gray-300 flex justify-between items-center"><span className="text-lg font-bold text-gray-900">GENEL TOPLAM</span><span className="text-2xl font-bold text-blue-700">{currencySymbols[formData.currency]}{totals.total.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-lg shadow-lg shadow-blue-200 flex items-center justify-center gap-2">{loading ? 'Kaydediliyor...' : <><Save className="w-5 h-5"/> Teklifi Oluştur</>}</button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
      <style jsx>{`.label-text { @apply block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide; }`}</style>
    </DashboardLayout>
  )
}
