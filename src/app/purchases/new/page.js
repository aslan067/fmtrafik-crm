'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  ArrowLeft, Save, Plus, Trash2, Search, 
  ShoppingCart, Truck, AlertCircle, Package, Loader2 
} from 'lucide-react'

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const [pageLoading, setPageLoading] = useState(true) // Sayfa yükleniyor
  const [saving, setSaving] = useState(false) // Kaydediliyor
  const [suppliers, setSuppliers] = useState([])
  
  // Ürün Arama State'leri
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Form State
  const [formData, setFormData] = useState({
    supplier_id: '',
    order_number: '',
    expected_delivery_date: '',
    currency: 'TRY',
    exchange_rate: 1.00,
    notes: ''
  })

  // Sepet
  const [items, setItems] = useState([])

  // --- SAYFA AÇILIŞI ---
  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // Tedarikçileri çek
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('name')

      setSuppliers(suppliersData || [])

      // Sipariş No Önerisi
      const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '')
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      setFormData(prev => ({ ...prev, order_number: `PO-${dateStr}-${random}` }))

    } catch (error) {
      console.error(error)
    } finally {
      setPageLoading(false)
    }
  }

  // --- AKILLI ÜRÜN ARAMA (İSİM + KOD) ---
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([])
      return
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true)
      try {
        const user = await getCurrentUser()
        const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

        // GÜNCELLEME BURADA: Hem İsimde Hem de Ürün Kodunda Ara (.or kullanımı)
        let query = supabase
          .from('products')
          .select('id, name, product_code, stock_quantity, unit, supplier_id, supplier_list_price, image_url')
          .eq('company_id', profile.company_id)
          .eq('is_active', true)
          .or(`name.ilike.%${searchTerm}%,product_code.ilike.%${searchTerm}%`) // İsim VEYA Kod eşleşirse getir
          .limit(20)

        const { data, error } = await query

        if (error) throw error
        setSearchResults(data || [])

      } catch (error) {
        console.error('Arama hatası:', error)
      } finally {
        setIsSearching(false)
      }
    }, 400)

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm])


  // Ürün Ekleme
  const addItem = (product) => {
    const existing = items.find(i => i.product_id === product.id)
    if (existing) {
      alert('Bu ürün zaten listede ekli.')
      return
    }

    setItems([...items, {
      product_id: product.id,
      product_name: product.name,
      product_code: product.product_code,
      image_url: product.image_url,
      quantity_ordered: 1,
      unit_price: product.supplier_list_price || 0,
      tax_rate: 20,
      total_price: product.supplier_list_price || 0
    }])
  }

  // Satır Güncelleme
  const updateItem = (index, field, value) => {
    const newItems = [...items]
    const item = newItems[index]
    item[field] = parseFloat(value) || 0

    if (field === 'quantity_ordered' || field === 'unit_price') {
      item.total_price = item.quantity_ordered * item.unit_price
    }
    setItems(newItems)
  }

  // Toplamlar
  const totals = items.reduce((acc, item) => {
    acc.subtotal += item.total_price
    acc.taxAmount += (item.total_price * item.tax_rate / 100)
    acc.total = acc.subtotal + acc.taxAmount
    return acc
  }, { subtotal: 0, taxAmount: 0, total: 0 })

  // Satır Silme
  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  // Kaydetme
  const handleSubmit = async () => {
    if (!formData.supplier_id) return alert('Lütfen bir tedarikçi seçin.')
    if (items.length === 0) return alert('Listeye ürün eklemelisiniz.')

    setSaving(true)
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // Header
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .insert([{
          company_id: profile.company_id,
          supplier_id: formData.supplier_id,
          order_number: formData.order_number,
          expected_delivery_date: formData.expected_delivery_date || null,
          currency: formData.currency,
          exchange_rate: formData.exchange_rate,
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          total_amount: totals.total,
          notes: formData.notes,
          status: 'ordered',
          created_by: user.id
        }])
        .select()
        .single()

      if (orderError) throw orderError

      // Items
      const orderItems = items.map(item => ({
        purchase_order_id: orderData.id,
        product_id: item.product_id,
        description: item.product_name,
        quantity_ordered: item.quantity_ordered,
        quantity_received: 0,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        total_price: item.total_price
      }))

      const { error: itemsError } = await supabase.from('purchase_order_items').insert(orderItems)
      if (itemsError) throw itemsError

      router.push('/purchases')

    } catch (error) {
      console.error(error)
      alert('Hata: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (pageLoading) return <DashboardLayout><div className="flex h-full items-center justify-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mr-2"/> Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-gray-50/50">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><ArrowLeft className="w-6 h-6"/></button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Yeni Satınalma Siparişi</h1>
              <p className="text-sm text-gray-500">Tedarikçiye iletmek üzere stok siparişi oluşturun.</p>
            </div>
          </div>
          <button 
            onClick={handleSubmit} 
            disabled={saving}
            className={`btn-primary flex items-center gap-2 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin"/> Kaydediliyor</> : <><Save className="w-4 h-4"/> Siparişi Onayla</>}
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* SOL: Sipariş Detayları (8/12) */}
          <div className="xl:col-span-8 space-y-6">
            
            {/* Kart 1: Genel Bilgiler */}
            <div className="card grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Tedarikçi Firma</label>
                <select 
                  className="input-field"
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                >
                  <option value="">Seçiniz...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Sipariş Numarası</label>
                <input 
                  type="text" 
                  className="input-field font-mono text-gray-700"
                  value={formData.order_number}
                  onChange={(e) => setFormData({...formData, order_number: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Beklenen Teslimat</label>
                <input 
                  type="date" 
                  className="input-field"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({...formData, expected_delivery_date: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Para Birimi</label>
                <select 
                  className="input-field"
                  value={formData.currency}
                  onChange={(e) => setFormData({...formData, currency: e.target.value})}
                >
                  <option value="TRY">Türk Lirası (TRY)</option>
                  <option value="USD">Amerikan Doları (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </select>
              </div>
            </div>

            {/* Kart 2: Sipariş Listesi */}
            <div className="card min-h-[400px] flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b pb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-blue-600"/> Sipariş Sepeti</h3>
                <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{items.length} Kalem</span>
              </div>
              
              {items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-12 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                  <Package className="w-12 h-12 mb-3 opacity-20"/>
                  <p className="text-sm">Henüz ürün eklenmedi.</p>
                  <p className="text-xs mt-1">Sağ taraftaki katalogdan ürün arayıp ekleyebilirsiniz.</p>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase font-semibold">
                        <th className="p-3 text-left pl-4">Ürün Detayı</th>
                        <th className="p-3 text-center w-24">Miktar</th>
                        <th className="p-3 text-right w-32">Birim Fiyat</th>
                        <th className="p-3 text-right w-32">Toplam</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item, idx) => (
                        <tr key={idx} className="group hover:bg-blue-50/30 transition-colors">
                          <td className="p-3 pl-4">
                            <div className="flex items-center gap-3">
                              {/* Resim */}
                              <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 overflow-hidden">
                                {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover"/> : item.product_name.substring(0,1)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{item.product_name}</p>
                                <p className="text-[10px] text-gray-500 font-mono">{item.product_code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <input 
                              type="number" 
                              className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              value={item.quantity_ordered}
                              onChange={(e) => updateItem(idx, 'quantity_ordered', e.target.value)}
                              min="1"
                            />
                          </td>
                          <td className="p-3">
                            <input 
                              type="number" 
                              className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-right text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              value={item.unit_price}
                              onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                              min="0"
                            />
                          </td>
                          <td className="p-3 text-right font-bold text-gray-900 tabular-nums">
                            {totals.currency}{item.total_price.toLocaleString('tr-TR', {minimumFractionDigits:2})}
                          </td>
                          <td className="p-3 text-center">
                            <button onClick={() => removeItem(idx)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"><Trash2 className="w-4 h-4"/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Alt Bilgi & Toplamlar */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col items-end">
                <div className="w-full md:w-1/2 lg:w-1/3 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600"><span>Ara Toplam</span><span>{totals.subtotal.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                  <div className="flex justify-between text-sm text-gray-600"><span>KDV (%20)</span><span>{totals.taxAmount.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                  <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                    <span>Genel Toplam</span>
                    <span className="text-blue-600">{totals.total.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Notlar</label>
              <textarea 
                className="input-field min-h-[80px]" 
                placeholder="Tedarikçiye iletilecek notlar..."
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              ></textarea>
            </div>

          </div>

          {/* SAĞ: Ürün Kataloğu (4/12) */}
          <div className="xl:col-span-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-140px)] sticky top-24">
              
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 text-sm">Ürün Kataloğu</h3>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Ürün adı veya kodu ara..." 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin"/>}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
                {searchTerm.length < 2 && searchResults.length === 0 ? (
                  <div className="text-center py-10 px-4 text-gray-400">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-20"/>
                    <p className="text-xs">Aramaya başlamak için en az 2 karakter yazın.</p>
                  </div>
                ) : searchResults.length === 0 && !isSearching ? (
                  <div className="text-center py-10 px-4 text-gray-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20"/>
                    <p className="text-xs">Eşleşen ürün bulunamadı.</p>
                  </div>
                ) : (
                  searchResults.map(product => {
                    const isAdded = items.some(i => i.product_id === product.id)
                    const isMatch = formData.supplier_id && product.supplier_id === formData.supplier_id
                    
                    return (
                      <div 
                        key={product.id} 
                        className={`p-3 rounded-lg border transition-all flex justify-between items-center group
                          ${isAdded 
                            ? 'bg-green-50 border-green-200 opacity-70' 
                            : 'bg-white border-gray-100 hover:border-blue-300 hover:shadow-md cursor-pointer'
                          }
                        `}
                        onClick={() => !isAdded && addItem(product)}
                      >
                        <div className="flex-1 min-w-0 mr-2">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`text-sm font-medium truncate ${isAdded ? 'text-green-800' : 'text-gray-900'}`}>{product.name}</p>
                            {isMatch && <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Tedarikçin</span>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="font-mono bg-gray-100 px-1 rounded">{product.product_code}</span>
                            <span>Stok: {product.stock_quantity || 0} {product.unit}</span>
                          </div>
                        </div>
                        <button 
                          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors flex-shrink-0
                            ${isAdded ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-600 group-hover:text-white'}
                          `}
                        >
                          {isAdded ? <Truck className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}
