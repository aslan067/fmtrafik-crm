'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  Save, AlertCircle, Globe, Eye, Copy, Check, 
  Upload, Palette, ToggleLeft 
} from 'lucide-react'

export default function CatalogSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copied, setCopied] = useState(false)
  const [companyId, setCompanyId] = useState(null)
  const [companyName, setCompanyName] = useState('')
  
  const [formData, setFormData] = useState({
    catalog_url_slug: '',
    catalog_title: 'Ürün Kataloğu',
    show_prices: true,
    show_dealer_discount: true,
    show_specifications: true,
    show_product_codes: true,
    items_per_page: 24,
    logo_url: '',
    header_color: '#2563eb',
    custom_message: '',
    is_active: true
  })

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const user = await getCurrentUser()
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id, companies(name)')
        .eq('id', user.id)
        .single()

      setCompanyId(profile.company_id)
      setCompanyName(profile.companies.name)

      // Katalog ayarlarını yükle
      const { data: settings, error: settingsError } = await supabase
        .from('catalog_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .single()

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError
      }

      if (settings) {
        setFormData({
          catalog_url_slug: settings.catalog_url_slug || '',
          catalog_title: settings.catalog_title || 'Ürün Kataloğu',
          show_prices: settings.show_prices !== false,
          show_dealer_discount: settings.show_dealer_discount !== false,
          show_specifications: settings.show_specifications !== false,
          show_product_codes: settings.show_product_codes !== false,
          items_per_page: settings.items_per_page || 24,
          logo_url: settings.logo_url || '',
          header_color: settings.header_color || '#2563eb',
          custom_message: settings.custom_message || '',
          is_active: settings.is_active !== false
        })
      } else {
        // Varsayılan slug oluştur (şirket adından)
        const defaultSlug = profile.companies.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        
        setFormData(prev => ({
          ...prev,
          catalog_url_slug: defaultSlug
        }))
      }
    } catch (err) {
      console.error('Error loading settings:', err)
      setError('Ayarlar yüklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
  }

  const handleSlugChange = (e) => {
    let slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-')
    
    setFormData({
      ...formData,
      catalog_url_slug: slug
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (!formData.catalog_url_slug) {
        throw new Error('Katalog URL slug\'ı zorunludur')
      }

      // Slug'ın benzersiz olup olmadığını kontrol et
      const { data: existingSlugs } = await supabase
        .from('catalog_settings')
        .select('id, company_id')
        .eq('catalog_url_slug', formData.catalog_url_slug)
        .neq('company_id', companyId)

      if (existingSlugs && existingSlugs.length > 0) {
        throw new Error('Bu katalog URL\'si başka bir şirket tarafından kullanılıyor')
      }

      // Mevcut kayıt var mı kontrol et
      const { data: existing } = await supabase
        .from('catalog_settings')
        .select('id')
        .eq('company_id', companyId)
        .single()

      const dataToSave = {
        company_id: companyId,
        ...formData,
        updated_at: new Date().toISOString()
      }

      if (existing) {
        // Güncelle
        const { error: updateError } = await supabase
          .from('catalog_settings')
          .update(dataToSave)
          .eq('company_id', companyId)

        if (updateError) throw updateError
      } else {
        // Yeni kayıt
        const { error: insertError } = await supabase
          .from('catalog_settings')
          .insert([dataToSave])

        if (insertError) throw insertError
      }

      setSuccess('Katalog ayarları başarıyla kaydedildi!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error saving settings:', err)
      setError(err.message || 'Ayarlar kaydedilirken hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  const catalogUrl = `${window.location.origin}/catalog/${formData.catalog_url_slug}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(catalogUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Yükleniyor...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Bayi Kataloğu Ayarları</h1>
            <p className="text-gray-600 mt-2">
              Bayilerinizin erişeceği ürün kataloğunu yapılandırın
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Katalog URL */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Katalog URL</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL Slug <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center px-3 py-2 border border-r-0 border-gray-300 bg-gray-50 text-gray-500 rounded-l-lg text-sm">
                      {window.location.origin}/catalog/
                    </span>
                    <input
                      type="text"
                      name="catalog_url_slug"
                      value={formData.catalog_url_slug}
                      onChange={handleSlugChange}
                      required
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="fmtrafik"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Sadece küçük harf, rakam ve tire (-) kullanılabilir
                  </p>
                </div>

                {formData.catalog_url_slug && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-700 mb-2">📍 Katalog Adresi:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded text-sm text-blue-600 font-mono">
                        {catalogUrl}
                      </code>
                      <button
                        type="button"
                        onClick={copyToClipboard}
                        className="btn-secondary flex items-center gap-2 whitespace-nowrap"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4" />
                            Kopyalandı
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Kopyala
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(catalogUrl, '_blank')}
                        className="btn-secondary flex items-center gap-2 whitespace-nowrap"
                      >
                        <Eye className="w-4 h-4" />
                        Önizle
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Katalog Başlığı
                  </label>
                  <input
                    type="text"
                    name="catalog_title"
                    value={formData.catalog_title}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ürün Kataloğu"
                  />
                </div>
              </div>
            </div>

            {/* Görünüm Ayarları */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">Görünüm Ayarları</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Header Rengi
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      name="header_color"
                      value={formData.header_color}
                      onChange={handleChange}
                      className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.header_color}
                      onChange={(e) => setFormData({ ...formData, header_color: e.target.value })}
                      className="input-field w-32 font-mono text-sm"
                    />
                    <span className="text-sm text-gray-600">Katalog başlık çubuğu rengi</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    name="logo_url"
                    value={formData.logo_url}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Katalog başlığında gösterilecek logo
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Özel Mesaj
                  </label>
                  <textarea
                    name="custom_message"
                    value={formData.custom_message}
                    onChange={handleChange}
                    rows={3}
                    className="input-field"
                    placeholder="Bayilerimize özel mesaj..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Katalog üst kısmında gösterilecek mesaj
                  </p>
                </div>
              </div>
            </div>

            {/* Gösterim Ayarları */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <ToggleLeft className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Gösterim Ayarları</h2>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    name="show_prices"
                    checked={formData.show_prices}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Fiyatları Göster</span>
                    <p className="text-xs text-gray-500">Liste fiyatı ve net fiyatı göster</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    name="show_dealer_discount"
                    checked={formData.show_dealer_discount}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">İskonto Oranını Göster</span>
                    <p className="text-xs text-gray-500">Bayi iskonto yüzdesini göster</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    name="show_specifications"
                    checked={formData.show_specifications}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Teknik Özellikleri Göster</span>
                    <p className="text-xs text-gray-500">Ürün özelliklerini göster</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    name="show_product_codes"
                    checked={formData.show_product_codes}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Ürün Kodlarını Göster</span>
                    <p className="text-xs text-gray-500">Ürün kodunu göster</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Katalog Aktif</span>
                    <p className="text-xs text-gray-500">Kataloğu yayında tut</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Sayfalama */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Sayfalama</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sayfa Başına Ürün Sayısı
                </label>
                <select
                  name="items_per_page"
                  value={formData.items_per_page}
                  onChange={handleChange}
                  className="input-field w-32"
                >
                  <option value="12">12</option>
                  <option value="24">24</option>
                  <option value="48">48</option>
                  <option value="96">96</option>
                </select>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.push('/settings')}
                className="btn-secondary"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Ayarları Kaydet</span>
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
