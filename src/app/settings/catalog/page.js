'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import {
  Save, AlertCircle, Globe, Eye, Copy, Check,
  Palette, ToggleLeft
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
  const [catalogUrl, setCatalogUrl] = useState('')
  const [origin, setOrigin] = useState('')

  // --- formData tek merkezi state (birleştirilmiş, detaylı)
  const [formData, setFormData] = useState({
    catalog_url_slug: '',
    catalog_title: 'Ürün Kataloğu',
    show_list_price: true,
    show_net_price: true,
    show_dealer_discount: true,
    show_specifications: true,
    show_product_codes: true,
    items_per_page: 24,
    logo_url: '',
    header_color: '#2563eb',
    custom_message: '',
    is_active: true
  })

  // origin alınsın (SSR'de window yok)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin || '')
    }
  }, [])

  // katalog url'ini formData.slug'a bağlı olarak güncelle
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const slug = formData.catalog_url_slug || ''
      setCatalogUrl(`${window.location.origin}/catalog/${slug}`)
    } else {
      setCatalogUrl(`/catalog/${formData.catalog_url_slug || ''}`)
    }
  }, [formData.catalog_url_slug])

  // -------------------------
  // Ayarları yükle
  // -------------------------
  useEffect(() => {
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadSettings() {
    try {
      const user = await getCurrentUser()
      if (!user) {
        setError('Kullanıcı bulunamadı')
        setLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('company_id, companies(name)')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError
      if (!profile) throw new Error('Profil bulunamadı')

      setCompanyId(profile.company_id)
      setCompanyName(profile.companies?.name || '')

      // Katalog Ayarlarını Çek
      const { data: settings, error: settingsError } = await supabase
        .from('catalog_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .maybeSingle()

      if (settingsError) throw settingsError

      if (settings) {
        // settings'de farklı isimler varsa uyumlu hale getir
        const merged = {
          catalog_url_slug: settings.catalog_url_slug || '',
          catalog_title: settings.catalog_title || 'Ürün Kataloğu',
          // destek için hem show_prices hem de ayrı alanları kontrol et
          show_list_price: typeof settings.show_list_price !== 'undefined'
            ? settings.show_list_price
            : (typeof settings.show_prices !== 'undefined' ? settings.show_prices : true),
          show_net_price: typeof settings.show_net_price !== 'undefined'
            ? settings.show_net_price
            : (typeof settings.show_prices !== 'undefined' ? settings.show_prices : true),
          show_dealer_discount: settings.show_dealer_discount !== false,
          show_specifications: settings.show_specifications !== false,
          show_product_codes: settings.show_product_codes !== false,
          items_per_page: settings.items_per_page || 24,
          logo_url: settings.logo_url || '',
          header_color: settings.header_color || '#2563eb',
          custom_message: settings.custom_message || '',
          is_active: settings.is_active !== false
        }

        setFormData(prev => ({ ...prev, ...merged }))
      } else {
        // Varsayılan slug oluştur (şirket adına göre)
        const defaultSlug = (profile.companies?.name || 'katalog')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        setFormData(prev => ({
          ...prev,
          catalog_url_slug: defaultSlug
        }))
      }
    } catch (err) {
      console.error(err)
      setError('Ayarlar yüklenirken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  // -------------------------
  // Input değişimi
  // -------------------------
  const handleChange = e => {
    const { name, value, type, checked } = e.target

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
    }))
  }

  // Slug sanitize
  const handleSlugChange = (e) => {
    const slug = (e.target.value || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-')

    setFormData(prev => ({
      ...prev,
      catalog_url_slug: slug
    }))
  }

  // -------------------------
  // Kaydet
  // -------------------------
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (!formData.catalog_url_slug) {
        throw new Error('Katalog URL slug zorunludur.')
      }

      // Slug başka şirkette var mı?
      const { data: existingSlugs, error: slugErr } = await supabase
        .from('catalog_settings')
        .select('id, company_id')
        .eq('catalog_url_slug', formData.catalog_url_slug)
        .neq('company_id', companyId)

      if (slugErr) throw slugErr

      if (existingSlugs?.length > 0) {
        throw new Error('Bu URL başka bir şirket tarafından kullanılıyor.')
      }

      // Mevcut kayıt var mı?
      const { data: existing, error: existingErr } = await supabase
        .from('catalog_settings')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle()

      if (existingErr) throw existingErr

      const payload = {
        company_id: companyId,
        catalog_url_slug: formData.catalog_url_slug,
        catalog_title: formData.catalog_title,
        show_list_price: formData.show_list_price,
        show_net_price: formData.show_net_price,
        show_dealer_discount: formData.show_dealer_discount,
        show_specifications: formData.show_specifications,
        show_product_codes: formData.show_product_codes,
        items_per_page: formData.items_per_page,
        logo_url: formData.logo_url,
        header_color: formData.header_color,
        custom_message: formData.custom_message,
        is_active: formData.is_active,
        updated_at: new Date().toISOString()
      }

      if (existing) {
        // UPDATE
        const { error: updateErr } = await supabase
          .from('catalog_settings')
          .update(payload)
          .eq('company_id', companyId)

        if (updateErr) throw updateErr
      } else {
        // INSERT
        const { error: insertErr } = await supabase
          .from('catalog_settings')
          .insert([payload])

        if (insertErr) throw insertErr
      }

      setSuccess('Katalog ayarları kaydedildi!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Ayarlar kaydedilirken bir hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = () => {
    try {
      navigator.clipboard.writeText(catalogUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Kopyalama hatası', e)
      setError('Kopyalama başarısız oldu.')
    }
  }

  // -------------------------
  // Render (UI)
  // -------------------------
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-b-2 border-blue-600 rounded-full mx-auto"></div>
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
                      {origin ? `${origin}/catalog/` : '/catalog/'}
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
                        onClick={() => {
                          if (typeof window !== 'undefined') window.open(catalogUrl, '_blank')
                        }}
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

            {/* Gösterim Ayarları (Birleşik - Detaylı) */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <ToggleLeft className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Gösterim Ayarları</h2>
              </div>

              <div className="space-y-4">
                {/* Fiyat Gösterimi Başlığı */}
                <div className="pb-3 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">💰 Fiyat Gösterimi</h3>
                  <p className="text-xs text-gray-500">Bayilere hangi fiyat bilgilerinin gösterileceğini seçin</p>
                </div>

                {/* Liste Fiyatı */}
                <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    name="show_list_price"
                    checked={formData.show_list_price}
                    onChange={handleChange}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">Liste Fiyatını Göster</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">İskontosuz</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Bayi liste fiyatını göster (üstü çizili olarak). 
                      <br />
                      <strong className="text-gray-700">Örnek:</strong> <span className="line-through">₺1.000,00</span>
                    </p>
                  </div>
                </label>

                {/* Net Fiyat */}
                <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    name="show_net_price"
                    checked={formData.show_net_price}
                    onChange={handleChange}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">Net Fiyatı Göster</span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">İskontolu</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      İskonto uygulanmış net fiyatı göster (yeşil renkle vurgulu).
                      <br />
                      <strong className="text-gray-700">Örnek:</strong> <span className="text-green-600 font-semibold">₺550,00</span>
                    </p>
                  </div>
                </label>

                {/* İskonto Oranı */}
                <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    name="show_dealer_discount"
                    checked={formData.show_dealer_discount}
                    onChange={handleChange}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">İskonto Oranını Göster</span>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">%</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Bayi iskonto yüzdesini göster.
                      <br />
                      <strong className="text-gray-700">Örnek:</strong> <span className="text-red-600">%45</span> İskonto
                    </p>
                  </div>
                </label>

                {/* Fiyat Önizleme */}
                {(formData.show_list_price || formData.show_net_price || formData.show_dealer_discount) && (
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
                    <p className="text-xs font-semibold text-gray-700 mb-3">👁️ Önizleme (bayilerin göreceği)</p>
                    <div className="bg-white p-3 rounded-lg space-y-2">
                      {formData.show_list_price && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Liste Fiyatı:</span>
                          <span className="text-gray-600 line-through">₺1.000,00</span>
                        </div>
                      )}
                      {formData.show_dealer_discount && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">İskonto:</span>
                          <span className="text-red-600 font-semibold">%45</span>
                        </div>
                      )}
                      {formData.show_net_price && (
                        <div className="flex items-center justify-between text-sm pt-2 border-t">
                          <span className="font-semibold text-gray-700">Net Fiyat:</span>
                          <span className="text-lg font-bold text-green-600">₺550,00</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Uyarı */}
                {!formData.show_list_price && !formData.show_net_price && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800">
                      ⚠️ <strong>Dikkat:</strong> En az bir fiyat türü seçmelisiniz (Liste veya Net)
                    </p>
                  </div>
                )}

                {/* Diğer Bilgiler */}
                <div className="pt-4 pb-3 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">📋 Diğer Bilgiler</h3>
                  <p className="text-xs text-gray-500">Ürün kartlarında gösterilecek ek bilgiler</p>
                </div>

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
                    <p className="text-xs text-gray-500">Ürün özelliklerini detay sayfasında göster</p>
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
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                  <option value={96}>96</option>
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
