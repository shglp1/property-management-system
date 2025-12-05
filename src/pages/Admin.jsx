import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Shield,
  Users,
  Building2,
  Receipt,
  FileText,
  Bell,
  Activity,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { format, subDays } from 'date-fns'

export default function Admin() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()

  const isRTL = i18n.language === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalProperties: 0,
    totalTransactions: 0,
    totalIncome: 0,
    totalExpenses: 0,
    recentActivity: []
  })
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState([])
  const [userRoleData, setUserRoleData] = useState([])

  useEffect(() => {
    if (user) {
      fetchAdminStats()
    }
  }, [user])

  const fetchAdminStats = async () => {
    setLoading(true)
    try {
      // Fetch users
      const { data: users, error: usersError } = await supabase
        .from('app_users')
        .select('*')

      if (usersError) throw usersError

      // Fetch properties
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('*')

      if (propertiesError) throw propertiesError

      // Fetch transactions
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })

      if (transactionsError) throw transactionsError

      // Calculate stats
      const totalIncome =
        transactions
          ?.filter((t) => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0) || 0

      const totalExpenses =
        transactions
          ?.filter((t) => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0) || 0

      setStats({
        totalUsers: users?.length || 0,
        activeUsers: users?.filter((u) => u.status === 'active').length || 0,
        totalProperties: properties?.length || 0,
        totalTransactions: transactions?.length || 0,
        totalIncome,
        totalExpenses,
        recentActivity: transactions?.slice(0, 10) || []
      })

      // Prepare chart data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i)
        const dateStr = format(date, 'yyyy-MM-dd')
        const dayTransactions =
          transactions?.filter(
            (t) => format(new Date(t.date), 'yyyy-MM-dd') === dateStr
          ) || []

        return {
          date: format(date, 'dd MMM'),
          income: dayTransactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0),
          expenses: dayTransactions
            .filter((t) => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0)
        }
      })

      setChartData(last7Days)

      // User role distribution
      const adminCount =
        users?.filter((u) => u.role === 'admin').length || 0
      const employeeCount =
        users?.filter((u) => u.role === 'employee').length || 0

      setUserRoleData([
        { name: t('admin'), value: adminCount, color: '#8b5cf6' },
        { name: t('employee'), value: employeeCount, color: '#3b82f6' }
      ])
    } catch (error) {
      console.error('Error fetching admin stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // Check if user is admin
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) return

      const { data, error } = await supabase
        .from('app_users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error checking user role:', error)
        return
      }

      setUserRole(data?.role)
    }

    checkUserRole()
  }, [user])

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (userRole && userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-red-500" />
              <h3 className="mt-4 text-lg font-medium">
                {t('accessDenied') || 'تم رفض الوصول'}
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                {t('adminOnly') || 'هذه الصفحة متاحة للمسؤولين فقط'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div
      className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}
      dir={dir}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="h-8 w-8 text-purple-600" />
        <h1 className="text-3xl font-bold">
          {t('adminPanel') || 'لوحة تحكم المسؤولين'}
        </h1>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalUsers')}
            </CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeUsers} {t('active')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalProperties')}
            </CardTitle>
            <Building2 className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalProperties}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalIncome')}
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.totalIncome.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalExpenses')}
            </CardTitle>
            <TrendingDown className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.totalExpenses.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {t('incomeVsExpenses') || 'الدخل مقابل المصروفات'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="#10b981"
                  name={t('income')}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ef4444"
                  name={t('expense')}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t('userRoleDistribution') || 'توزيع أدوار المستخدمين'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={userRoleData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {userRoleData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t('recentActivity') || 'النشاط الأخير'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className={isRTL ? 'text-right' : 'text-left'}
                >
                  {t('date')}
                </TableHead>
                <TableHead
                  className={isRTL ? 'text-right' : 'text-left'}
                >
                  {t('transactionType')}
                </TableHead>
                <TableHead className="text-right">
                  {t('amount')}
                </TableHead>
                <TableHead
                  className={isRTL ? 'text-right' : 'text-left'}
                >
                  {t('description')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recentActivity.map((activity) => (
                <TableRow
                  key={activity.id}
                  className={isRTL ? 'text-right' : 'text-left'}
                >
                  <TableCell>
                    {format(
                      new Date(activity.date),
                      'dd MMM yyyy'
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${activity.type === 'income'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                    >
                      {t(activity.type)}
                    </span>
                  </TableCell>
                  <TableCell
                    className={`font-bold text-right ${activity.type === 'income'
                        ? 'text-green-600'
                        : 'text-red-600'
                      }`}
                  >
                    {activity.type === 'income' ? '+' : '-'}
                    {activity.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {activity.description}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t('systemHealth') || 'صحة النظام'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t('databaseConnection') || 'اتصال قاعدة البيانات'}
              </span>
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded-full">
                {t('connected') || 'متصل'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t('storageStatus') || 'حالة التخزين'}
              </span>
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded-full">
                {t('operational') || 'يعمل'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t('realtimeSync') || 'المزامنة في الوقت الفعلي'}
              </span>
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded-full">
                {t('active')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
