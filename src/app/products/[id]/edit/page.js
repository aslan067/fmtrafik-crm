'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Save, X, Calculator, TrendingUp, AlertCircle, Upload, ImagePlus, DollarSign, Trash2 } from 'lucide-react'

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
    price_multiplier: '1.80',
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

  useEffect(() => {
    if (!loading) calculatePrices()
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
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

      const [suppliersRes, groupsRes, productRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('company_id', profile.company_id).eq('is_active', true).order('name'),
        supabase.from('product_groups').select('*').eq('company_id', profile.company_id).eq('is_active', true).order('sort_order'),
        supabase.from('products').select('*').eq('id', params.id).single()
      ])

      setSuppliers(suppliersRes.data || [])
      setProductGroups(groupsRes.data || [])

      const product = productRes.data
      let specsString = ''
      if (product.specifications && typeof product.specifications === 'object') {
        specsString = JSON.stringify(product.specifications)
      }

      setFormData({
        ...product,
        supplier_list_price: product.supplier_list_price || '',
        supplier_discount_percentage: product.supplier_discount_percentage || '',
        price_multiplier: product.price_multiplier || '1.80', // Bu alan db'de yoksa manuel default
        dealer_list_price: product.dealer_list_price || '',
        specifications: specsString
      })

      if (product.image_url) setImagePreview(product.image_url)

    } catch (err) {
      setError('Veri yükleme hatası')
    } finally {
      setLoading(false)
    }
  }

  function calculatePrices() {
    // Düzenleme modunda otomatik hesaplamayı biraz daha kontrollü yapıyoruz.
    // Kullanıcı verileri yüklediğinde, mevcut dealer_list_price'ı hemen ezmemeliyiz.
    // Ancak inputlarda bir değişiklik yaparsa hesaplamalıyız.
    // Basitlik adına şimdilik UI hesaplamasını ayrı tutuyoruz (aşağıda render kısmında),
    // formData güncellemesini ise sadece manuel inputlarla yapıyoruz.
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
      price_multiplier: supplier?.price_multiplier || '1.80'
    }))
  }

  const handleImageUpload = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage.from('products').upload(fileName, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName)
      setImagePreview(publicUrl)
      setFormData(prev => ({ ...prev, image_url: publicUrl }))
    } catch (err) {
      setError('Görsel hatası: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // Backend için son hesaplamalar (Güvenlik)
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
      const profitMargin = dealerNet > 0 ? ((dealerNet - ourCost) / dealerNet) * 100 : 0

      let specs = {}
      try { specs = JSON.parse(formData.specifications || '{}') } catch { specs = { info: formData.specifications } }

      const { error: updateError } = await supabase.from('products').update({
        product_code: formData.product_code,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        unit: formData.unit,
        currency: formData.currency,
        supplier_id: formData.supplier_id,
        product_group_id: formData.product_group_id,
        supplier_list_price: rawPrice,
        supplier_discount_percentage: parseFloat(formData.supplier_discount_percentage),
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
      }).eq('id', params.id)

      if (updateError) throw updateError
      router.push('/products')
      router.refresh()
    } catch (err) {
      setError('Güncelleme hatası: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // UI Hesaplamaları
  const selectedSupplier = suppliers.find(s => s.id === formData.supplier_id)
  const selectedGroup = productGroups.find(g => g.id === formData.product_group_id)
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

  if (loading) return <DashboardLayout><div className="flex justify-center items-center h-full">Yükleniyor...</div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Ürünü Düzenle</h1>
            <p className="text-gray-600 mt-1">{formData.product_code} - {formData.name}</p>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2"><AlertCircle className="w-5 h-5"/>{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 space-y-6">
                {/* Görsel */}
                <div className="card">
                  <h3 className="font-semibold mb-4">Görsel</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 cursor-pointer transition-colors">
                      <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                      {uploading ? <span>Yükleniyor...</span> : imagePreview ? (
                        <div className="relative">
                          <img src={imagePreview} className="h-32 mx-auto object-contain"/>
                          <button type="button" onClick={()=>{setImagePreview(null); setFormData(p=>({...p,image_url:null}))}} className="absolute top-0 right-0 bg-red-100 p-1 rounded-full text-red-600"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      ) : <div className="text-gray-500"><Upload className="w-8 h-8 mx-auto mb-2"/>Görsel Seç</div>}
                    </label>
                    <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-center text-sm text-blue-700">
                      <ImagePlus className="w-5 h-5 mr-2"/> Katalog görseli
                    </div>
                  </div>
                </div>

                {/* Ürün Bilgileri */}
                <div className="card">
                  <h3 className="font-semibold mb-4">Ürün Bilgileri</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium mb-1">Ürün Kodu *</label><input name="product_code" value={formData.product_code} onChange={handleChange} className="input-field" required /></div>
                    <div><label className="block text-sm font-medium mb-1">Kategori</label><input name="category" value={formData.category} onChange={handleChange} className="input-field" /></div>
                    <div className="col-span-2"><label className="block text-sm font-medium mb-1">Ürün Adı *</label><input name="name" value={formData.name} onChange={handleChange} className="input-field" required /></div>
                    <div className="col-span-2"><label className="block text-sm font-medium mb-1">Açıklama</label><textarea name="description" value={formData.description || ''} onChange={handleChange} rows={2} className="input-field" /></div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Birim</label>
                      <select name="unit" value={formData.unit} onChange={handleChange} className="input-field">
                        <option>Adet</option><option>Metre</option><option>Set</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Para Birimi</label>
                      <select name="currency" value={formData.currency} onChange={handleChange} className="input-field">
                        <option value="TRY">₺ TRY</option><option value="USD">$ USD</option><option value="EUR">€ EUR</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">Teknik Özellikler (JSON)</label>
                        <textarea name="specifications" value={formData.specifications} onChange={handleChange} rows={2} className="input-field font-mono text-sm" />
                    </div>
                  </div>
                </div>

                {/* Fiyatlandırma */}
                <div className="card border-l-4 border-l-blue-500">
                  <h3 className="font-semibold mb-4 flex items-center gap-2"><Calculator className="w-5 h-5 text-blue-600"/> Fiyatlandırma</h3>
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-medium mb-1">Tedarikçi *</label>
                      <select name="supplier_id" value={formData.supplier_id} onChange={handleSupplierChange} required className="input-field">
                        <option value="">Seçiniz...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Ürün Grubu *</label>
                      <select name="product_group_id" value={formData.product_group_id} onChange={handleChange} required className="input-field">
                        <option value="">Seçiniz...</option>
                        {productGroups.map(g => <option key={g.id} value={g.id}>{g.name} (%{g.dealer_discount_percentage})</option>)}
                      </select>
                    </div>
                  </div>

                  {selectedSupplier && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{selectedSupplier.discount_type === 'percentage' ? 'Liste Fiyatı' : 'Net Alış'}</span>
                        <input type="number" name="supplier_list_price" value={formData.supplier_list_price} onChange={handleChange} className="input-field w-1/2 font-bold text-right" />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{selectedSupplier.discount_type === 'percentage' ? 'İskonto (%)' : 'Çarpan (x)'}</span>
                        {selectedSupplier.discount_type === 'percentage' ? (
                          <input type="number" name="supplier_discount_percentage" value={formData.supplier_discount_percentage} onChange={handleChange} className="input-field w-1/2 text-right" />
                        ) : (
                          <input type="number" name="price_multiplier" value={formData.price_multiplier} onChange={handleChange} className="input-field w-1/2 text-right" />
                        )}
                      </div>
                      <div className="pt-4 border-t flex justify-between items-center">
                        <span className="text-sm font-medium">Bayi Liste Fiyatı</span>
                        <input type="number" name="dealer_list_price" value={formData.dealer_list_price} onChange={handleChange} className="input-field w-1/2 font-extrabold text-lg text-blue-600 text-right" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Yayın */}
                <div className="card">
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2"><input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="rounded text-blue-600"/> Aktif</label>
                    <label className="flex items-center gap-2"><input type="checkbox" name="is_published" checked={formData.is_published} onChange={handleChange} className="rounded text-blue-600"/> Yayınla</label>
                  </div>
                </div>
              </div>

              {/* Sağ Kolon - Özet */}
              <div className="lg:col-span-1">
                <div className="card sticky top-6 bg-white border-2 border-blue-100 shadow-lg">
                  <h3 className="font-bold mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-600"/> Analiz</h3>
                  <div className="space-y-4">
                    <div className="p-3 bg-gray-50 rounded border"><span className="text-xs block text-gray-500">Maliyet</span><span className="text-xl font-bold">{currencySymbols[formData.currency]}{uiOurCost.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                    <div className="p-3 bg-blue-50 rounded border border-blue-200"><span className="text-xs block text-blue-600">Liste Fiyatı</span><span className="text-xl font-bold text-blue-700">{currencySymbols[formData.currency]}{uiDealerList.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                    {selectedGroup && <div className="text-center text-red-500 text-sm">-%{selectedGroup.dealer_discount_percentage} İskonto</div>}
                    <div className="p-3 bg-green-50 rounded border border-green-200"><span className="text-xs block text-green-600">Net Satış</span><span className="text-2xl font-bold text-green-700">{currencySymbols[formData.currency]}{uiDealerNet.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                    <div className="pt-4 border-t flex justify-between"><span className="text-sm text-gray-600">Kar Marjı:</span><span className={`font-bold ${uiMargin<10?'text-red-600':'text-green-600'}`}>%{uiMargin.toFixed(1)}</span></div>
                  </div>
                </div>
              </div>

            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => router.push('/products')} className="btn-secondary flex items-center gap-2"><X className="w-4 h-4"/> İptal</button>
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">{saving ? 'Kaydediliyor...' : <><Save className="w-4 h-4"/> Güncelle</>}</button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
