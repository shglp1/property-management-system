import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Home,
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  FileText,
  FileArchive,
  Bell,
  Shield,
  Key,
  Menu,
  X,
  LogOut,
  Globe,
  Wallet,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export default function Layout({ children }) {
  const { t, i18n } = useTranslation()
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const isRTL = i18n.language === 'ar'

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar'
    i18n.changeLanguage(newLang)
    document.documentElement.lang = newLang
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr'
  }

  const navigation = [
    { name: t('home'), href: '/', icon: Home },
    { name: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('properties'), href: '/properties', icon: Building2 },
    { name: t('rentals'), href: '/rentals', icon: Key },
    { name: t('users'), href: '/users', icon: Users },
    { name: t('transactions'), href: '/transactions', icon: Receipt },
    { name: t('reports'), href: '/reports', icon: FileText },
    { name: t('invoices'), href: '/invoices', icon: FileArchive },
    { name: t('notifications'), href: '/notifications', icon: Bell },
    { name: t('adminPanel'), href: '/admin', icon: Shield },
    { name: t('custodySystem'), href: '/custody', icon: Wallet },
  ]

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 ${isRTL ? 'right-0' : 'left-0'} z-50 h-full w-64 transform bg-card border-${isRTL ? 'l' : 'r'} transition-transform duration-300 ease-in-out 
        ${sidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'}
        lg:translate-x-0`} 
      >
        <div className="flex h-full flex-col">

          <div className="flex h-16 items-center justify-between border-b px-6">
            <h1 className="text-xl font-bold">{t('home')}</h1>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          <div className="border-t p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{user?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={toggleLanguage}
              >
                <Globe className="h-4 w-4 mr-2" />
                {i18n.language === 'ar' ? 'English' : 'العربية'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t('logout')}
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <div
        className={`transition-all duration-300 ${isRTL ? 'lg:mr-64' : 'lg:ml-64'
          }`}
      >
        {/* العنوان */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">
              {navigation.find((item) => item.href === location.pathname)?.name ||
                t('home')}
            </h2>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
