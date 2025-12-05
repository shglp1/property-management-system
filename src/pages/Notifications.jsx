import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function Notifications() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()

  const [notifications, setNotifications] = useState([])
  const [filteredNotifications, setFilteredNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const currentLang = i18n.language || 'ar'

  // ✅ helper: اختر العنوان حسب اللغة
  const getTitle = (n) => {
    if (currentLang.startsWith('ar')) {
      return n.title_ar || n.title || ''
    }
    return n.title_en || n.title || ''
  }

  // ✅ helper: اختر الرسالة حسب اللغة
  const getMessage = (n) => {
    if (currentLang.startsWith('ar')) {
      return n.message_ar || n.message || ''
    }
    return n.message_en || n.message || ''
  }

  // ✅ جلب الإشعارات + الاشتراك على التغييرات
  useEffect(() => {
    fetchNotifications()

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ✅ تحديث الفلترة كل ما القائمة أو الفلتر تغيروا
  useEffect(() => {
    filterNotifications()
  }, [notifications, filter])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterNotifications = () => {
    let filtered = [...notifications]

    if (filter === 'unread') {
      filtered = filtered.filter((n) => !n.read)
    } else if (filter === 'read') {
      filtered = filtered.filter((n) => n.read)
    }

    setFilteredNotifications(filtered)
  }

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)

      if (error) throw error
      fetchNotifications()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  // ✅ تعليم جميع الإشعارات كمقروءة (بدون user_id لأن الإشعارات عامة)
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false)

      if (error) throw error
      fetchNotifications()
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const deleteNotification = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchNotifications()
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const getUnreadCount = () => {
    return notifications.filter((n) => !n.read).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">{t('notifications')}</h1>
          {getUnreadCount() > 0 && (
            <span className="px-3 py-1 text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 rounded-full">
              {getUnreadCount()} {t('unread') || 'غير مقروءة'}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('filter') || 'تصفية'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all') || 'الكل'}</SelectItem>
              <SelectItem value="unread">{t('unread') || 'غير مقروءة'}</SelectItem>
              <SelectItem value="read">{t('read') || 'مقروءة'}</SelectItem>
            </SelectContent>
          </Select>
          {getUnreadCount() > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCheck className="mr-2 h-4 w-4" />
              {t('markAllAsRead') || 'تعليم الكل كمقروء'}
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.map((notification) => (
          <Card
            key={notification.id}
            className={`transition-all ${
              !notification.read
                ? 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                : ''
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div
                  className={`p-2 rounded-full ${
                    !notification.read
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  <Bell
                    className={`h-5 w-5 ${
                      !notification.read ? 'text-blue-600' : 'text-gray-600'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-lg">{getTitle(notification)}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getMessage(notification)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {notification.created_at
                      ? format(new Date(notification.created_at), 'dd MMM yyyy HH:mm')
                      : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!notification.read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markAsRead(notification.id)}
                      title={t('markAsRead') || 'تعليم كمقروء'}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteNotification(notification.id)}
                    title={t('delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredNotifications.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">
                {t('noNotifications') || 'لا توجد إشعارات'}
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                {t('noNotificationsMessage') || 'سيتم عرض الإشعارات هنا عند وصولها'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
