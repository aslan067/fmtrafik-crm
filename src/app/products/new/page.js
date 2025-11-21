'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, X, Calculator, TrendingUp, AlertCircle, Upload, ImagePlus, DollarSign, Percent } from 'lucide-react'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
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
    supplier_list_price: '',        // Bu alan dinamik: Net alış fiyatı veya Liste fiyatı olabilir
    supplier_discount_percentage: '',
    price_multiplier: '1.80',       // Varsayılan çarpan
    dealer_list_price: '',          // Bizim kataloğa koyacağımız fiyat
    specifications: '',
    image_url: '',
    is_published: false,
    is_active: true
  })

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }

  useEffect(() => {
    loadData()
  }, [])

  // Fiyat verileri değiştikçe hesaplamayı tetikle
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
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const [suppliersRes, groupsRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('company_id', profile.company_id).eq('is_active', true).order('name'),
        supabase.from('product_groups').select('*').eq('company_id', profile.company_id).eq('is_active', true).order('sort_order')
      ])
      
      setSuppliers(suppliersRes.data || [])
      setProductGroups(groupsRes.data || [])
    } catch (err) {
      setError('Veriler yüklenirken hata oluştu')
    }
  }

  function calculatePrices() {
    const supplier = suppliers.find(s => s.id === formData.supplier_id)
    const rawPrice = parseFloat(formData.supplier_list_price) || 0
    
    if (!supplier) return

    let ourCost = 0
    let calculatedDealerList = 0

    // 1. Maliyet ve Liste Fiyatı Hesaplama (Tedarikçi Tipine Göre)
    if (supplier.discount_type === 'percentage') {
      // SENARYO B: Liste Fiyatı + İskonto
      const discount = parseFloat(formData.supplier_discount_percentage) || 0
      ourCost = rawPrice * (1 - discount / 100)
      
      // Bu senaryoda genelde Bayi Liste Fiyatı = Tedarikçi Liste Fiyatı olur
      // Ama kullanıcı manuel değiştirmek isterse diye, eğer dealer_list_price boşsa veya otomatik moddaysak atama yapıyoruz
      // Basitlik için: İlk girişte otomatik atıyoruz.
      calculatedDealerList = rawPrice
    } else {
      // SENARYO A: Net Fiyat + Çarpan
      const multiplier = parseFloat(formData.price_multiplier) || 1.0
      ourCost = rawPrice // Net fiyat direkt maliyettir
      calculatedDealerList = rawPrice * multiplier
    }

    // State'i güncelle (Kullanıcı dealer_list_price'ı manuel ezmediyse otomatiği kullan)
    // Not: Yeni ürün olduğu için her zaman hesaplananı öneriyoruz
    setFormData(prev => ({
      ...prev,
      dealer_list_price: calculatedDealerList.toFixed(2)
    }))
  }

  const handleSupplierChange = (e) => {
    const supplierId = e.target.value
    const supplier = suppliers.find(s => s.id === supplierId)
    
    setFormData(prev => ({
      ...prev,
      supplier_id: supplierId,
      // Tedarikçi değişince varsayılan değerlerini getir
      supplier_discount_percentage: supplier?.discount_value || '',
      price_multiplier: supplier?.price_multiplier || '1.80'
    }))
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleImageUpload = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      if (file.size > 5 * 1024 * 1024) { setError('Görsel max 5MB olmalı'); return }

      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage.from('products').upload(fileName, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName)
      setImagePreview(publicUrl)
      setFormData(prev => ({ ...prev, image_url: publicUrl }))
    } catch (err) {
      setError('Görsel yükleme hatası: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      // Son bir hesaplama yap (Ekranda ne görünüyorsa backend'e doğru gitsin)
      const supplier = suppliers.find(s => s.id === formData.supplier_id)
      const group = productGroups.find(g => g.id === formData.product_group_id)
      
      const rawPrice = parseFloat(formData.supplier_list_price) || 0
      let ourCost = 0
      
      if (supplier?.discount_type === 'percentage') {
        ourCost = rawPrice * (1 - (parseFloat(formData.supplier_discount_percentage)||0) / 100)
      } else {
        ourCost = rawPrice
      }

      const dealerList = parseFloat(formData.dealer_list_price) || 0
      const dealerDiscount = group?.dealer_discount_percentage || 0
      const dealerNet = dealerList * (1 - dealerDiscount / 100)
      
      // Kar marjı formülü: (Satış - Maliyet) / Satış
      const profitMargin = dealerNet > 0 ? ((dealerNet - ourCost) / dealerNet) * 100 : 0

      // Specs JSON
      let specs = {}
      try { specs = JSON.parse(formData.specifications || '{}') } catch { specs = { info: formData.specifications } }

      const { error: insertError } = await supabase.from('products').insert([{
        company_id: profile.company_id,
        product_code: formData.product_code,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        unit: formData.unit,
        currency: formData.currency,
        supplier_id: formData.supplier_id,
        product_group_id: formData.product_group_id,
        supplier_list_price: rawPrice, // Bu hem liste hem net fiyat olabilir, bağlama göre değişir
        supplier_discount_percentage: parseFloat(formData.supplier_discount_percentage),
        price_multiplier: parseFloat(formData.price_multiplier), // Veritabanında bu alan yoksa eklemek gerekebilir veya settings'de tutulabilir. Şimdilik hesaplama için kullanıp, sonucu dealer_list_price'a yazıyoruz.
        our_cost_price: ourCost,
        dealer_list_price: dealerList,
        dealer_discount_percentage: dealerDiscount,
        dealer_net_price: dealerNet,
        profit_margin_percentage: profitMargin,
        list_price: dealerList, // Yedek
        specifications: specs,
        image_url: formData.image_url,
        is_published: formData.is_published,
        is_active: formData.is_active
      }])

      if (insertError) throw insertError
      router.push('/products')
    } catch (err) {
      setError('Kayıt hatası: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // UI Helper Variables
  const selectedSupplier = suppliers.find(s => s.id === formData.supplier_id)
  const selectedGroup = productGroups.find(g => g.id === formData.product_group_id)
  
  // Anlık Hesaplama Gösterimi (UI İçin)
  const rawPrice = parseFloat(formData.supplier_list_price) || 0
  let uiOurCost = 0
  if (selectedSupplier?.discount_type === 'percentage') {
    uiOurCost = rawPrice * (1 - (parseFloat(formData.supplier_discount_percentage)||0) / 100)
  } else {
    uiOurCost = rawPrice
  }
  const uiDealerList = parseFloat(formData.dealer_list_price) || 0
  const uiDealerNet = uiDealerList * (1 - (selectedGroup?.dealer_discount_percentage || 0) / 100)
  const uiProfit = uiDealerNet - uiOurCost
  const uiMargin = uiDealerNet > 0 ? (uiProfit / uiDealerNet) * 100 : 0

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Yeni Ürün Ekle</h1>
            <p className="text-gray-600 mt-1">Ürün detaylarını ve fiyatlandırma stratejisini belirleyin</p>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2"><AlertCircle className="w-5 h-5"/>{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* SOL KOLON */}
              <div className="lg:col-span-2 space-y-6">
                {/* Görsel */}
                <div className="card">
                  <h3 className="font-semibold mb-4">Görsel</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 cursor-pointer transition-colors">
                      <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                      {uploading ? <span>Yükleniyor...</span> : imagePreview ? <img src={imagePreview} className="h-32 mx-auto object-contain"/> : <div className="text-gray-500"><Upload className="w-8 h-8 mx-auto mb-2"/>Görsel Seç</div>}
                    </label>
                    <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-center text-sm text-blue-700">
                      <ImagePlus className="w-5 h-5 mr-2"/> Katalogda görünecek ana görsel
                    </div>
                  </div>
                </div>

                {/* Temel Bilgiler */}
                <div className="card">
                  <h3 className="font-semibold mb-4">Ürün Bilgileri</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Ürün Kodu *</label>
                      <input name="product_code" value={formData.product_code} onChange={handleChange} className="input-field" required placeholder="Örn: DB-75" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Kategori</label>
                      <input name="category" value={formData.category} onChange={handleChange} className="input-field" placeholder="Trafik Dubaları" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Ürün Adı *</label>
                      <input name="name" value={formData.name} onChange={handleChange} className="input-field" required placeholder="75 cm Esnek Duba" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Açıklama</label>
                      <textarea name="description" value={formData.description} onChange={handleChange} rows={2} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Birim</label>
                      <select name="unit" value={formData.unit} onChange={handleChange} className="input-field">
                        <option>Adet</option><option>Takım</option><option>Metre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Para Birimi</label>
                      <select name="currency" value={formData.currency} onChange={handleChange} className="input-field">
                        <option value="TRY">₺ TRY</option><option value="USD">$ USD</option><option value="EUR">€ EUR</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Fiyatlandırma Motoru */}
                <div className="card border-l-4 border-l-blue-500">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-blue-600"/> Fiyatlandırma Stratejisi
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-medium mb-1">Tedarikçi *</label>
                      <select name="supplier_id" value={formData.supplier_id} onChange={handleSupplierChange} required className="input-field">
                        <option value="">Seçiniz...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.discount_type === 'percentage' ? 'İskontolu' : 'Net'})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Ürün Grubu (Bayi İsk.) *</label>
                      <select name="product_group_id" value={formData.product_group_id} onChange={handleChange} required className="input-field">
                        <option value="">Seçiniz...</option>
                        {productGroups.map(g => <option key={g.id} value={g.id}>{g.name} (%{g.dealer_discount_percentage})</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Dinamik Fiyat Alanları */}
                  {selectedSupplier ? (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {selectedSupplier.discount_type === 'percentage' ? '1. Tedarikçi Liste Fiyatı' : '1. Net Alış Fiyatı'}
                        </span>
                        <div className="relative w-1/2">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{currencySymbols[formData.currency]}</span>
                          <input 
                            type="number" 
                            name="supplier_list_price" 
                            value={formData.supplier_list_price} 
                            onChange={handleChange} 
                            className="input-field pl-8 font-bold" 
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {selectedSupplier.discount_type === 'percentage' ? '2. Alış İskontosu (%)' : '2. Fiyat Çarpanı (x)'}
                        </span>
                        <div className="relative w-1/2">
                          {selectedSupplier.discount_type === 'percentage' ? (
                            <>
                              <input 
                                type="number" 
                                name="supplier_discount_percentage" 
                                value={formData.supplier_discount_percentage} 
                                onChange={handleChange} 
                                className="input-field pr-8" 
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                            </>
                          ) : (
                            <>
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">x</span>
                              <input 
                                type="number" 
                                name="price_multiplier" 
                                value={formData.price_multiplier} 
                                onChange={handleChange} 
                                className="input-field pl-8" 
                                step="0.01"
                              />
                            </>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-300 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900">3. Bayi Liste Fiyatı (Katalog)</span>
                          <p className="text-xs text-gray-500">Otomatik hesaplanır, düzenlenebilir.</p>
                        </div>
                        <div className="relative w-1/2">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{currencySymbols[formData.currency]}</span>
                          <input 
                            type="number" 
                            name="dealer_list_price" 
                            value={formData.dealer_list_price} 
                            onChange={handleChange} 
                            className="input-field pl-8 font-extrabold text-lg text-blue-600 border-blue-300" 
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      Fiyatlandırma seçeneklerini görmek için bir tedarikçi seçin.
                    </div>
                  )}
                </div>

                {/* Yayın */}
                <div className="card">
                  <h3 className="font-semibold mb-2">Durum</h3>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2"><input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="rounded text-blue-600"/> Aktif</label>
                    <label className="flex items-center gap-2"><input type="checkbox" name="is_published" checked={formData.is_published} onChange={handleChange} className="rounded text-blue-600"/> Katalogda Yayınla</label>
                  </div>
                </div>
              </div>

              {/* SAĞ KOLON - ÖZET (STICKY) */}
              <div className="lg:col-span-1">
                <div className="card sticky top-6 bg-white border-2 border-blue-100 shadow-lg">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600"/> Fiyat Analizi
                  </h3>

                  <div className="space-y-4">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-xs text-gray-500 block mb-1">Bizim Maliyetimiz</span>
                      <span className="text-xl font-bold text-gray-700">
                        {currencySymbols[formData.currency]}{uiOurCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-center text-gray-400">
                      <TrendingUp className="w-4 h-4" />
                    </div>

                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="text-xs text-blue-600 block mb-1 font-semibold">Katalog Fiyatı (Bayi Liste)</span>
                      <span className="text-xl font-bold text-blue-700">
                        {currencySymbols[formData.currency]}{uiDealerList.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {selectedGroup && (
                      <div className="text-center text-sm text-red-500 font-medium">
                        - %{selectedGroup.dealer_discount_percentage} Bayi İskontosu
                      </div>
                    )}

                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <span className="text-xs text-green-600 block mb-1 font-semibold">Bayi Net Fiyatı (Satış)</span>
                      <span className="text-2xl font-bold text-green-700">
                        {currencySymbols[formData.currency]}{uiDealerNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600">Brüt Kar:</span>
                        <span className="font-medium text-gray-900">{currencySymbols[formData.currency]}{uiProfit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Kar Marjı:</span>
                        <span className={`font-bold ${uiMargin < 10 ? 'text-red-600' : 'text-green-600'}`}>
                          %{uiMargin.toFixed(1)}
                        </span>
                      </div>
                      {uiMargin < 10 && uiMargin > 0 && (
                        <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3"/> Kar marjı düşük!
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => router.push('/products')} className="btn-secondary flex items-center gap-2"><X className="w-4 h-4"/> İptal</button>
              <button type="submit" disabled={loading || uploading} className="btn-primary flex items-center gap-2">{loading ? 'Kaydediliyor...' : <><Save className="w-4 h-4"/> Ürünü Kaydet</>}</button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
