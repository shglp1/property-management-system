import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Globe } from 'lucide-react'

export default function Signup() {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle>{t('signup')}</CardTitle>
          <CardDescription>
            {isRTL
              ? 'تم تعطيل التسجيل العام. يرجى الاتصال بالمسؤول لإنشاء حساب.'
              : 'Public registration is disabled. Please contact an administrator to create an account.'}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Link to="/login" className="text-primary hover:underline">
            {isRTL ? 'العودة إلى تسجيل الدخول' : 'Back to login'}
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
