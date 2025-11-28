'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { 
  LayoutDashboard, FileText, Package, Users, Settings, 
  LogOut, Menu, X, ChevronRight, ShoppingCart, Truck, Factory, 
  ShoppingBag, BarChart3
} from 'lucide-react'

export default function DashboardLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [company, setCompany] = useState(null)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      router.push('/login')
      return
    }
    setUser(currentUser)

    const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', currentUser.id).single()
    if (profile) {
      const { data: comp } = await supabase.from('companies').select('name, logo_url').eq('id', profile.company_id).single()
      setCompany(comp)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navigation = [
    { name: 'Genel Bakış', href: '/', icon: LayoutDashboard },
    { name: 'Teklifler', href: '/quotes', icon: FileText },
    { name: 'Satışlar', href: '/sales', icon: ShoppingCart }, // YENİ
    { name: 'Satınalma', href: '/purchases', icon: Truck }, // YENİ
    { name: 'Ürünler & Stok', href: '/products', icon: Package },
    { name: 'Müşteriler', href: '/customers', icon: Users },
    { name: 'Tedarikçiler', href: '/suppliers', icon: Factory }, // YENİ
    { name: 'Katalog Ayarları', href: '/settings/catalog', icon: ShoppingBag },
    { name: 'Ayarlar', href: '/settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      
      {/* --- MOBİL MENÜ BACKDROP (Sidebar açıkken arkası kararır) --- */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-800/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* --- SIDEBAR (Mobil ve Desktop Uyumlu) --- */}
      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:block
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          
          {/* Logo Alanı */}
          <div className="h-16 flex items-center px-6 border-b border-gray-100">
            {company?.logo_url ? (
               <img src={company.logo_url} alt="Logo" className="h-8 object-contain" />
            ) : (
               <div className="font-bold text-xl text-blue-600 tracking-tight">{company?.name || 'CRM'}</div>
            )}
            <button 
              className="ml-auto lg:hidden text-gray-500"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigasyon Linkleri */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)} // Mobilde tıklayınca menüyü kapat
                  className={`
                    flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                    ${isActive 
                      ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                  {item.name}
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto text-blue-400" />}
                </Link>
              )
            })}
          </nav>

          {/* Alt Kısım: Kullanıcı ve Çıkış */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200">
                {user?.email?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">Hesabım</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-100 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Çıkış Yap
            </button>
          </div>
        </div>
      </aside>

      {/* --- ANA İÇERİK ALANI --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Mobil Header (Hamburger Menü) */}
        <header className="lg:hidden bg-white border-b border-gray-200 h-16 flex items-center px-4 justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-bold text-gray-900">{company?.name}</span>
          </div>
          {/* Mobilde Sağ Üst Aksiyonlar eklenebilir */}
        </header>

        {/* Sayfa İçeriği */}
        <main className="flex-1 overflow-auto bg-gray-50/50">
          {children}
        </main>
      </div>
    </div>
  )
}
