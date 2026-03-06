// src/pages/Reports.jsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  FileText,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  DollarSign
} from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear
} from 'date-fns'
import { addNotification } from '@/lib/notifications'
import { useAuth } from '@/contexts/AuthContext'
import * as XLSX from 'xlsx'

export default function Reports() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()

  const isArabic = i18n.language === 'ar'
  const dir = isArabic ? 'rtl' : 'ltr'

  const [reportType, setReportType] = useState('monthly')
  const [transactionType, setTransactionType] = useState('all') // all, income, expense
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  )
  const [endDate, setEndDate] = useState(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  )
  const [transactions, setTransactions] = useState([])
  const [filteredTransactions, setFilteredTransactions] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    totalAdvances: 0,
    totalRepayments: 0,
    netBalance: 0,
    transactionCount: 0
  })
  const [selectedProperty, setSelectedProperty] = useState('all')

  useEffect(() => {
    updateDateRange(reportType)
  }, [reportType])

  useEffect(() => {
    filterTransactions()
  }, [transactions, transactionType, selectedProperty])

  const updateDateRange = (type) => {
    const now = new Date()
    switch (type) {
      case 'monthly':
        setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'))
        setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'))
        break
      case 'yearly':
        setStartDate(format(startOfYear(now), 'yyyy-MM-dd'))
        setEndDate(format(endOfYear(now), 'yyyy-MM-dd'))
        break
      default:
        break
    }
  }

  const filterTransactions = () => {
    let filtered = [...transactions]

    if (transactionType !== 'all') {
      filtered = filtered.filter((t) => t.type === transactionType)
    }
    if (selectedProperty !== 'all') {
      filtered = filtered.filter(
        (t) => String(t.property_id) === String(selectedProperty)
      )
    }

    setFilteredTransactions(filtered)

    const totalIncome = filtered
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0)

    const totalExpenses = filtered
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0)

    const totalAdvances = filtered
      .filter((tx) => tx.type === 'salary_advance')
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0)

    const totalRepayments = filtered
      .filter((tx) => tx.type === 'salary_advance_repayment')
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0)

    setSummary({
      totalIncome,
      totalExpenses,
      totalAdvances,
      totalRepayments,
      netBalance: totalIncome - totalExpenses + totalRepayments - totalAdvances,
      transactionCount: filtered.length
    })
  }

  useEffect(() => {
    const fetchProperties = async () => {
      const { data, error } = await supabase.from('properties').select('*')
      if (!error) setProperties(data)
    }
    fetchProperties()
  }, [])

  const generateReport = async () => {
    if (new Date(startDate) > new Date(endDate)) {
      alert(t('invalidDateRange') || 'نطاق التاريخ غير صالح')
      return
    }

    setLoading(true)
    try {
      let query = supabase
        .from('transactions')
        .select('*, properties(name), source_type')
        .gte('date', `${startDate}T00:00:00.000Z`)
        .lte('date', `${endDate}T23:59:59.999Z`)
        .order('date', { ascending: false })

      if (transactionType !== 'all') {
        query = query.eq('type', transactionType)
      }

      if (selectedProperty !== 'all') {
        query = query.eq('property_id', selectedProperty)
      }

      const { data: transactionsData, error: transError } = await query

      if (transError) throw transError

      setTransactions(transactionsData || [])

      await addNotification(
        user.id,
        `تم إنشاء تقرير جديد للفترة من ${startDate} إلى ${endDate}`,
        'success'
      )
    } catch (error) {
      // handle error if needed
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = () => {
    const excelData = filteredTransactions.map((tx) => ({
      [t('propertyName')]: tx.properties?.name || 'N/A',
      [t('description')]: tx.description,
      [t('amount')]: Number(tx.amount),
      [t('date')]: format(new Date(tx.date), 'dd/MM/yyyy'),
      [t('transactionType')]: t(tx.type),
      [t('sourceType') || 'نوع المصدر']:
        tx.source_type === 'custody'
          ? 'العهدة'
          : tx.source_type === 'property'
            ? 'الممتلكات'
            : 'غير محدد'
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelData)

    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 40 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 }
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report')

    const summaryData = []
    if (transactionType === 'all' || transactionType === 'income') {
      summaryData.push({
        [t('metric')]: t('totalIncome'),
        [t('value')]: summary.totalIncome.toFixed(2)
      })
    }
    if (transactionType === 'all' || transactionType === 'expense') {
      summaryData.push({
        [t('metric')]: t('totalExpenses'),
        [t('value')]: summary.totalExpenses.toFixed(2)
      })
    }
    if (transactionType === 'all' || transactionType === 'salary_advance') {
      summaryData.push({
        [t('metric')]: t('totalAdvances'),
        [t('value')]: summary.totalAdvances.toFixed(2)
      })
    }
    if (transactionType === 'all' || transactionType === 'salary_advance_repayment') {
      summaryData.push({
        [t('metric')]: t('totalRepayments'),
        [t('value')]: summary.totalRepayments.toFixed(2)
      })
    }
    if (transactionType === 'all' || transactionType === 'income' || transactionType === 'expense' || transactionType === 'salary_advance' || transactionType === 'salary_advance_repayment') {
      summaryData.push({
        [t('metric')]: t('netBalance'),
        [t('value')]: summary.netBalance.toFixed(2)
      })
    }
    summaryData.push({
      [t('metric')]: t('transactionCount') || 'عدد المعاملات',
      [t('value')]: summary.transactionCount
    })
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary')

    const typeLabel = transactionType;
    const fileName = `report_${typeLabel}_${format(
      new Date(),
      'yyyy-MM-dd'
    )}.xlsx`

    XLSX.writeFile(workbook, fileName)
  }

  const exportToPDF = async () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="${dir}">
      <head>
        <meta charset="UTF-8">
        <title>${t('financialReport') || 'التقرير المالي'}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            direction: ${dir};
            padding: 20px;
          }
          h1 {
            text-align: center;
            color: #333;
          }
          .summary {
            display: flex;
            justify-content: space-around;
            margin: 30px 0;
          }
          .summary-item {
            text-align: center;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 8px;
            flex: 1;
            margin: 0 10px;
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
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 30px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: ${dir === 'rtl' ? 'right' : 'left'};
          }
          th {
            background-color: #f3f4f6;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <h1>${t('financialReport') || 'التقرير المالي'}</h1>
        <p style="text-align: center; color: #666;">
          ${t('from') || 'من'} ${format(
      new Date(startDate),
      'dd/MM/yyyy'
    )} ${t('to') || 'إلى'} ${format(new Date(endDate), 'dd/MM/yyyy')}
        </p>
        <p style="text-align: center; color: #666;">
          ${t('reportType')}: ${t(transactionType === 'all' ? 'allTypes' : transactionType)}
        </p>

        <div class="summary">
          ${(transactionType === 'all' || transactionType === 'income') ? `
          <div class="summary-item">
            <h3>${t('totalIncome')}</h3>
            <p class="income">${Number(summary.totalIncome.toFixed(2))} ر.س</p>
          </div>` : ''}
          ${(transactionType === 'all' || transactionType === 'expense') ? `
          <div class="summary-item">
            <h3>${t('totalExpenses')}</h3>
            <p class="expense">${Number(summary.totalExpenses.toFixed(2))} ر.س</p>
          </div>` : ''}
          ${(transactionType === 'all' || transactionType === 'salary_advance') ? `
          <div class="summary-item">
            <h3>${t('totalAdvances')}</h3>
            <p class="expense" style="color: #4f46e5;">${Number(summary.totalAdvances.toFixed(2))} ر.س</p>
          </div>` : ''}
          ${(transactionType === 'all' || transactionType === 'salary_advance_repayment') ? `
          <div class="summary-item">
            <h3>${t('totalRepayments')}</h3>
            <p class="income" style="color: #0d9488;">${Number(summary.totalRepayments.toFixed(2))} ر.س</p>
          </div>` : ''}
          ${(transactionType === 'all' || transactionType === 'income' || transactionType === 'expense' || transactionType === 'salary_advance' || transactionType === 'salary_advance_repayment') ? `
          <div class="summary-item">
            <h3>${t('netBalance')}</h3>
            <p class="balance">${Number(summary.netBalance.toFixed(2))} ر.س</p>
          </div>` : ''}
          <div class="summary-item">
            <h3>${t('transactionCount') || 'عدد المعاملات'}</h3>
            <p class="balance" style="color: #9333ea;">${summary.transactionCount}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${t('propertyName')}</th>
              <th>${t('description')}</th>
              <th>${t('transactionType')}</th>
              <th>${t('amount')}</th>
              <th>${t('date')}</th>
              <th>${t('sourceType') || 'نوع المصدر'}</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTransactions
        .map(
          (tx) => `
              <tr>
                <td>${tx.properties?.name || '-'}</td>
                <td>${tx.description || '-'}</td>
                <td>${t(tx.type)}</td>
                <td class="${tx.type === 'income' || tx.type === 'salary_advance_repayment' ? 'income' : 'expense'
            }">${Number(tx.amount).toFixed(2)} ر.س</td>
                <td>${format(new Date(tx.date), 'dd/MM/yyyy')}</td>
                <td>${tx.source_type === 'custody'
              ? 'العهدة'
              : tx.source_type === 'property'
                ? 'الممتلكات'
                : 'غير محدد'
            }</td>
              </tr>
            `
        )
        .join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>${t('generatedOn') || 'تم الإنشاء في'}: ${format(
          new Date(),
          'dd/MM/yyyy HH:mm'
        )}</p>
          <p>${t('propertyManagementSystem') || 'نظام إدارة الممتلكات'}</p>
        </div>
      </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const typeLabel = transactionType;
    a.download = `report_${typeLabel}_${startDate}-to-${endDate}.html`
    a.click()
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
      className={`space-y-6 ${isArabic ? 'text-right' : 'text-left'}`}
      dir={dir}
    >
      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('generateReport')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{t('reportPeriod') || 'فترة التقرير'}</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t('monthly')}</SelectItem>
                  <SelectItem value="yearly">{t('yearly')}</SelectItem>
                  <SelectItem value="custom">{t('customRange')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('reportType')}</Label>
              <Select
                value={transactionType}
                onValueChange={setTransactionType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allTypes')}</SelectItem>
                  <SelectItem value="income">{t('income')}</SelectItem>
                  <SelectItem value="expense">{t('expense')}</SelectItem>
                  <SelectItem value="salary_advance">{t('salary_advance')}</SelectItem>
                  <SelectItem value="salary_advance_repayment">{t('salary_advance_repayment')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('property') || 'العقار'}</Label>
              <Select
                value={selectedProperty}
                onValueChange={setSelectedProperty}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('selectProperty') || 'اختر العقار'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('allProperties') || 'كل العقارات'}
                  </SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('startDate')}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('endDate')}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={generateReport} className="w-full md:w-auto">
            {t('generateReport')}
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {transactions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {(transactionType === 'all' || transactionType === 'income') && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('totalIncome')}
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {summary.totalIncome.toFixed(2)} ر.س
                </div>
              </CardContent>
            </Card>
          )}

          {(transactionType === 'all' || transactionType === 'expense') && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('totalExpenses')}
                </CardTitle>
                <TrendingDown className="h-5 w-5 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {Number(summary.totalExpenses).toFixed(2)} ر.س
                </div>
              </CardContent>
            </Card>
          )}

          {(transactionType === 'all' || transactionType === 'salary_advance') && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('totalAdvances')}
                </CardTitle>
                <TrendingDown className="h-5 w-5 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">
                  {Number(summary.totalAdvances).toFixed(2)} ر.س
                </div>
              </CardContent>
            </Card>
          )}

          {(transactionType === 'all' || transactionType === 'salary_advance_repayment') && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('totalRepayments')}
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-teal-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-teal-600">
                  {Number(summary.totalRepayments).toFixed(2)} ر.س
                </div>
              </CardContent>
            </Card>
          )}

          {(transactionType === 'all' || transactionType === 'income' || transactionType === 'expense' || transactionType === 'salary_advance' || transactionType === 'salary_advance_repayment') && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('netBalance')}
                </CardTitle>
                <DollarSign className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {Number(summary.netBalance).toFixed(2)} ر.س
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('transactionCount') || 'عدد المعاملات'}
              </CardTitle>
              <FileText className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {summary.transactionCount}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Export Buttons */}
      {transactions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportToExcel} variant="outline">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {t('exportToExcel')}
          </Button>
          <Button onClick={exportToPDF} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            {t('exportHTML') || 'تصدير HTML'}
          </Button>
        </div>
      )}

      {/* Transactions Table */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('transactions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={isArabic ? 'text-right' : 'text-left'}>
                      {t('date')}
                    </TableHead>
                    <TableHead className={isArabic ? 'text-right' : 'text-left'}>
                      {t('transactionType')}
                    </TableHead>
                    <TableHead className={isArabic ? 'text-right' : 'text-left'}>
                      {t('sourceType') || 'نوع المصدر'}
                    </TableHead>
                    <TableHead className={isArabic ? 'text-right' : 'text-left'}>
                      {t('propertyName')}
                    </TableHead>
                    <TableHead className={isArabic ? 'text-right' : 'text-left'}>
                      {t('description')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('amount')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      className={isArabic ? 'text-right' : 'text-left'}
                    >
                      <TableCell>
                        {format(
                          new Date(transaction.date),
                          'dd MMM yyyy'
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${transaction.type === 'income' || transaction.type === 'salary_advance_repayment'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            }`}
                        >
                          {t(transaction.type)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {transaction.source_type === 'custody'
                          ? 'العهدة'
                          : transaction.source_type === 'property'
                            ? 'الممتلكات'
                            : 'غير محدد'}
                      </TableCell>
                      <TableCell>
                        {transaction.properties?.name || '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {transaction.description}
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${transaction.type === 'income' || transaction.type === 'salary_advance_repayment'
                          ? 'text-green-600'
                          : 'text-red-600'
                          }`}
                      >
                        {transaction.type === 'income' || transaction.type === 'salary_advance_repayment' ? '+' : '-'}
                        {Number(transaction.amount).toFixed(2)} ر.س
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {transactions.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">{t('noData')}</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {t('generateReportToSeeData') ||
                'قم بإنشاء تقرير لعرض البيانات'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
