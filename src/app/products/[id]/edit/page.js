'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, X, Calculator, TrendingUp, AlertCircle, Upload, ImagePlus, Trash2 } from 'lucide-react'

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
    supplier_list_price: '',
    supplier_discount_percentage: '',
    price_multiplier: '1.00',
    dealer_list_price: '',
    specifications: '',
    image_url: '',
    is_published: false,
    is_active: true
  })

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }

  useEffect(() => {
    loadInitialData()
  }, [])

  // Fiyat hesaplaması için effect (Veriler yüklendikten sonra çalışmalı)
  useEffect(() => {
    if (!loading) {
      calculatePrices()
    }
  }, [
    formData.supplier_id,
    formData.supplier_list_price,
    formData.supplier_discount_percentage,
    formData.product_group_id,
    formData.price_multiplier
  ])

  async function loadInitialData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      // 1. Tedarikçileri ve Grupları Çek
      const [suppliersRes, groupsRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('company_id', profile.company_id).eq('is_active', true),
        supabase.from('product_groups').select('*').eq('company_id', profile.company_id).eq('is_active', true).order('sort_order')
      ])

      setSuppliers(suppliersRes.data || [])
      setProductGroups(groupsRes.data || [])

      // 2. Mevcut Ürünü Çek
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .single()

      if (productError) throw productError

      // Özellikleri JSON string'e çevir
      let specsString = ''
      if (product.specifications && Object.keys(product.specifications).length > 0) {
        specsString = JSON.stringify(product.specifications)
      }

      setFormData({
        ...product,
        supplier_list_price: product.supplier_list_price || '',
        supplier_discount_percentage: product.supplier_discount_percentage || '',
        dealer_list_price: product.dealer_list_price || '',
        specifications: specsString,
        price_multiplier: '1.00' // Varsayılan
      })

      if (product.image_url) setImagePreview(product.image_url)

    } catch (err) {
      console.error('Veri yükleme hatası:', err)
      setError('Ürün bilgileri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  function calculatePrices() {
    const supplier = suppliers.find(s => s.id === formData.supplier_id)
    
    // Eğer kritik veriler eksikse hesaplama yapma
    if (!supplier || !formData.supplier_list_price) return

    let ourCost = 0
    
    // Sadece maliyet hesapla, bayi fiyatını (dealer_list_price) otomatik ezmiyoruz.
    // Kullanıcı düzenleme ekranında bayi fiyatını manuel değiştirmiş olabilir.
    // Ancak yeni bir tedarikçi seçildiyse veya maliyet değiştiyse kullanıcıya bir ipucu verebiliriz.
    
    if (supplier.discount_type === 'percentage') {
      ourCost = parseFloat(formData.supplier_list_price) * (1 - parseFloat(formData.supplier_discount_percentage || 0) / 100)
    } else if (supplier.discount_type === 'net_price') {
      ourCost = parseFloat(formData.supplier_list_price)
    }
    
    // Buradaki mantığı "Yeni Ürün" sayfasından farklı tutuyoruz:
    // Otomatik olarak dealer_list_price'ı set etmiyoruz ki kullanıcının girdiği eski fiyat bozulmasın.
    // Ancak kullanıcı "sıfırdan" hesaplama yapmak isterse diye bir buton veya mantık eklenebilir.
    // Şimdilik basitlik adına: Sadece maliyet hesaplamalarını yapıyoruz, bayi fiyatı kullanıcının kontrolünde.
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSupplierChange = (e) => {
    const supplierId = e.target.value
    const supplier = suppliers.find(s => s.id === supplierId)
    
    setFormData(prev => ({
      ...prev,
      supplier_id: supplierId,
      supplier_discount_percentage: supplier?.discount_value || '',
      price_multiplier: supplier?.price_multiplier || '1.00'
    }))
  }

  const handleImageUpload = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      
      // Validasyonlar
      if (file.size > 5 * 1024 * 1024) {
        setError('Görsel boyutu 5MB\'dan küçük olmalıdır')
        return
      }
      if (!file.type.startsWith('image/')) {
        setError('Sadece görsel dosyaları yüklenebilir')
        return
      }

      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(fileName)

      setImagePreview(publicUrl)
      setFormData(prev => ({ ...prev, image_url: publicUrl }))
    } catch (err) {
      setError('Görsel yüklenirken hata: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // Specs JSON parse
      let specs = {}
      try {
        specs = JSON.parse(formData.specifications || '{}')
      } catch {
        specs = { info: formData.specifications }
      }

      const supplier = suppliers.find(s => s.id === formData.supplier_id)
      const group = productGroups.find(g => g.id === formData.product_group_id)

      // Backend için son hesaplamalar
      let ourCost = 0
      let dealerList = parseFloat(formData.dealer_list_price)
      let dealerDiscount = group?.dealer_discount_percentage || 0
      let dealerNet = dealerList * (1 - dealerDiscount / 100)
      let profitMargin = 0

      if (supplier?.discount_type === 'percentage') {
        ourCost = parseFloat(formData.supplier_list_price) * (1 - parseFloat(formData.supplier_discount_percentage || 0) / 100)
      } else if (supplier?.discount_type === 'net_price') {
        ourCost = parseFloat(formData.supplier_list_price)
      }

      if (ourCost > 0 && dealerNet > 0) {
        profitMargin = ((dealerNet - ourCost) / dealerNet) * 100
      }

      const { error: updateError } = await supabase
        .from('products')
        .update({
          product_code: formData.product_code,
          name: formData.name,
          description: formData.description,
          category: formData.category,
          unit: formData.unit,
          currency: formData.currency,
          supplier_id: formData.supplier_id,
          product_group_id: formData.product_group_id,
          supplier_list_price: parseFloat(formData.supplier_list_price) || 0,
          supplier_discount_percentage: parseFloat(formData.supplier_discount_percentage) || 0,
          our_cost_price: ourCost,
          dealer_list_price: dealerList,
          dealer_discount_percentage: dealerDiscount,
          dealer_net_price: dealerNet,
          profit_margin_percentage: profitMargin,
          list_price: dealerList,
          specifications: specs,
          image_url: formData.image_url,
          is_published: formData.is_published,
          is_active: formData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      if (updateError) throw updateError

      router.push('/products')
      router.refresh()
    } catch (err) {
      setError('Güncelleme hatası: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Render için anlık hesaplama (UI gösterimi)
  const supplier = suppliers.find(s => s.id === formData.supplier_id)
  const group = productGroups.find(g => g.id === formData.product_group_id)
  
  let ourCost = 0
  let dealerList = parseFloat(formData.dealer_list_price) || 0
  let dealerDiscount = group?.dealer_discount_percentage || 0
  let dealerNet = dealerList * (1 - dealerDiscount / 100)
  let profitMargin = 0

  if (supplier?.discount_type === 'percentage' && formData.supplier_discount_percentage) {
    ourCost = parseFloat(formData.supplier_list_price || 0) * (1 - parseFloat(formData.supplier_discount_percentage) / 100)
  } else if (supplier?.discount_type === 'net_price') {
    ourCost = parseFloat(formData.supplier_list_price || 0)
  }

  if (ourCost > 0 && dealerNet > 0) {
    profitMargin = ((dealerNet - ourCost) / dealerNet) * 100
  }

  if (loading) return <DashboardLayout><div className="flex justify-center items-center h-full">Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Ürünü Düzenle</h1>
              <p className="text-gray-600 mt-1">{formData.product_code} - {formData.name}</p>
            </div>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> {error}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* SOL KOLON */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Görsel Upload */}
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Ürün Görseli</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block cursor-pointer">
                        <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                        <div className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors ${uploading ? 'opacity-50' : ''}`}>
                          {uploading ? (
                            <div className="text-center text-gray-500">Yükleniyor...</div>
                          ) : imagePreview ? (
                            <div className="relative">
                              <img src={imagePreview} alt="Preview" className="w-full h-48 object-contain rounded-lg mb-3" />
                              <button type="button" onClick={() => {setImagePreview(null); setFormData(prev=>({...prev, image_url: null}))}} className="absolute top-0 right-0 bg-red-100 text-red-600 p-1 rounded-full"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <Upload className="w-12 h-12 text-gray-400 mb-3" />
                              <p className="text-sm text-gray-600 mb-1">Görsel Yükle</p>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                    <div className="flex items-center justify-center bg-gray-50 rounded-lg p-4 text-center">
                      <div>
                        <ImagePlus className="w-16 h-16 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Görsel katalogda görünecek</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Temel Bilgiler */}
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Temel Bilgiler</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Ürün Kodu <span className="text-red-500">*</span></label>
                      <input type="text" name="product_code" value={formData.product_code} onChange={handleChange} required className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
                      <input type="text" name="category" value={formData.category} onChange={handleChange} className="input-field" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Ürün Adı <span className="text-red-500">*</span></label>
                      <input type="text" name="name" value={formData.name} onChange={handleChange} required className="input-field" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                      <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={3} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Birim</label>
                      <select name="unit" value={formData.unit} onChange={handleChange} className="input-field">
                        <option>Adet</option><option>Metre</option><option>Metrekare</option><option>Kilogram</option><option>Litre</option><option>Kova</option><option>Rulo</option><option>Set</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Para Birimi <span className="text-red-500">*</span></label>
                      <select name="currency" value={formData.currency} onChange={handleChange} className="input-field">
                        <option value="TRY">₺ Türk Lirası</option><option value="USD">$ ABD Doları</option><option value="EUR">€ Euro</option><option value="GBP">£ İngiliz Sterlini</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Teknik Özellikler (JSON)</label>
                      <textarea name="specifications" value={formData.specifications} onChange={handleChange} rows={2} className="input-field font-mono text-sm" />
                    </div>
                  </div>
                </div>

                {/* Tedarikçi ve Grup */}
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Tedarikçi ve Grup</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tedarikçi</label>
                      <select name="supplier_id" value={formData.supplier_id} onChange={handleSupplierChange} required className="input-field">
                        <option value="">Seçiniz...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Ürün Grubu</label>
                      <select name="product_group_id" value={formData.product_group_id} onChange={handleChange} required className="input-field">
                        <option value="">Seçiniz...</option>
                        {productGroups.map(g => <option key={g.id} value={g.id}>{g.name} (%{g.dealer_discount_percentage} iskonto)</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Fiyatlandırma */}
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Fiyatlandırma</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tedarikçi Liste Fiyatı</label>
                      <input type="number" name="supplier_list_price" value={formData.supplier_list_price} onChange={handleChange} className="input-field" />
                    </div>
                    {supplier?.discount_type === 'percentage' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tedarikçi İskontosu (%)</label>
                        <input type="number" name="supplier_discount_percentage" value={formData.supplier_discount_percentage} onChange={handleChange} className="input-field" />
                      </div>
                    )}
                    {supplier?.discount_type === 'net_price' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Fiyat Çarpanı</label>
                        <input type="number" name="price_multiplier" value={formData.price_multiplier} onChange={handleChange} className="input-field" />
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Bayi Liste Fiyatı</label>
                      <input type="number" name="dealer_list_price" value={formData.dealer_list_price} onChange={handleChange} className="input-field text-lg font-bold" />
                    </div>
                  </div>
                </div>

                {/* Yayın Ayarları */}
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Yayın Ayarları</h2>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="rounded text-blue-600" />
                      <span className="text-sm font-medium">Ürün aktif</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="is_published" checked={formData.is_published} onChange={handleChange} className="rounded text-blue-600" />
                      <span className="text-sm font-medium">Bayi kataloğunda yayınla</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* SAĞ KOLON - FİYAT ÖZETİ (STICKY) */}
              <div className="lg:col-span-1">
                <div className="card sticky top-6 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Calculator className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Fiyat Özeti</h3>
                  </div>

                  <div className="space-y-3">
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
                        <p className="text-xs text-gray-600 mb-1">Bayi İskontosu</p>
                        <p className="text-lg font-semibold text-red-600">%{dealerDiscount.toFixed(0)}</p>
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
                        <p className="text-2xl font-bold text-purple-600">%{profitMargin.toFixed(1)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => router.push('/products')} className="btn-secondary flex items-center gap-2">
                <X className="w-5 h-5" /> İptal
              </button>
              <button type="submit" disabled={saving || uploading} className="btn-primary flex items-center gap-2">
                {saving ? 'Kaydediliyor...' : <><Save className="w-5 h-5" /> Değişiklikleri Kaydet</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
