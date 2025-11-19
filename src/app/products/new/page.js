'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, X, Calculator, TrendingUp, AlertCircle, Upload, ImagePlus } from 'lucide-react'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [productGroups, setProductGroups] = useState([])
  
  const [formData, setFormData] = useState({
    product_code: '',
    name: '',
    description: '',
    category: '',
    unit: 'Adet',
    currency: 'TRY',
    supplier_id: '',
    product_group_id: '',
    supplier_list_price: '',
    supplier_discount_percentage: '',
    price_multiplier: '1.00',
    dealer_list_price: '',
    specifications: '',
    image_url: '',
    is_published: false,
    is_active: true
  })

  // Para birimi sembolleri
  const currencySymbols = {
    TRY: '₺',
    USD: '$',
    EUR: '€',
    GBP: '£'
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    calculatePrices()
  }, [
    formData.supplier_id,
    formData.supplier_list_price,
    formData.supplier_discount_percentage,
    formData.product_group_id,
    formData.price_multiplier
  ])

  async function loadData() {
    try {
      const user = await getCurrentUser()
      
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*, companies(*)')
        .eq('id', user.id)
        .single()

      // Tedarikçileri yükle
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', profileData.company_id)
        .eq('is_active', true)
        .order('name')
      
      setSuppliers(suppliersData || [])

      // Ürün gruplarını yükle
      const { data: groupsData } = await supabase
        .from('product_groups')
        .select('*')
        .eq('company_id', profileData.company_id)
        .eq('is_active', true)
        .order('sort_order')
      
      setProductGroups(groupsData || [])
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Veriler yüklenirken hata oluştu')
    }
  }

  function calculatePrices() {
    const supplier = suppliers.find(s => s.id === formData.supplier_id)
    const group = productGroups.find(g => g.id === formData.product_group_id)
    
    if (!supplier || !formData.supplier_list_price) return

    let ourCost = 0
    let dealerList = 0

    if (supplier.discount_type === 'percentage' && formData.supplier_discount_percentage) {
      ourCost = parseFloat(formData.supplier_list_price) * 
                (1 - parseFloat(formData.supplier_discount_percentage) / 100)
    } else if (supplier.discount_type === 'net_price') {
      ourCost = parseFloat(formData.supplier_list_price)
      dealerList = ourCost * parseFloat(formData.price_multiplier)
    }

    if (supplier.discount_type === 'percentage') {
      dealerList = ourCost * 1.25
    }

    setFormData(prev => ({
      ...prev,
      dealer_list_price: dealerList.toFixed(2)
    }))
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
  }

  const handleSupplierChange = (e) => {
    const supplierId = e.target.value
    const supplier = suppliers.find(s => s.id === supplierId)
    
    setFormData({
      ...formData,
      supplier_id: supplierId,
      supplier_discount_percentage: supplier?.discount_value || '',
      price_multiplier: supplier?.price_multiplier || '1.00'
    })
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Dosya boyutu kontrolü (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Görsel boyutu 5MB\'dan küçük olmalıdır')
        return
      }

      // Dosya tipi kontrolü
      if (!file.type.startsWith('image/')) {
        setError('Sadece görsel dosyaları yüklenebilir')
        return
      }

      // Preview oluştur
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
        setFormData(prev => ({
          ...prev,
          image_url: reader.result
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const user = await getCurrentUser()
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) {
        throw new Error('Şirket bilgisi bulunamadı')
      }

      const supplier = suppliers.find(s => s.id === formData.supplier_id)
      const group = productGroups.find(g => g.id === formData.product_group_id)

      // Fiyat hesaplamaları
      let ourCost = 0
      let dealerList = parseFloat(formData.dealer_list_price)
      let dealerDiscount = group?.dealer_discount_percentage || 0
      let dealerNet = dealerList * (1 - dealerDiscount / 100)
      let profitMargin = 0

      if (supplier?.discount_type === 'percentage') {
        ourCost = parseFloat(formData.supplier_list_price) * 
                  (1 - parseFloat(formData.supplier_discount_percentage || 0) / 100)
      } else if (supplier?.discount_type === 'net_price') {
        ourCost = parseFloat(formData.supplier_list_price)
      }

      if (ourCost > 0 && dealerNet > 0) {
        profitMargin = ((dealerNet - ourCost) / dealerNet) * 100
      }

      // Specifications JSON'a çevir
      let specs = {}
      if (formData.specifications) {
        try {
          specs = JSON.parse(formData.specifications)
        } catch {
          specs = { description: formData.specifications }
        }
      }

      const insertData = {
        company_id: profile.company_id,
        supplier_id: formData.supplier_id || null,
        product_group_id: formData.product_group_id || null,
        product_code: formData.product_code,
        name: formData.name,
        description: formData.description || null,
        category: formData.category || null,
        unit: formData.unit,
        currency: formData.currency,
        supplier_list_price: parseFloat(formData.supplier_list_price) || null,
        supplier_discount_percentage: parseFloat(formData.supplier_discount_percentage) || null,
        our_cost_price: ourCost || null,
        dealer_list_price: dealerList || null,
        dealer_discount_percentage: dealerDiscount,
        dealer_net_price: dealerNet || null,
        profit_margin_percentage: profitMargin || null,
        list_price: dealerList,
        specifications: specs,
        image_url: formData.image_url || null,
        is_published: formData.is_published,
        is_active: formData.is_active
      }

      const { data, error: insertError } = await supabase
        .from('products')
        .insert([insertData])
        .select()
        .single()

      if (insertError) throw insertError

      router.push('/products')
      router.refresh()
    } catch (err) {
      console.error('Error creating product:', err)
      setError(err.message || 'Ürün eklenirken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  // Hesaplama özeti
  const supplier = suppliers.find(s => s.id === formData.supplier_id)
  const group = productGroups.find(g => g.id === formData.product_group_id)
  
  let ourCost = 0
  let dealerList = parseFloat(formData.dealer_list_price) || 0
  let dealerDiscount = group?.dealer_discount_percentage || 0
  let dealerNet = dealerList * (1 - dealerDiscount / 100)
  let profitMargin = 0

  if (supplier?.discount_type === 'percentage' && formData.supplier_discount_percentage) {
    ourCost = parseFloat(formData.supplier_list_price || 0) * 
              (1 - parseFloat(formData.supplier_discount_percentage) / 100)
  } else if (supplier?.discount_type === 'net_price') {
    ourCost = parseFloat(formData.supplier_list_price || 0)
  }

  if (ourCost > 0 && dealerNet > 0) {
    profitMargin = ((dealerNet - ourCost) / dealerNet) * 100
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Yeni Ürün Ekle</h1>
            <p className="text-gray-600 mt-2">Ürün bilgilerini, görseli ve fiyatlandırma detaylarını girin</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sol Kolon */}
              <div className="lg:col-span-2 space-y-6">
                {/* Görsel Upload */}
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Ürün Görseli</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                          {imagePreview ? (
                            <img 
                              src={imagePreview} 
                              alt="Preview" 
                              className="w-full h-48 object-cover rounded-lg mb-3"
                            />
                          ) : (
                            <div className="flex flex-col items-center">
                              <Upload className="w-12 h-12 text-gray-400 mb-3" />
                              <p className="text-sm text-gray-600 mb-1">Görsel Yükle</p>
                              <p className="text-xs text-gray-500">PNG, JPG, WEBP (max 5MB)</p>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center justify-center bg-gray-50 rounded-lg p-4">
                      <div className="text-center">
                        <ImagePlus className="w-16 h-16 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Görsel yüklendikten sonra</p>
                        <p className="text-sm text-gray-600">bayi kataloğunda görünecek</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Temel Bilgiler */}
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Temel Bilgiler</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ürün Kodu <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="product_code"
                        value={formData.product_code}
                        onChange={handleChange}
                        required
                        className="input-field"
                        placeholder="TR-001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kategori
                      </label>
                      <input
                        type="text"
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="Levhalar, Bariyerler, vb."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ürün Adı <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="input-field"
                        placeholder="Trafik Levhası A1"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Açıklama
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={3}
                        className="input-field"
                        placeholder="Ürün açıklaması..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Birim
                      </label>
                      <select
                        name="unit"
                        value={formData.unit}
                        onChange={handleChange}
                        className="input-field"
                      >
                        <option>Adet</option>
                        <option>Metre</option>
                        <option>Metrekare</option>
                        <option>Kilogram</option>
                        <option>Litre</option>
                        <option>Kova</option>
                        <option>Rulo</option>
                        <option>Set</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Para Birimi <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="currency"
                        value={formData.currency}
                        onChange={handleChange}
                        className="input-field"
                      >
                        <option value="TRY">₺ Türk Lirası (TRY)</option>
                        <option value="USD">$ ABD Doları (USD)</option>
                        <option value="EUR">€ Euro (EUR)</option>
                        <option value="GBP">£ İngiliz Sterlini (GBP)</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Teknik Özellikler (JSON)
                      </label>
                      <textarea
                        name="specifications"
                        value={formData.specifications}
                        onChange={handleChange}
                        rows={2}
                        className="input-field font-mono text-sm"
                        placeholder='{"renk": "Sarı", "malzeme": "Plastik", "boyut": "60x60cm"}'
                      />
                    </div>
                  </div>
                </div>

                {/* Tedarikçi ve Grup */}
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Tedarikçi ve Grup</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tedarikçi <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="supplier_id"
                        value={formData.supplier_id}
                        onChange={handleSupplierChange}
                        required
                        className="input-field"
                      >
                        <option value="">Seçiniz...</option>
                        {suppliers.map(supplier => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name} ({supplier.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ürün Grubu <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="product_group_id"
                        value={formData.product_group_id}
                        onChange={handleChange}
                        required
                        className="input-field"
                      >
                        <option value="">Seçiniz...</option>
                        {productGroups.map(group => (
                          <option key={group.id} value={group.id}>
                            {group.name} (%{group.dealer_discount_percentage} iskonto)
                          </option>
                        ))}
                      </select>
                    </div>

                    {supplier && (
                      <div className="md:col-span-2 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <strong>{supplier.name}</strong> - 
                          {supplier.discount_type === 'percentage' 
                            ? ` %${supplier.discount_value} iskonto` 
                            : ` Net fiyat (x${supplier.price_multiplier} çarpan)`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fiyatlandırma */}
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Fiyatlandırma</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tedarikçi Liste Fiyatı <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                          {currencySymbols[formData.currency]}
                        </span>
                        <input
                          type="number"
                          name="supplier_list_price"
                          value={formData.supplier_list_price}
                          onChange={handleChange}
                          required
                          min="0"
                          step="0.01"
                          className="input-field pl-8"
                          placeholder="0.00"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {supplier?.discount_type === 'net_price' ? 'Net alış fiyatı' : 'Tedarikçi liste fiyatı'}
                      </p>
                    </div>

                    {supplier?.discount_type === 'percentage' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tedarikçi İskontosu
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            name="supplier_discount_percentage"
                            value={formData.supplier_discount_percentage}
                            onChange={handleChange}
                            min="0"
                            max="100"
                            step="0.01"
                            className="input-field pr-8"
                            placeholder="0.00"
                          />
                          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                        </div>
                      </div>
                    )}

                    {supplier?.discount_type === 'net_price' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Fiyat Çarpanı
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">x</span>
                          <input
                            type="number"
                            name="price_multiplier"
                            value={formData.price_multiplier}
                            onChange={handleChange}
                            min="1"
                            step="0.01"
                            className="input-field pl-8"
                          />
                        </div>
                      </div>
                    )}

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bayi Liste Fiyatı <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                          {currencySymbols[formData.currency]}
                        </span>
                        <input
                          type="number"
                          name="dealer_list_price"
                          value={formData.dealer_list_price}
                          onChange={handleChange}
                          required
                          min="0"
                          step="0.01"
                          className="input-field pl-8 text-lg font-semibold"
                          placeholder="0.00"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Bayilere gösterilecek liste fiyatı</p>
                    </div>
                  </div>
                </div>

                {/* Yayın Ayarları */}
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Yayın Ayarları</h2>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_active}
                        onChange={handleChange}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-900">Ürün aktif</span>
                    </label>

                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        name="is_published"
                        checked={formData.is_published}
                        onChange={handleChange}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Bayi kataloğunda yayınla</span>
                        <p className="text-xs text-gray-500 mt-1">
                          ✅ Bu ürün bayi.fmtrafik.com'da görünecek
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Sağ Kolon - Fiyat Özeti */}
              <div className="lg:col-span-1">
                <div className="card sticky top-6 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Calculator className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Fiyat Özeti</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-white rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Para Birimi</p>
                      <p className="text-lg font-bold text-gray-900">
                        {currencySymbols[formData.currency]} {formData.currency}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Bizim Maliyet</p>
                      <p className="text-xl font-bold text-gray-900">
                        {currencySymbols[formData.currency]}{ourCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Bayi Liste Fiyatı</p>
                      <p className="text-xl font-bold text-blue-600">
                        {currencySymbols[formData.currency]}{dealerList.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {group && (
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">
                          Bayi İskontosu ({group.code} Grubu)
                        </p>
                        <p className="text-lg font-semibold text-red-600">
                          %{dealerDiscount.toFixed(0)}
                        </p>
                      </div>
                    )}

                    <div className="p-3 bg-white rounded-lg border-2 border-green-300">
                      <p className="text-xs text-gray-600 mb-1">Bayi Net Fiyatı</p>
                      <p className="text-2xl font-bold text-green-600">
                        {currencySymbols[formData.currency]}{dealerNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {profitMargin > 0 && (
                      <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="w-4 h-4 text-purple-600" />
                          <p className="text-xs text-gray-700 font-medium">Kar Marjı</p>
                        </div>
                        <p className="text-2xl font-bold text-purple-600">
                          %{profitMargin.toFixed(1)}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {currencySymbols[formData.currency]}{(dealerNet - ourCost).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} kar
                        </p>
                      </div>
                    )}
                  </div>

                  {profitMargin < 10 && profitMargin > 0 && (
                    <div className="mt-4 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
                      ⚠️ Kar marjı düşük
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push('/products')}
                className="btn-secondary flex items-center gap-2"
              >
                <X className="w-5 h-5" />
                İptal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full -5 border-b-2 border-white"></div>
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Ürünü Kaydet</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
