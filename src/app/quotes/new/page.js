'use client'

import DashboardLayout from '@/components/DashboardLayout'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { ArrowLeft, Save, Plus, Trash2, Search } from 'lucide-react'

export default function NewQuotePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [profile, setProfile] = useState(null)

  const [formData, setFormData] = useState({
    customer_id: '',
    title: '',
    valid_until: '',
    notes: '',
    terms: '',
    tax_rate: 20,
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
      unit_price: 0,
      total_price: 0
    }
  ])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const user = await getCurrentUser()
      
      // User profile ve company bilgilerini al
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*, companies(*)')
        .eq('id', user.id)
        .single()
      
      setProfile(profileData)

      // Müşterileri yükle
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profileData.company_id)
        .eq('status', 'active')
        .order('name')
      
      setCustomers(customersData || [])

      // Ürünleri yükle
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', profileData.company_id)
        .eq('is_active', true)
        .order('name')
      
      setProducts(productsData || [])

      // Varsayılan geçerlilik tarihi (30 gün sonra)
      const validUntil = new Date()
      validUntil.setDate(validUntil.getDate() + 30)
      setFormData(prev => ({
        ...prev,
        valid_until: validUntil.toISOString().split('T')[0]
      }))
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Veriler yüklenirken hata oluştu')
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value

    // Fiyat hesaplamaları
    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index].description = product.name
        newItems[index].list_price = parseFloat(product.list_price)
      }
    }

    // Unit price hesapla (iskontolu fiyat)
    const listPrice = parseFloat(newItems[index].list_price) || 0
    const discountPerc = parseFloat(newItems[index].discount_percentage) || 0
    newItems[index].unit_price = listPrice * (1 - discountPerc / 100)

    // Total price hesapla
    const quantity = parseFloat(newItems[index].quantity) || 0
    newItems[index].total_price = newItems[index].unit_price * quantity

    setItems(newItems)
  }

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now(),
        product_id: '',
        description: '',
        quantity: 1,
        list_price: 0,
        discount_percentage: 0,
        unit_price: 0,
        total_price: 0
      }
    ])
  }

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0)
    const discountAmount = subtotal * (parseFloat(formData.discount_percentage) || 0) / 100
    const subtotalAfterDiscount = subtotal - discountAmount
    const taxAmount = subtotalAfterDiscount * (parseFloat(formData.tax_rate) || 0) / 100
    const total = subtotalAfterDiscount + taxAmount

    return {
      subtotal,
      discountAmount,
      subtotalAfterDiscount,
      taxAmount,
      total
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!profile?.company_id) {
        throw new Error('Şirket bilgisi bulunamadı')
      }

      if (!formData.customer_id) {
        throw new Error('Lütfen bir müşteri seçin')
      }

      if (items.length === 0 || items.every(item => !item.description)) {
        throw new Error('Lütfen en az bir kalem ekleyin')
      }

      const totals = calculateTotals()
      const user = await getCurrentUser()

      // Teklif numarası oluştur
      const year = new Date().getFullYear()
      const { data: lastQuote } = await supabase
        .from('quotes')
        .select('quote_number')
        .eq('company_id', profile.company_id)
        .like('quote_number', `${year}-%`)
        .order('quote_number', { ascending: false })
        .limit(1)
        .single()

      let nextNumber = 1
      if (lastQuote) {
        const lastNumber = parseInt(lastQuote.quote_number.split('-')[1])
        nextNumber = lastNumber + 1
      }
      const quoteNumber = `${year}-${String(nextNumber).padStart(3, '0')}`

      // Teklifi kaydet
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert([{
          company_id: profile.company_id,
          customer_id: formData.customer_id,
          quote_number: quoteNumber,
          title: formData.title,
          status: 'draft',
          subtotal: totals.subtotal,
          discount_percentage: parseFloat(formData.discount_percentage) || 0,
          discount_amount: totals.discountAmount,
          tax_rate: parseFloat(formData.tax_rate) || 20,
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

      // Teklif kalemlerini kaydet
      const quoteItems = items
        .filter(item => item.description)
        .map((item, index) => ({
          quote_id: quote.id,
          product_id: item.product_id || null,
          description: item.description,
          quantity: parseFloat(item.quantity) || 1,
          list_price: parseFloat(item.list_price) || 0,
          discount_percentage: parseFloat(item.discount_percentage) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          total_price: parseFloat(item.total_price) || 0,
          sort_order: index
        }))

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(quoteItems)

      if (itemsError) throw itemsError

      // Başarılı
      router.push('/?page=quotes')
    } catch (err) {
      console.error('Error creating quote:', err)
      setError(err.message || 'Teklif oluşturulurken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateTotals()

return (
  <DashboardLayout>
    <div className="p-6">
      <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/?page=quotes')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Geri
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Yeni Teklif Oluştur</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Temel Bilgiler */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Teklif Bilgileri</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Müşteri <span className="text-red-500">*</span>
                </label>
                <select
                  name="customer_id"
                  value={formData.customer_id}
                  onChange={handleChange}
                  required
                  className="input-field"
                >
                  <option value="">Müşteri seçin...</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teklif Başlığı
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Trafik ekipmanları tedariki"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Geçerlilik Tarihi
                </label>
                <input
                  type="date"
                  name="valid_until"
                  value={formData.valid_until}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  KDV Oranı (%)
                </label>
                <input
                  type="number"
                  name="tax_rate"
                  value={formData.tax_rate}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  step="0.01"
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Kalemler */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Teklif Kalemleri</h2>
              <button
                type="button"
                onClick={addItem}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                Kalem Ekle
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Ürün
                      </label>
                      <select
                        value={item.product_id}
                        onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                        className="input-field text-sm"
                      >
                        <option value="">Manuel giriş...</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Açıklama <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="input-field text-sm"
                        placeholder="Ürün açıklaması"
                        required
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Adet
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        min="0"
                        step="0.01"
                        className="input-field text-sm"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Liste Fiyatı
                      </label>
                      <input
                        type="number"
                        value={item.list_price}
                        onChange={(e) => handleItemChange(index, 'list_price', e.target.value)}
                        min="0"
                        step="0.01"
                        className="input-field text-sm"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        İsk. %
                      </label>
                      <input
                        type="number"
                        value={item.discount_percentage}
                        onChange={(e) => handleItemChange(index, 'discount_percentage', e.target.value)}
                        min="0"
                        max="100"
                        step="0.01"
                        className="input-field text-sm"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Toplam
                      </label>
                      <div className="input-field text-sm bg-gray-100 font-semibold">
                        ₺{item.total_price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Özet */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Teklif Özeti</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Ara Toplam:</span>
                <span className="font-medium">
                  ₺{totals.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Genel İskonto:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    name="discount_percentage"
                    value={formData.discount_percentage}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-20 input-field text-sm"
                  />
                  <span className="text-gray-600">%</span>
                  <span className="font-medium text-red-600 w-32 text-right">
                    -₺{totals.discountAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex justify-between text-sm border-t pt-3">
                <span className="text-gray-600">İndirimli Toplam:</span>
                <span className="font-medium">
                  ₺{totals.subtotalAfterDiscount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">KDV (%{formData.tax_rate}):</span>
                <span className="font-medium">
                  ₺{totals.taxAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between text-lg font-bold border-t-2 pt-3">
                <span>GENEL TOPLAM:</span>
                <span className="text-blue-600">
                  ₺{totals.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notlar
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className="input-field"
                  placeholder="Teklif hakkında notlar..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Şartlar ve Koşullar
                </label>
                <textarea
                  name="terms"
                  value={formData.terms}
                  onChange={handleChange}
                  rows={3}
                  className="input-field"
                  placeholder="Ödeme şartları, teslimat koşulları vb..."
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push('/?page=quotes')}
              className="btn-secondary"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Teklifi Kaydet</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    </div>
  </DashboardLayout>
  )
}
