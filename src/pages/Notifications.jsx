import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Bell, Check, CheckCheck, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfDay, endOfDay } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [dateRange, setDateRange] = useState({
    from: undefined,
    to: undefined,
  })

  // Pagination State
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const ITEMS_PER_PAGE = 20

  const currentLang = i18n.language || 'ar'
  const isRTL = currentLang.startsWith('ar')

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
          // If we are on page 1, refresh. Otherwise, maybe show a toast?
          // For simplicity, just refresh.
          fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [page, filter, dateRange]) // Re-fetch when page or filters change

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      // Apply Filter
      if (filter === 'unread') {
        query = query.eq('read', false)
      } else if (filter === 'read') {
        query = query.eq('read', true)
      }

      // Apply Date Range
      if (dateRange?.from) {
        query = query.gte('created_at', startOfDay(dateRange.from).toISOString())
      }
      if (dateRange?.to) {
        query = query.lte('created_at', endOfDay(dateRange.to).toISOString())
      }

      // Apply Pagination
      const from = (page - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error

      setNotifications(data || [])
      setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))

    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)

      if (error) throw error

      // Update local state to reflect change immediately
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))

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
    // This is only for the visible page in this implementation. 
    // Ideally, we'd have a separate count query or global context for the badge.
    // For now, let's just count visible.
    return notifications.filter((n) => !n.read).length
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  return (
    <div className="space-y-6 container mx-auto p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">{t('notifications')}</h1>
          {/* Note: Unread count here is only accurate for current view if we don't query global count */}
        </div>

        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          {/* Date Range Picker */}
          <div className={cn("grid gap-2", isRTL ? "text-right" : "text-left")}>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-full md:w-[300px] justify-start text-left font-normal",
                    !dateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y", { locale: isRTL ? ar : enUS })} -{" "}
                        {format(dateRange.to, "LLL dd, y", { locale: isRTL ? ar : enUS })}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y", { locale: isRTL ? ar : enUS })
                    )
                  ) : (
                    <span>{t('filterByDate') || 'تصفية حسب التاريخ'}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={isRTL ? ar : enUS}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Select value={filter} onValueChange={(val) => { setFilter(val); setPage(1); }}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder={t('filter') || 'تصفية'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all') || 'الكل'}</SelectItem>
              <SelectItem value="unread">{t('unread') || 'غير مقروءة'}</SelectItem>
              <SelectItem value="read">{t('read') || 'مقروءة'}</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={markAllAsRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            {t('markAllAsRead') || 'تعليم الكل كمقروء'}
          </Button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`transition-all ${!notification.read
                  ? 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                  : ''
                }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2 rounded-full ${!notification.read
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'bg-gray-100 dark:bg-gray-800'
                      }`}
                  >
                    <Bell
                      className={`h-5 w-5 ${!notification.read ? 'text-blue-600' : 'text-gray-600'
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
                        ? format(new Date(notification.created_at), 'dd MMM yyyy HH:mm', { locale: isRTL ? ar : enUS })
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
          ))
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">
                  {t('noNotifications') || 'لا توجد إشعارات'}
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('noNotificationsMessage') || 'لا توجد إشعارات تطابق معايير البحث'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
          >
            <ChevronRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
            {isRTL ? 'السابق' : 'Previous'}
          </Button>
          <span className="text-sm font-medium">
            {t('page') || 'صفحة'} {page} {t('of') || 'من'} {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
          >
            {isRTL ? 'التالي' : 'Next'}
            <ChevronLeft className={cn("h-4 w-4", isRTL && "rotate-180")} />
          </Button>
        </div>
      )}
    </div>
  )
}
