'use client'

import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { Globe, Palette, Settings as SettingsIcon } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()

  const settingsCategories = [
    {
      id: 'catalog',
      title: 'Bayi Kataloğu',
      description: 'Katalog URL, görünüm ve yayın ayarları',
      icon: Globe,
      color: 'bg-blue-100 text-blue-600',
      path: '/settings/catalog'
    },
    {
      id: 'company',
      title: 'Şirket Bilgileri',
      description: 'Şirket adı, logo, iletişim bilgileri',
      icon: SettingsIcon,
      color: 'bg-purple-100 text-purple-600',
      path: '/settings/company'
    },
    {
      id: 'appearance',
      title: 'Görünüm',
      description: 'Tema, renkler ve özelleştirme',
      icon: Palette,
      color: 'bg-pink-100 text-pink-600',
      path: '/settings/appearance'
    }
  ]

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Ayarlar</h1>
            <p className="text-gray-600 mt-2">Sistem ayarlarınızı yönetin</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {settingsCategories.map(category => (
              <button
                key={category.id}
                onClick={() => router.push(category.path)}
                className="card hover:shadow-lg transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${category.color} group-hover:scale-110 transition-transform`}>
                    <category.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{category.title}</h3>
                    <p className="text-sm text-gray-600">{category.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
