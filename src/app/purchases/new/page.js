'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
// DÜZELTME: 'Package' ikonu buraya eklendi
import { 
  ArrowLeft, Save, Plus, Trash2, Search, 
  ShoppingCart, Truck, AlertCircle, Package 
} from 'lucide-react'

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  
  // Form State
  const [formData, setFormData] = useState({
    supplier_id: '',
    order_number: '',
    expected_delivery_date: '',
    currency: 'TRY',
    exchange_rate: 1.00,
    notes: ''
  })

  // Sepet (Sipariş Kalemleri)
  const [items, setItems] = useState([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // 1. Tedarikçileri Çek
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('name')

      setSuppliers(suppliersData || [])

      // 2. Ürünleri Çek
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('name')

      setProducts(productsData || [])

      // 3. Sipariş Numarası Önerisi
      const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '')
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      setFormData(prev => ({ ...prev, order_number: `PO-${dateStr}-${random}` }))

    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Ürün Ekleme Fonksiyonu
  const addItem = (product) => {
    const existing = items.find(i => i.product_id === product.id)
    if (existing) {
      alert('Bu ürün zaten listede var. Miktarını güncelleyebilirsiniz.')
      return
    }

    setItems([...items, {
      product_id: product.id,
      product_name: product.name,
      product_code: product.product_code,
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

  // Satır Silme
  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  // Toplam Hesaplama
  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0)
    const taxAmount = items.reduce((sum, item) => sum + (item.total_price * item.tax_rate / 100), 0)
    const total = subtotal + taxAmount
    return { subtotal, taxAmount, total }
  }

  const totals = calculateTotals()

  // Kaydetme
  const handleSubmit = async () => {
    if (!formData.supplier_id) return alert('Lütfen bir tedarikçi seçin.')
    if (items.length === 0) return alert('En az bir ürün eklemelisiniz.')

    setSaving(true)
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // 1. Sipariş Başlığı
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

      // 2. Sipariş Kalemleri
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

      alert('Sipariş başarıyla oluşturuldu!')
      router.push('/purchases')

    } catch (error) {
      console.error(error)
      alert('Kayıt hatası: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.product_code?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <DashboardLayout><div className="flex h-full items-center justify-center">Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto">
        
        {/* Başlık */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><ArrowLeft className="w-6 h-6"/></button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Yeni Satınalma Siparişi</h1>
              <p className="text-sm text-gray-500">Tedarikçiye verilecek siparişi oluşturun.</p>
            </div>
          </div>
          <button 
            onClick={handleSubmit} 
            disabled={saving}
            className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            {saving ? 'Kaydediliyor...' : <><Save className="w-5 h-5"/> Siparişi Oluştur</>}
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* SOL: Form ve Seçili Ürünler */}
          <div className="xl:col-span-8 space-y-6">
            
            <div className="card grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-text">Tedarikçi</label>
                <select 
                  className="input-field"
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                >
                  <option value="">Seçiniz...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label-text">Sipariş No</label>
                <input 
                  type="text" 
                  className="input-field font-mono"
                  value={formData.order_number}
                  onChange={(e) => setFormData({...formData, order_number: e.target.value})}
                />
              </div>
              <div>
                <label className="label-text">Beklenen Teslimat</label>
                <input 
                  type="date" 
                  className="input-field"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({...formData, expected_delivery_date: e.target.value})}
                />
              </div>
              <div>
                <label className="label-text">Para Birimi</label>
                <select 
                  className="input-field"
                  value={formData.currency}
                  onChange={(e) => setFormData({...formData, currency: e.target.value})}
                >
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div className="card min-h-[400px]">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><ShoppingCart className="w-5 h-5"/> Sipariş Kalemleri</h3>
              
              {items.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50"/>
                  <p>Henüz ürün eklenmedi. Sağ taraftan ürün seçin.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
                        <th className="p-2 text-left">Ürün</th>
                        <th className="p-2 text-center w-24">Miktar</th>
                        <th className="p-2 text-right w-32">Birim Fiyat</th>
                        <th className="p-2 text-right w-32">Toplam</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2">
                            <p className="font-medium text-gray-900">{item.product_name}</p>
                            <p className="text-xs text-gray-500">{item.product_code}</p>
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" 
                              className="input-field py-1 px-2 text-center"
                              value={item.quantity_ordered}
                              onChange={(e) => updateItem(idx, 'quantity_ordered', e.target.value)}
                              min="1"
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" 
                              className="input-field py-1 px-2 text-right"
                              value={item.unit_price}
                              onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                              min="0"
                            />
                          </td>
                          <td className="p-2 text-right font-bold text-gray-900">
                            {totals.currency}{item.total_price.toLocaleString('tr-TR', {minimumFractionDigits:2})}
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {items.length > 0 && (
                <div className="flex justify-end mt-6 border-t pt-4">
                  <div className="w-64 space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600"><span>Ara Toplam</span><span>{totals.subtotal.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                    <div className="flex justify-between text-gray-600"><span>KDV Toplam</span><span>{totals.taxAmount.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                    <div className="flex justify-between text-lg font-bold text-gray-900 border-t pt-2"><span>Genel Toplam</span><span>{totals.total.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <label className="label-text">Sipariş Notları</label>
              <textarea 
                className="input-field" 
                rows={3} 
                placeholder="Tedarikçiye iletilecek notlar..."
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              ></textarea>
            </div>

          </div>

          {/* SAĞ: Ürün Seçimi */}
          <div className="xl:col-span-4">
            <div className="card h-full flex flex-col max-h-[calc(100vh-100px)] sticky top-6">
              <div className="mb-4">
                <h3 className="font-bold text-gray-800 mb-2">Ürün Kataloğu</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Ürün Ara..." 
                    className="input-field pl-9 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredProducts.map(product => {
                  const isAdded = items.some(i => i.product_id === product.id)
                  const isSupplierMatch = formData.supplier_id && product.supplier_id === formData.supplier_id
                  
                  return (
                    <div key={product.id} className={`p-3 rounded-lg border flex justify-between items-center group transition-all ${isAdded ? 'bg-green-50 border-green-200 opacity-60' : 'bg-white border-gray-100 hover:border-blue-300 hover:shadow-sm'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-gray-900 line-clamp-1">{product.name}</p>
                          {isSupplierMatch && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold">Önerilen</span>}
                        </div>
                        <p className="text-xs text-gray-500 font-mono">{product.product_code}</p>
                        <p className="text-xs text-gray-400 mt-1">Stok: {product.stock_quantity || 0} {product.unit}</p>
                      </div>
                      <button 
                        onClick={() => addItem(product)} 
                        disabled={isAdded}
                        className={`p-2 rounded-full ${isAdded ? 'text-green-600 cursor-default' : 'bg-gray-100 text-gray-600 hover:bg-blue-600 hover:text-white'}`}
                      >
                        {isAdded ? <Truck className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
                      </button>
                    </div>
                  )
                })}
                {filteredProducts.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Ürün bulunamadı.</p>}
              </div>
            </div>
          </div>

        </div>
      </div>
      <style jsx>{`.label-text { @apply block text-xs font-medium text-gray-500 mb-1; }`}</style>
    </DashboardLayout>
  )
}
