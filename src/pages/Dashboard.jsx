// ... imports ...
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, LabelList } from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Building2, Download, Calendar, Filter, BarChart3, PieChart as PieChartIcon, Activity, Eye, RefreshCw, AlertTriangle, CheckCircle, Clock, FileSpreadsheet, File, Calendar as CalendarIcon, X } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isBefore, isAfter, differenceInDays, subDays } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'



// استيراد مكتبة xlsx (يجب تثبيتها: npm install xlsx)
import * as XLSX from 'xlsx'

// Helper function to format currency
const formatCurrency = (amount, currency = "SAR") => {
  const numericAmount = Number(amount) || 0;
  const currencyCode = currency || "SAR";
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(numericAmount);
};

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'
  const [kpis, setKpis] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
    activeProperties: 0,
    incomeChange: 0,
    expensesChange: 0,
    // --- إضافة KPIs جديدة للعهدة ---
    totalCustodyGiven: 0,
    totalCustodyExpenses: 0,
    totalCustodyRemaining: 0,
    totalAdvances: 0,
    totalRepayments: 0,
    outstandingAdvances: 0,
  })


  const [recentTransactions, setRecentTransactions] = useState([])
  const [chartData, setChartData] = useState({
    trend: [],
    byProperty: [],
    byCategory: [],
  })
  const [dateRange, setDateRange] = useState('thisMonth')
  const [properties, setProperties] = useState([])
  const [selectedProperty, setSelectedProperty] = useState('all')
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // --- Pagination states ---
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 5;
  const totalPages = Math.ceil(recentTransactions.length / transactionsPerPage);
  const indexOfLast = currentPage * transactionsPerPage;
  const indexOfFirst = indexOfLast - transactionsPerPage;
  const currentTransactions = recentTransactions.slice(indexOfFirst, indexOfLast);


  // خيارات التاريخ المخصصة
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomDateRange, setShowCustomDateRange] = useState(false)

  // خيارات التصدير
  const [showExportOptions, setShowExportOptions] = useState(false)
  const [exportFormat, setExportFormat] = useState('excel')

  useEffect(() => {
    fetchProperties()
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [dateRange, selectedProperty, customStartDate, customEndDate])

  const getDateRange = () => {
    const now = new Date()
    switch (dateRange) {
      case 'thisMonth':
        return { start: startOfMonth(now), end: endOfMonth(now) }
      case 'lastMonth':
        const lastMonth = subMonths(now, 1)
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
      case 'last3Months':
        return { start: subMonths(now, 3), end: now }
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: new Date(customStartDate),
            end: new Date(customEndDate)
          }
        }
        return { start: startOfMonth(now), end: endOfMonth(now) }
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) }
    }
  }

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name')
        .order('name')

      if (error) throw error
      setProperties(data || [])
    } catch (error) {
      console.error('Error fetching properties:', error)
      setError('Error fetching properties')
    }
  }

  const fetchDashboardData = async () => {
    setIsRefreshing(true)
    setLoading(true)
    try {
      const { start, end } = getDateRange()


      // التحقق من صحة التاريخ
      if (isBefore(end, start)) {
        throw new Error('End date cannot be before start date')
      }

      let transactionsQuery = supabase
        .from('transactions')
        .select('*, properties(name), source_type') // --- إضافة source_type ---
        .gte('date', start.toISOString())
        .lte('date', end.toISOString())
        .order('date', { ascending: false })

      if (selectedProperty !== 'all') {
        transactionsQuery = transactionsQuery.eq('property_id', selectedProperty)
      }

      const { data: transactions, error: transactionsError } = await transactionsQuery

      if (transactionsError) throw transactionsError

      // Calculate previous date range for period-over-period comparison
      let prevStart, prevEnd;
      if (dateRange === 'thisMonth' || dateRange === 'lastMonth') {
        const lm = subMonths(start, 1);
        prevStart = startOfMonth(lm);
        prevEnd = endOfMonth(lm);
      } else if (dateRange === 'last3Months') {
        prevStart = subMonths(start, 3);
        prevEnd = subDays(start, 1);
      } else if (dateRange === 'custom') {
        const diffDays = differenceInDays(end, start);
        prevStart = subDays(start, diffDays + 1);
        prevEnd = subDays(start, 1);
      } else {
        const lm = subMonths(start, 1);
        prevStart = startOfMonth(lm);
        prevEnd = endOfMonth(lm);
      }

      let prevTransactionsQuery = supabase
        .from('transactions')
        .select('type, amount')
        .gte('date', prevStart.toISOString())
        .lte('date', prevEnd.toISOString());

      if (selectedProperty !== 'all') {
        prevTransactionsQuery = prevTransactionsQuery.eq('property_id', selectedProperty);
      }

      const { data: prevTransactions, error: prevError } = await prevTransactionsQuery;
      let prevTotalIncome = 0;
      let prevTotalExpenses = 0;

      if (!prevError && prevTransactions) {
        prevTransactions.forEach(t => {
          const amt = Math.abs(Number(t.amount) || 0);
          if (t.type === 'income') prevTotalIncome += amt;
          else if (t.type === 'expense') prevTotalExpenses += amt;
        });
      }

      const calculateChange = (current, previous) => {
        if (!previous || previous === 0) {
          if (!current || current === 0) return 0;
          return null; // Indicates insufficient data
        }
        return ((current - previous) / previous) * 100;
      };

      // Calculate KPIs
      // --- KPI جديد ---
      let totalIncome = 0;
      let totalExpenses = 0;
      let totalCustodyExpenses = 0;
      let totalAdvances = 0;
      let totalRepayments = 0;

      //  احسب الدخل والمصروفات بشكل صحيح حسب المطلوب
      // احسب الدخل والمصروفات بحيث تشمل كل المصروفات (العهدة + الممتلكات)
      transactions?.forEach((t) => {
        const amount = Math.abs(Number(t.amount) || 0);

        // إجمالي الدخل فقط من الممتلكات
        if (t.type === 'income') {
          totalIncome += amount;
        } else if (t.type === 'expense') {
          totalExpenses += amount;
          // Capture strict custody expenses filtered by active time range and active property
          if (t.source_type === 'custody') {
            totalCustodyExpenses += amount;
          }
        } else if (t.type === 'salary_advance') {
          totalAdvances += amount;
        } else if (t.type === 'salary_advance_repayment') {
          totalRepayments += amount;
        }
      });



      // --- جلب معلومات العهدة ---
      let custodySummary = { totalGiven: 0, totalExpenses: 0, totalRemaining: 0 };

      try {
        //  جلب معلومات العهدة مباشرة من جدول custody_system
        const { data: custodyData, error: custodyError } = await supabase
          .from('custody_system')
          .select('custody_amount, total_expenses, remaining_balance');

        if (custodyError) throw custodyError;

        if (custodyData?.length) {
          custodyData.forEach((item) => {
            custodySummary.totalGiven += Number(item.custody_amount) || 0;
            custodySummary.totalExpenses += Number(item.total_expenses) || 0;
            custodySummary.totalRemaining += Number(item.remaining_balance) || 0;
          });
        }




      } catch (error) {
        console.error('Error fetching custody summary:', error);
      }


      // Fetch active properties (consider filtering by selectedProperty if needed)
      let propertiesCountQuery = supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'rented')

      if (selectedProperty !== 'all') {
        propertiesCountQuery = propertiesCountQuery.eq('id', selectedProperty)
      }

      const { count: propertiesCount, error: propertiesCountError } = await propertiesCountQuery

      if (propertiesCountError) throw propertiesCountError

      // Calculate trend data
      // 

      // Calculate trend data
      const trendMap = {}
      transactions?.forEach((tx) => {
        const month = format(new Date(tx.date), 'MMM yyyy')
        if (!trendMap[month]) {
          trendMap[month] = { month, income: 0, expenses: 0 }
        }
        if (tx.type === 'income') trendMap[month].income += tx.amount
        else trendMap[month].expenses += tx.amount
      })

      // Calculate income by property
      const propertyMap = {}
      transactions?.forEach((tx) => {
        if (tx.type === 'income' && tx.properties) {
          const propName = tx.properties.name
          propertyMap[propName] = (propertyMap[propName] || 0) + tx.amount
        }
        // --- حساب المصروفات حسب الملكية ---
        if (tx.type === 'expense' && tx.properties) {
          const propName =
            tx.source_type === 'custody'
              ? `${t('custody')} - ${tx.properties.name}`
              : tx.properties.name
          propertyMap[propName] =
            (propertyMap[propName] || 0) + Math.abs(tx.amount) // تأكد من أن المبلغ موجب
        }
      })

      // Calculate true system-level expense mapping without arbitrary categories
      const operationalText = isRTL ? 'مصروفات تشغيلية' : 'Operational Expenses';
      const custodyText = isRTL ? 'مصروفات العهد' : 'Custody Expenses';
      const advancesText = isRTL ? 'سلف الموظفين' : 'Employee Advances';

      let computedTotalAdvances = totalAdvances || 0;

      const byCategory = [
        { name: operationalText, value: totalExpenses },
        { name: custodyText, value: totalCustodyExpenses },
        { name: advancesText, value: computedTotalAdvances }
      ].filter(item => item.value > 0);


      setKpis({
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses,
        activeProperties: propertiesCount || 0,
        incomeChange: calculateChange(totalIncome, prevTotalIncome),
        expensesChange: calculateChange(totalExpenses, prevTotalExpenses),
        prevTotalIncome: prevTotalIncome || 0,
        prevTotalExpenses: prevTotalExpenses || 0,
        // --- KPIs ---
        totalCustodyGiven: custodySummary.totalGiven,
        totalCustodyExpenses: totalCustodyExpenses, // Computed dynamically from filtered transactions
        totalCustodyRemaining: custodySummary.totalRemaining,
        totalAdvances,
        totalRepayments,
        outstandingAdvances: totalAdvances - totalRepayments,
      })


      // Format recent transactions with property names
      const transactionsWithFormattedProperty = transactions?.map(tx => ({
        ...tx,
        formattedProperty:
          tx.source_type === 'custody'
            ? `${t(' صرف عهدة')} - ${tx.properties?.name || t('unknownProperty')}`
            : (tx.properties?.name || t('unknownProperty')),
      })) || [];

      setRecentTransactions(transactionsWithFormattedProperty)

      setChartData({
        trend: Object.values(trendMap),
        byProperty: Object.entries(propertyMap).map(([name, value]) => ({ name, value })),
        byCategory,
      })

      setError(null)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setError('Error fetching dashboard data')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  const exportToExcel = () => {
    //prepare data for export 
    const excelData = recentTransactions.map((tx) => ({
      [t('propertyName')]: tx.formattedProperty, // --- استخدام الاسم المنسق ---
      [t('description')]: tx.description,
      [t('amount')]: Number(tx.amount),
      [t('date')]: format(new Date(tx.date), 'dd/MM/yyyy'),
      [t('transactionType')]: t(tx.type),
      [t('sourceType')]:
        tx.source_type === 'custody'
          ? 'العهدة'
          : tx.source_type === 'property'
            ? 'الممتلكات'
            : 'غير محدد',
    }))


    // إنشاء ورقة عمل
    const worksheet = XLSX.utils.json_to_sheet(excelData)

    // ضبط عرض الأعمدة
    const columnWidths = [
      { wch: 20 }, // Property Name
      { wch: 40 }, // Description
      { wch: 15 }, // Amount
      { wch: 15 }, // Date
      { wch: 15 }, // Transaction Type
      { wch: 15 }, // Source Type
    ]
    worksheet['!cols'] = columnWidths

    // إنشاء مصنف
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report')

    // إضافة ورقة ملخص
    const summaryData = [
      { [t('metric')]: t('totalIncome'), [t('value')]: kpis.totalIncome.toFixed(2) },
      { [t('metric')]: t('totalExpenses'), [t('value')]: kpis.totalExpenses.toFixed(2) },
      { [t('metric')]: t('totalAdvances'), [t('value')]: kpis.totalAdvances.toFixed(2) },
      { [t('metric')]: t('totalRepayments'), [t('value')]: kpis.totalRepayments.toFixed(2) },
      { [t('metric')]: t('outstandingAdvances'), [t('value')]: kpis.outstandingAdvances.toFixed(2) },
      { [t('metric')]: t('netBalance'), [t('value')]: kpis.netBalance.toFixed(2) },
      { [t('metric')]: t('totalCustodyGiven'), [t('value')]: kpis.totalCustodyGiven.toFixed(2) }, // --- إضافة إلى الملخص ---
      { [t('metric')]: t('totalCustodyExpenses'), [t('value')]: kpis.totalCustodyExpenses.toFixed(2) }, // --- إضافة إلى الملخص ---
      { [t('metric')]: t('totalCustodyRemaining'), [t('value')]: kpis.totalCustodyRemaining.toFixed(2) }, // --- إضافة إلى الملخص ---
      { [t('metric')]: t('transactionCount') || 'عدد المعاملات', [t('value')]: recentTransactions.length },
    ]
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary')

    // إضافة تنسيق للخلايا (لتحسين عرض اللغة العربية)
    const range = XLSX.utils.decode_range(worksheet['!ref'])
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_ref = XLSX.utils.encode_cell({ r: R, c: C })
        if (!worksheet[cell_ref]) continue

        // تعيين اتجاه النص (RTL للعربية)
        if (isRTL) {
          worksheet[cell_ref].z = '@' // نص
          if (!worksheet[cell_ref].s) worksheet[cell_ref].s = {}
          worksheet[cell_ref].s.align = { horizontal: 'right' }
        }
      }
    }

    // توليد اسم الملف
    const fileName = `report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`

    // التنزيل
    XLSX.writeFile(workbook, fileName)
  }

  const exportToPDF = async () => {
    // الحصول على نطاق التاريخ
    const { start, end } = getDateRange()
    const startDateStr = format(start, 'yyyy-MM-dd')
    const endDateStr = format(end, 'yyyy-MM-dd')

    // إنشاء محتوى HTML للـ PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <title>${t('financialReport') || 'التقرير المالي'}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            direction: ${isRTL ? 'rtl' : 'ltr'};
            padding: 20px;
            background-color: #f9fafb;
          }
          h1 {
            text-align: center;
            color: #333;
            margin-bottom: 10px;
          }
          .header-info {
            text-align: center;
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
          }
          .summary {
            display: flex;
            justify-content: space-around;
            margin: 30px 0;
            gap: 20px;
          }
          .summary-item {
            text-align: center;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 8px;
            flex: 1;
            background-color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .summary-item h3 {
            margin: 0;
            color: #666;
            font-size: 14px;
          }
          .summary-item p {
            margin: 10px 0 0 0;
            font-size: 24px;
            font-weight: bold;
          }
          .income { color: #10b981; }
          .expense { color: #ef4444; }
          .balance { color: #3b82f6; }
          .custody { color: #f59e0b; } /* لون جديد للعهدة */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 30px;
            background-color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: ${isRTL ? 'right' : 'left'};
            vertical-align: top;
          }
          th {
            background-color: #f3f4f6;
            font-weight: bold;
            font-size: 14px;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #666;
            font-size: 12px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
          }
          .page-break {
            page-break-after: always;
          }
        </style>
      </head>
      <body>
        <h1>${t('financialReport') || 'التقرير المالي'}</h1>
        <div class="header-info">
          <p>${t('from') || 'من'} ${format(start, 'dd/MM/yyyy')}
          ${t('to') || 'إلى'} ${format(end, 'dd/MM/yyyy')}</p>
          <p>${t('reportType')}: ${t('allTypes') || 'جميع أنواع المعاملات'}</p>
        </div>

        <div class="summary">
          <div class="summary-item">
            <h3>${t('totalIncome')}</h3>
            <p class="income">${Number(kpis.totalIncome.toFixed(2))} ر.س</p>
          </div>
          <div class="summary-item">
            <h3>${t('totalExpenses')}</h3>
            <p class="expense">${Number(kpis.totalExpenses.toFixed(2))} ر.س</p>
          </div>
          <div class="summary-item">
            <h3>${t('netBalance')}</h3>
            <p class="balance">${Number(kpis.netBalance.toFixed(2))} ر.س</p>
          </div>
        </div>

        <div class="summary">
          <!-- --- إضافة ملخص العهدة --- -->
          <div class="summary-item">
            <h3>${t('totalCustodyGiven')}</h3>
            <p class="custody">${Number(kpis.totalCustodyGiven.toFixed(2))} ر.س</p>
          </div>
          <div class="summary-item">
            <h3>${t('totalCustodyExpenses')}</h3>
            <p class="custody">${Number(kpis.totalCustodyExpenses.toFixed(2))} ر.س</p>
          </div>
          <div class="summary-item">
            <h3>${t('totalCustodyRemaining')}</h3>
            <p class="custody">${Number(kpis.totalCustodyRemaining.toFixed(2))} ر.س</p>
          </div>
        </div>

        <div class="summary">
          <!-- --- إضافة ملخص السلف --- -->
          <div class="summary-item">
            <h3>${t('totalAdvances')}</h3>
            <p class="expense" style="color: #4f46e5;">${Number(kpis.totalAdvances.toFixed(2))} ر.س</p>
          </div>
          <div class="summary-item">
            <h3>${t('totalRepayments')}</h3>
            <p class="income" style="color: #0d9488;">${Number(kpis.totalRepayments.toFixed(2))} ر.س</p>
          </div>
          <div class="summary-item">
            <h3>${t('outstandingAdvances')}</h3>
            <p class="expense" style="color: #e11d48;">${Number(kpis.outstandingAdvances.toFixed(2))} ر.س</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${t('propertyName')}</th>
              <th>${t('description')}</th>
              <th>${t('amount')}</th>
              <th>${t('date')}</th>
              <th>${t('transactionType')}</th>
              <th>${t('sourceType')}</th> <!-- --- إضافة عمود النوع --- -->
            </tr>
          </thead>
          <tbody>
            ${recentTransactions
        .map(
          (tx) => `
              <tr>
                <td>${tx.formattedProperty}</td> <!-- --- استخدام الاسم المنسق --- -->
                <td>${tx.description}</td>
                <td class="${tx.type === 'income' || tx.type === 'salary_advance_repayment' ? 'income' : 'expense'}">${Number(tx.amount).toFixed(2)} ر.س</td>
                <td>${format(new Date(tx.date), 'dd/MM/yyyy')}</td>
                <td>${t(tx.type)}</td>
                <td>
                  ${tx.source_type === 'custody'
              ? 'العهدة'
              : tx.source_type === 'property'
                ? 'الممتلكات'
                : 'غير محدد'
            }
                </td>
                              </tr>
                            `
        )
        .join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>${t('generatedOn') || 'تم الإنشاء في'}: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
          <p>${t('propertyManagementSystem') || 'نظام إدارة الممتلكات'}</p>
        </div>
      </body>
      </html>
    `

    // create PDF
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report_${startDateStr}-to-${endDateStr}.html`
    a.click()
  }

  const refreshData = () => {
    fetchDashboardData()
  }

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  const getChangeColor = (change) => {
    return change >= 0 ? 'text-green-600' : 'text-red-600'
  }

  const getChangeIcon = (change) => {
    return change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />
  }

  const getKpiCardColor = (kpi) => {
    switch (kpi) {
      case 'totalIncome': return 'border-l-4 border-green-500'
      case 'totalExpenses': return 'border-l-4 border-red-500'
      case 'netBalance': return 'border-l-4 border-blue-500'
      case 'activeProperties': return 'border-l-4 border-purple-500'
      // --- ألوان جديدة للعهدة ---
      case 'totalCustodyGiven': return 'border-l-4 border-yellow-500'
      case 'totalCustodyExpenses': return 'border-l-4 border-orange-500'
      case 'totalCustodyRemaining': return 'border-l-4 border-amber-500'
      case 'totalAdvances': return 'border-l-4 border-indigo-500'
      case 'totalRepayments': return 'border-l-4 border-teal-500'
      case 'outstandingAdvances': return 'border-l-4 border-rose-500'
      default: return 'border-l-4 border-gray-500'
    }
  }

  // تحقق من صحة التاريخ المخصص
  const validateDates = () => {
    if (!customStartDate || !customEndDate) return false;
    const start = new Date(customStartDate);
    const end = new Date(customEndDate);
    return !isBefore(end, start) && !isAfter(start, new Date());
  }

  if (loading && !error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg flex items-center">
          <RefreshCw className="animate-spin mr-2 h-5 w-5" />
          {t('loading')}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Alert className="max-w-md">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>{t('error')}</AlertTitle>
          <AlertDescription>
            {t('errorLoadingData')}
          </AlertDescription>
        </Alert>
        <Button className="mt-4" onClick={refreshData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('retry')}
        </Button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header with controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8 text-blue-600" />
            {t('dashboard')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('dashboardDescription')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={refreshData}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                {t('refreshing')}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('refresh')}
              </>
            )}
          </Button>

          <div className="relative">
            <Button
              onClick={() => setShowExportOptions(!showExportOptions)}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              {t('export')}
            </Button>

            {showExportOptions && (
              <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-48 bg-popover border rounded-md shadow-lg z-10 p-2`}>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setExportFormat('excel');
                    exportToExcel();
                    setShowExportOptions(false);
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  {t('exportExcel')}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setExportFormat('pdf');
                    exportToPDF();
                    setShowExportOptions(false);
                  }}
                >
                  <File className="h-4 w-4 mr-2" />
                  {t('exportPDF')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-card rounded-lg shadow-sm">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thisMonth">{t('thisMonth') || 'هذا الشهر'}</SelectItem>
                <SelectItem value="lastMonth">{t('lastMonth') || 'الشهر الماضي'}</SelectItem>
                <SelectItem value="last3Months">{t('last3Months') || 'آخر 3 أشهر'}</SelectItem>
                <SelectItem value="custom">{t('customDateRange') || 'نطاق تاريخ مخصص'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateRange === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 p-2 px-3 rounded-md border shadow-sm mt-2 md:mt-0">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  {t('startDate') || 'من'}
                </Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-[140px] h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  {t('endDate') || 'إلى'}
                </Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-[140px] h-9"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('selectProperty') || 'اختر عقار'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allProperties') || 'جميع العقارات'}</SelectItem>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{t('lastUpdated')}: {format(new Date(), 'dd MMM yyyy HH:mm')}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className={`${getKpiCardColor('totalIncome')} hover:shadow-lg transition-all duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('totalIncome')}
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalIncome.toFixed(2)} <span className="text-sm text-muted-foreground">ر.س</span></div>
              <div className="flex items-center mt-1">
                {(kpis.incomeChange === null || kpis.incomeChange === undefined || isNaN(kpis.incomeChange)) ? (
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{isRTL ? 'لا توجد بيانات مقارنة كافية' : 'Insufficient comparison data'}</span>
                ) : (
                  <div
                    title={`${isRTL ? 'الحالي' : 'Current'}: ${kpis.totalIncome.toFixed(2)}\n${isRTL ? 'السابق' : 'Previous'}: ${kpis.prevTotalIncome.toFixed(2)}\nFormula: ((${kpis.totalIncome.toFixed(2)} - ${kpis.prevTotalIncome.toFixed(2)}) / ${kpis.prevTotalIncome.toFixed(2)}) * 100`}
                    className="flex items-center cursor-help"
                  >
                    {getChangeIcon(kpis.incomeChange)}
                    <span className={`text-xs font-bold ml-1 rtl:ml-0 rtl:mr-1 ${getChangeColor(kpis.incomeChange)}`}>
                      {kpis.incomeChange > 0 ? '+' : ''}{Number(kpis.incomeChange).toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground ml-1 rtl:ml-0 rtl:mr-1">{t('vsLastPeriod') || 'عن الفترة السابقة'}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className={`${getKpiCardColor('totalExpenses')} hover:shadow-lg transition-all duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('totalExpenses')}
              </CardTitle>
              <TrendingDown className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalExpenses.toFixed(2)} <span className="text-sm text-muted-foreground">ر.س</span></div>
              <div className="flex items-center mt-1">
                {(kpis.expensesChange === null || kpis.expensesChange === undefined || isNaN(kpis.expensesChange)) ? (
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{isRTL ? 'لا توجد بيانات مقارنة كافية' : 'Insufficient comparison data'}</span>
                ) : (
                  <div
                    title={`${isRTL ? 'الحالي' : 'Current'}: ${kpis.totalExpenses.toFixed(2)}\n${isRTL ? 'السابق' : 'Previous'}: ${kpis.prevTotalExpenses.toFixed(2)}\nFormula: ((${kpis.totalExpenses.toFixed(2)} - ${kpis.prevTotalExpenses.toFixed(2)}) / ${kpis.prevTotalExpenses.toFixed(2)}) * 100`}
                    className="flex items-center cursor-help"
                  >
                    {getChangeIcon(kpis.expensesChange)}
                    <span className={`text-xs font-bold ml-1 rtl:ml-0 rtl:mr-1 ${getChangeColor(kpis.expensesChange)}`}>
                      {kpis.expensesChange > 0 ? '+' : ''}{kpis.expensesChange.toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground ml-1 rtl:ml-0 rtl:mr-1">{t('vsLastPeriod') || 'عن الفترة السابقة'}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className={`${getKpiCardColor('netBalance')} hover:shadow-lg transition-all duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('netBalance')}
              </CardTitle>
              <DollarSign className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.netBalance.toFixed(2)} <span className="text-sm text-muted-foreground">ر.س</span></div>
              <div className="flex items-center mt-1">
                {kpis.netBalance >= 0 ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-xs ml-1 ${kpis.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpis.netBalance >= 0 ? t('profit') : t('loss')}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className={`${getKpiCardColor('activeProperties')} hover:shadow-lg transition-all duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('activeProperties')}
              </CardTitle>
              <Building2 className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.activeProperties}</div>
              <div className="flex items-center mt-1">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground ml-1">{t('rentedProperties')}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* --- إضافة KPIs جديدة للعهدة --- */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className={`${getKpiCardColor('totalCustodyGiven')} hover:shadow-lg transition-all duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('totalCustodyGiven')}
              </CardTitle>
              <DollarSign className="h-5 w-5 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalCustodyGiven.toFixed(2)} <span className="text-sm text-muted-foreground">ر.س</span></div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className={`${getKpiCardColor('totalCustodyExpenses')} hover:shadow-lg transition-all duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('totalCustodyExpenses')}
              </CardTitle>
              <TrendingDown className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalCustodyExpenses.toFixed(2)} <span className="text-sm text-muted-foreground">ر.س</span></div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className={`${getKpiCardColor('totalCustodyRemaining')} hover:shadow-lg transition-all duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('remainingBalance')} {/* استخدام نفس الترجمة */}
              </CardTitle>
              <DollarSign className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalCustodyRemaining.toFixed(2)} <span className="text-sm text-muted-foreground">ر.س</span></div>
            </CardContent>
          </Card>
        </motion.div>

        {/* --- إضافة KPIs للسلف --- */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className={`${getKpiCardColor('totalAdvances')} hover:shadow-lg transition-all duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('totalAdvances')}
              </CardTitle>
              <DollarSign className="h-5 w-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalAdvances.toFixed(2)} <span className="text-sm text-muted-foreground">ر.س</span></div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className={`${getKpiCardColor('totalRepayments')} hover:shadow-lg transition-all duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('totalRepayments')}
              </CardTitle>
              <DollarSign className="h-5 w-5 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalRepayments.toFixed(2)} <span className="text-sm text-muted-foreground">ر.س</span></div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className={`${getKpiCardColor('outstandingAdvances')} hover:shadow-lg transition-all duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('outstandingAdvances')}
              </CardTitle>
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.outstandingAdvances.toFixed(2)} <span className="text-sm text-muted-foreground">ر.س</span></div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AreaChart className="h-5 w-5" />
                {t('incomeVsExpenses')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => [`${value.toFixed(2)} ر.س`, '']}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="income" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name={t('income')} />
                  <Area type="monotone" dataKey="expenses" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} name={t('expense')} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t('incomeByProperty')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={[...chartData.byProperty].sort((a, b) => b.value - a.value)} margin={{ top: 25, right: 10, left: 10, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 13, fill: '#1f2937', fontWeight: 600 }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    tickMargin={12}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#4b5563', fontWeight: 500 }}
                    tickFormatter={(val) => Number(val).toLocaleString('ar-SA')}
                    width={80}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    formatter={(value) => [`${value.toFixed(2)} ر.س`, t('income')]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <defs>
                    <linearGradient id="colorIncomeV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="value" fill="url(#colorIncomeV)" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    <LabelList
                      dataKey="value"
                      position="top"
                      formatter={(val) => Number(val).toLocaleString('ar-SA')}
                      style={{ fontSize: '12px', fill: '#111827', fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5" />
                {t('expensesByCategory')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 mt-2">
                {/* Donut Chart */}
                {chartData.byCategory.length > 0 && !chartData.byCategory.every(c => c.value === 0) && (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={chartData.byCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {chartData.byCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value.toFixed(2)} ر.س`, '']}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}

                {/* Categories List */}
                <div className="space-y-4">
                  {[...chartData.byCategory].sort((a, b) => b.value - a.value).map((item, index) => {
                    const percentage = kpis.totalExpenses > 0 ? ((item.value / kpis.totalExpenses) * 100) : 0;
                    return (
                      <div key={item.name} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-gray-100">{item.value.toFixed(2)} <span className="text-[10px] text-muted-foreground mr-0.5">ر.س</span></span>
                            <span className="text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-md">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {chartData.byCategory.every(c => c.value === 0) && (
                  <div className="text-center text-muted-foreground py-10 flex flex-col items-center justify-center gap-2">
                    <PieChartIcon className="h-8 w-8 text-gray-300 dark:text-gray-700" />
                    <span>{t('noData') || 'لا توجد مصروفات مسجلة لهذه الفترة'}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {t('recentTransactions')}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {currentTransactions.length > 0 ? (
                  currentTransactions.map((transaction) => (
                    <motion.div
                      key={transaction.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${transaction.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {transaction.type === 'income' ? (
                            <TrendingUp className="h-5 w-5" />
                          ) : (
                            <TrendingDown className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{transaction.description}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {transaction.formattedProperty}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`font-bold flex items-center gap-1 ${transaction.type === 'income'
                          ? 'text-green-600'
                          : 'text-red-600'
                          }`}
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {transaction.amount.toFixed(2)} <span className="text-sm">ر.س</span>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Alert className="max-w-md mx-auto">
                      <AlertTriangle className="h-5 w-5" />
                      <AlertTitle>{t('noTransactions')}</AlertTitle>
                      <AlertDescription>
                        {t('noTransactionsDescription')}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>

              {/* 👇 أزرار التنقل بين الصفحات هنا بالضبط 👇 */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                  >
                    {t('previous') || 'السابق'}
                  </Button>

                  <span className="text-sm text-muted-foreground">
                    {t('page') || 'صفحة'} {currentPage} {t('of') || 'من'} {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    {t('next') || 'التالي'}
                  </Button>
                </div>
              )}
            </CardContent>


          </Card>
        </motion.div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              {t('financialSummary')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('totalIncome')}:</span>
                <span className="font-medium text-green-600">{kpis.totalIncome.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('totalExpenses')}:</span>
                <span className="font-medium text-red-600">{kpis.totalExpenses.toFixed(2)} ر.س</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="font-medium">{t('netBalance')}:</span>
                <span className={`font-bold ${kpis.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpis.netBalance.toFixed(2)} ر.س
                </span>
              </div>
              {/* --- إضافة ملخص العهدة --- */}
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('totalCustodyGiven')}:</span>
                <span className="font-medium text-yellow-600">{kpis.totalCustodyGiven.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('totalCustodyExpenses')}:</span>
                <span className="font-medium text-orange-600">{kpis.totalCustodyExpenses.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('totalCustodyRemaining')}:</span>
                <span className="font-medium text-amber-600">{kpis.totalCustodyRemaining.toFixed(2)} ر.س</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              {t('propertySummary')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('activeProperties')}:</span>
                <span className="font-medium">{kpis.activeProperties}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('totalProperties')}:</span>
                <span className="font-medium">{properties.length}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="font-medium">{t('rentalRate')}:</span>
                <span className="font-bold">
                  {properties.length > 0 ? ((kpis.activeProperties / properties.length) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              {t('timePeriod')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('dateRange')}:</span>
                <span className="font-medium">
                  {dateRange === 'thisMonth' && t('thisMonth')}
                  {dateRange === 'lastMonth' && t('lastMonth')}
                  {dateRange === 'last3Months' && t('last3Months')}
                  {dateRange === 'custom' && t('customDateRange')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('selectedProperty')}:</span>
                <span className="font-medium">
                  {selectedProperty === 'all' ? t('allProperties') :
                    properties.find(p => p.id === selectedProperty)?.name || t('unknownProperty')}
                </span>
              </div>
              {dateRange === 'custom' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('customPeriod')}:</span>
                  <span className="font-medium">
                    {customStartDate && customEndDate ? (
                      `${format(new Date(customStartDate), 'dd/MM/yyyy')} - ${format(new Date(customEndDate), 'dd/MM/yyyy')}`
                    ) : (
                      t('selectDates')
                    )}
                  </span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('lastUpdated')}:</span>
                <span className="font-medium">{format(new Date(), 'dd MMM yyyy HH:mm')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
