// src/pages/Home.jsx

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bell, DollarSign, Building2, Users } from 'lucide-react'
import { format } from 'date-fns'

export default function Home() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [stats, setStats] = useState({
    todayBalance: 0,
    totalProperties: 0,
    activeUsers: 0,
  })
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const currentLang = i18n.language || 'ar'

  // helpers لاختيار النص حسب اللغة
  const getTitle = (n) => {
    if (currentLang.startsWith('ar')) {
      return n.title_ar || n.title || ''
    }
    return n.title_en || n.title || ''
  }

  const getMessage = (n) => {
    if (currentLang.startsWith('ar')) {
      return n.message_ar || n.message || ''
    }
    return n.message_en || n.message || ''
  }

  useEffect(() => {
    Promise.all([fetchStats(), fetchNotifications()]).finally(() => {
      setLoading(false)
    })
  }, [])

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      // رصيد اليوم
      const { data: transactions } = await supabase
        .from('transactions')
        .select('type, amount, date')
        .gte('date', today)

      let balance = 0;
      transactions?.forEach((t) => {
        if (t.type === 'income' || t.type === 'salary_advance_repayment') {
          balance += Number(t.amount) || 0;
        } else if (t.type === 'expense' || t.type === 'salary_advance') {
          balance -= Number(t.amount) || 0;
        }
      });

      // عدد الممتلكات
      const { count: propertiesCount } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })

      // المستخدمون النشطون
      const { count: usersCount } = await supabase
        .from('app_users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      setStats({
        todayBalance: balance || 0,
        totalProperties: propertiesCount || 0,
        activeUsers: usersCount || 0,
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error

      setNotifications(data || [])
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setNotifications([])
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">{t('loading', 'جاري التحميل...')}</div>
      </div>
    )
  }

  const quickStats = [
    {
      title: t('todayBalance', 'رصيد اليوم'),
      value: `${Number(stats.todayBalance || 0).toFixed(2)}`,
      icon: DollarSign,
      color: stats.todayBalance >= 0 ? 'text-green-600' : 'text-red-600',
      bg: 'bg-muted',
    },
    {
      title: t('totalProperties', 'إجمالي الممتلكات'),
      value: stats.totalProperties,
      icon: Building2,
      color: 'text-blue-600',
      bg: 'bg-muted',
    },
    {
      title: t('activeUsers', 'المستخدمون النشطون'),
      value: stats.activeUsers,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-muted',
    },
  ]

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div>
        <h1 className="text-3xl font-bold">{t('home', 'الرئيسية')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('welcomeMessage', 'مرحبًا بك في نظام إدارة الممتلكات')}
        </p>
      </div>

      {/* الإحصاءات السريعة */}
      <div className="grid gap-4 md:grid-cols-3">
        {quickStats.map((stat, idx) => {
          const Icon = stat.icon
          return (
            <Card key={idx}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className={`text-2xl font-bold mt-2 ${stat.color}`}>{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bg}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* إجراءات سريعة */}
      <div className="grid gap-4 md:grid-cols-2">
        <Button onClick={() => navigate('/dashboard')} size="lg" className="h-20">
          <Building2 className="mr-2 h-5 w-5" />
          {t('goToDashboard', 'الذهاب للوحة القيادة')}
        </Button>
        <Button
          onClick={() => navigate('/properties')}
          size="lg"
          variant="outline"
          className="h-20"
        >
          <Building2 className="mr-2 h-5 w-5" />
          {t('manageProperties', 'إدارة الممتلكات')}
        </Button>
      </div>

      {/* الإشعارات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('notifications', 'الإشعارات')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                >
                  <Bell className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{getTitle(notif)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getMessage(notif)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notif.created_at
                        ? format(new Date(notif.created_at), 'dd MMM yyyy HH:mm')
                        : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {t('noNotifications', 'لا توجد إشعارات')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
