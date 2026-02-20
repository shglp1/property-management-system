import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Globe } from 'lucide-react'

export default function Login() {
  const { t, i18n } = useTranslation()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isRTL = i18n.language === 'ar'

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar'
    i18n.changeLanguage(newLang)
    document.documentElement.lang = newLang
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)

      // Check status immediately
      const { data: userProps } = await supabase
        .from('app_users')
        .select('status')
        .eq('email', email)
        .maybeSingle()

      if (userProps && userProps.status === 'inactive') {
        await supabase.auth.signOut()
        throw new Error(isRTL ? 'حسابك غير نشط. يرجى الاتصال بالمسؤول.' : 'Your account is inactive. Please contact administrator.')
      }

      // After successful sign-in, navigate to the root path.
      // The PublicRoute/ProtectedRoute logic in App.jsx will handle the
      // role-based redirection to the correct dashboard (/ or /employee-dashboard).
      navigate('/')
    } catch (error) {
      setError(error.message || t('error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Language Toggle - Absolute Position */}
      <div className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'}`}>
        <Button variant="ghost" size="sm" onClick={toggleLanguage} className="bg-white/50 hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/40 backdrop-blur-sm">
          <Globe className="h-4 w-4 mr-2" />
          {i18n.language === 'ar' ? 'English' : 'العربية'}
        </Button>
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <Card className="shadow-2xl border-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg">
          <CardHeader className="space-y-2 text-center pb-2">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-primary/10 rounded-full ring-4 ring-primary/5">
                <Building2 className="h-10 w-10 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight">{t('login')}</CardTitle>
            <CardDescription className="text-base">
              {isRTL ? 'أدخل بريدك الإلكتروني وكلمة المرور للدخول' : 'Enter your email and password to login'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 pt-6">
              {error && (
                <div className="p-4 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30 flex items-center animate-pulse">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  className="h-11 bg-white dark:bg-gray-800"
                  placeholder={isRTL ? 'name@example.com' : 'name@example.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t('password')}</Label>
                  {/* Optional: Add Forgot Password link here in future */}
                </div>
                <Input
                  id="password"
                  type="password"
                  className="h-11 bg-white dark:bg-gray-800"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-2 pb-8">
              <Button type="submit" className="w-full h-11 text-base font-semibold shadow-lg hover:shadow-xl transition-all" disabled={loading}>
                {loading ? t('loading') : t('login')}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Footer Text */}
        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {isRTL ? 'نظام إدارة الممتلكات الآمن' : 'Secure Property Management System'}
        </p>
      </div>
    </div>
  )
}
