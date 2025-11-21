'use client'

import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { Globe, Building2, CreditCard, FileText, Palette } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()

  const settingsCategories = [
    {
      id: 'company',
      title: 'Şirket Bilgileri',
      description: 'Logo, iletişim bilgileri ve adres yönetimi',
      icon: Building2,
      color: 'bg-purple-100 text-purple-600',
      path: '/settings/company'
    },
    {
      id: 'banks',
      title: 'Banka Hesapları',
      description: 'Tekliflerde görünecek banka hesapları',
      icon: CreditCard,
      color: 'bg-green-100 text-green-600',
      path: '/settings/banks'
    },
    {
      id: 'quotes',
      title: 'Teklif Ayarları',
      description: 'Varsayılan teklif şartları ve notlar',
      icon: FileText,
      color: 'bg-yellow-100 text-yellow-600',
      path: '/settings/quotes'
    },
    {
      id: 'catalog',
      title: 'Bayi Kataloğu',
      description: 'Katalog URL, görünüm ve yayın ayarları',
      icon: Globe,
      color: 'bg-blue-100 text-blue-600',
      path: '/settings/catalog'
    }
  ]

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Ayarlar</h1>
            <p className="text-gray-600 mt-2">Şirket ve sistem ayarlarınızı yönetin</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {settingsCategories.map(category => (
              <button
                key={category.id}
                onClick={() => router.push(category.path)}
                className="card hover:shadow-lg transition-all text-left group p-6 flex items-start gap-4"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${category.color} group-hover:scale-110 transition-transform flex-shrink-0`}>
                  <category.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1 text-lg">{category.title}</h3>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
