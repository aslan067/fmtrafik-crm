'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { Package } from 'lucide-react'

export default function CatalogLayout({ children }) {
  const params = useParams()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCatalogSettings()
  }, [params.slug])

  async function loadCatalogSettings() {
    try {
      const { data, error } = await supabase
        .from('catalog_settings')
        .select('*, companies(name)')
        .eq('catalog_url_slug', params.slug)
        .eq('is_active', true)
        .single()

      if (error) throw error
      setSettings(data)
    } catch (error) {
      console.error('Error loading catalog settings:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Katalog Bulunamadı</h1>
          <p className="text-gray-600">Bu katalog aktif değil veya mevcut değil.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header 
        className="sticky top-0 z-50 shadow-sm"
        style={{ backgroundColor: settings.header_color || '#2563eb' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {settings.logo_url ? (
                <img 
                  src={settings.logo_url} 
                  alt={settings.companies.name}
                  className="h-10 w-auto"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Package className="w-8 h-8 text-white" />
                  <h1 className="text-xl font-bold text-white">
                    {settings.companies.name}
                  </h1>
                </div>
              )}
              <span className="text-white/80 text-sm">
                {settings.catalog_title}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Custom Message */}
      {settings.custom_message && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <p className="text-sm text-blue-800">{settings.custom_message}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>© {new Date().getFullYear()} {settings.companies.name}. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
