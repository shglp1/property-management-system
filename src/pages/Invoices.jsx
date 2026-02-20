import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog'
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
  Upload,
  Download,
  Trash2,
  Search,
  Eye,
  Plus,
  Edit,
  AlertCircle,
  CheckCircle,
  Clock,
  FileImage,
  FileSpreadsheet,
  File,
  X,
  DollarSign,
  Calendar,
  User
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { motion, AnimatePresence } from 'framer-motion'

export default function Invoices() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const isRTL = i18n.language === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'

  const [invoices, setInvoices] = useState([])
  const [filteredInvoices, setFilteredInvoices] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [editingInvoice, setEditingInvoice] = useState(null)

  const [formData, setFormData] = useState({
    invoice_number: '',
    description: '',
    amount: 0,
    file_path: '',
    file_name: '',
    property_id: '',
    uploaded_at: new Date().toISOString()
  })

  useEffect(() => {
    fetchInvoices()
    fetchProperties()
  }, [])

  useEffect(() => {
    filterInvoices()
  }, [invoices, searchTerm])

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(
          `
          *,
          properties(name)
        `
        )
        .order('uploaded_at', { ascending: false })

      if (error) throw error

      setInvoices(data || [])
    } catch (error) {
      console.error('Error fetching invoices:', error)
      alert(`Error fetching invoices: ${error.message}`)
    } finally {
      setLoading(false)
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
      alert(`Error fetching properties: ${error.message}`)
    }
  }

  const filterInvoices = () => {
    let filtered = [...invoices]

    if (searchTerm) {
      filtered = filtered.filter(
        (inv) =>
          inv.invoice_number
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          inv.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.properties?.name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      )
    }

    setFilteredInvoices(filtered)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const safeKey = file.name
        .replace(/\s+/g, '_')
        .replace(/[^\w.-]/g, '')
      const fileName = `${Date.now()}_${safeKey}`
      const filePath = `invoices/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      setFormData({
        ...formData,
        file_path: filePath,
        file_name: fileName
      })
      setSelectedFile(file)
      alert('File uploaded successfully!')
    } catch (error) {
      console.error('Error uploading file:', error)
      alert(`Failed to upload file: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const addNotification = async (message, type = 'info') => {
    try {
      await supabase.from('notifications').insert([
        {
          user_id: user?.id,
          message,
          type,
          is_read: false
        }
      ])
    } catch (error) {
      console.error('Error adding notification:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.invoice_number) {
      alert('Invoice number is required!')
      return
    }

    try {
      const invoiceData = {
        ...formData,
        amount: parseFloat(formData.amount),
        uploaded_at: new Date().toISOString()
      }

      if (editingInvoice) {
        const { error } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', editingInvoice.id)

        if (error) throw error
        addNotification(
          `تم تعديل الفاتورة رقم: ${formData.invoice_number}`,
          'info'
        )
      } else {
        const { error } = await supabase.from('invoices').insert([invoiceData])

        if (error) throw error
        addNotification(
          `تم إضافة فاتورة جديدة: ${formData.invoice_number}`,
          'success'
        )
      }

      setDialogOpen(false)
      resetForm()
      fetchInvoices()
    } catch (error) {
      console.error('Error saving invoice:', error)
      alert(`Failed to save invoice: ${error.message}`)
    }
  }

  const handleEdit = (invoice) => {
    setEditingInvoice(invoice)
    setFormData({
      invoice_number: invoice.invoice_number || '',
      description: invoice.description || '',
      amount: invoice.amount || 0,
      file_path: invoice.file_path || '',
      file_name: invoice.file_name || '',
      property_id: invoice.property_id || '',
      uploaded_at: invoice.uploaded_at || new Date().toISOString()
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id, invoiceNumber) => {
    if (!confirm(t('confirmDelete') || 'هل أنت متأكد من الحذف؟')) return

    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id)

      if (error) throw error
      fetchInvoices()
      addNotification(`تم حذف الفاتورة رقم: ${invoiceNumber}`, 'warning')
    } catch (error) {
      console.error('Error deleting invoice:', error)
      alert(`Failed to delete invoice: ${error.message}`)
    }
  }

  const resetForm = () => {
    setFormData({
      invoice_number: '',
      description: '',
      amount: 0,
      file_path: '',
      file_name: '',
      property_id: '',
      uploaded_at: new Date().toISOString()
    })
    setSelectedFile(null)
    setEditingInvoice(null)
  }

  const getFileIcon = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'pdf':
        return <File className="h-5 w-5 text-red-500" />
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <FileImage className="h-5 w-5 text-blue-500" />
      case 'xls':
      case 'xlsx':
        return <FileSpreadsheet className="h-5 w-5 text-green-500" />
      default:
        return <FileText className="h-5 w-5 text-gray-500" />
    }
  }

  const getDocumentType = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'pdf':
        return 'PDF'
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'Image'
      case 'xls':
      case 'xlsx':
        return 'Excel'
      default:
        return 'Document'
    }
  }

  const downloadInvoice = async (filePath, fileName) => {
    try {
      // Invoices store relative path, so get public URL first
      const { data } = supabase.storage
        .from('invoices')
        .getPublicUrl(filePath)

      const fileUrl = data.publicUrl

      const response = await fetch(fileUrl)
      if (!response.ok) {
        if (response.status === 404) {
          alert(isRTL ? "المرفق غير موجود" : "File not found")
          return
        }
        throw new Error("Download failed")
      }

      const blob = await response.blob()

      // Construct Filename: ${description}_${YYYY-MM-DD_HH-mm}.${ext}
      // We don't have description here easily unless we pass it, but fileName usually has it or we use standard format.
      // The function signature is (filePath, fileName). `fileName` comes from the invoice object (e.g. "timestamp_name.pdf").
      // We can try to make it prettier if possible, or just use the stored name but ensure extension.
      // Let's use the stored `fileName` but ensure it's safe.
      const safeName = fileName || 'invoice_file'

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = safeName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading invoice:', error)
      alert(`Failed to download invoice: ${error.message}`)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = parseISO(dateString)
      return format(date, 'dd MMM yyyy', {
        locale: isRTL ? ar : enUS
      })
    } catch (e) {
      return dateString
    }
  }

  const formatTime = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = parseISO(dateString)
      return format(date, 'hh:mm a', {
        locale: isRTL ? ar : enUS
      })
    } catch (e) {
      return dateString
    }
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = parseISO(dateString)
      const formattedDate = format(date, 'dd MMM yyyy', {
        locale: isRTL ? ar : enUS
      })
      const formattedTime = format(date, 'hh:mm a', {
        locale: isRTL ? ar : enUS
      })
      return `${formattedDate} | ${formattedTime}`
    } catch (e) {
      return dateString
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg flex items-center">
          <Clock className="animate-spin mr-2 h-5 w-5" />
          {t('loading')}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}
      dir={dir}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className={`absolute ${isRTL ? 'right-3' : 'left-3'
              } top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground`}
          />
          <Input
            placeholder={t('search') + ' (رقم الفاتورة، الوصف، الملكية)'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={isRTL ? 'pr-10' : 'pl-10'}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {t('addInvoice') || 'إضافة فاتورة'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {editingInvoice
                    ? t('editInvoice') || 'تعديل فاتورة'
                    : t('addInvoice') || 'إضافة فاتورة'}
                </DialogTitle>
                <DialogDescription>
                  {isRTL ? "أدخل تفاصيل الفاتورة أدناه." : "Enter invoice details below."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_number">
                    {t('invoiceNumber')} *
                  </Label>
                  <Input
                    id="invoice_number"
                    value={formData.invoice_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        invoice_number: e.target.value
                      })
                    }
                    required
                    placeholder="أدخل رقم الفاتورة"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{t('description')}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="وصف الفاتورة"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">{t('amount')}</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property">{t('propertyName')}</Label>
                  <Select
                    value={formData.property_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, property_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('selectProperty') || 'اختر ملكية'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file">{t('attachFile')}</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                  {formData.file_path && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded-md">
                      {getFileIcon(formData.file_name)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {formData.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getDocumentType(formData.file_name)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={uploading}>
                    {uploading
                      ? t('uploading') || 'جاري الرفع...'
                      : t('save')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('totalInvoices')}
            </CardTitle>
            <FileText className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('totalInvoicesDesc')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-green-500 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('totalAmount')}
            </CardTitle>
            <DollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {invoices
                .reduce(
                  (sum, inv) => sum + (parseFloat(inv.amount) || 0),
                  0
                )
                .toFixed(2)}{' '}
              ر.س
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('totalAmountDesc')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-purple-500 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('latestInvoice')}
            </CardTitle>
            <Clock className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {invoices.length > 0
                ? formatDateTime(invoices[0]?.uploaded_at)
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('latestInvoiceDesc')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>{t('invoices')}</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {t('updated')}{' '}
              {format(new Date(), 'dd MMM yyyy HH:mm', {
                locale: isRTL ? ar : enUS
              })}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead
                    className={`font-bold ${isRTL ? 'text-right' : 'text-left'
                      }`}
                  >
                    {t('invoiceNumber')}
                  </TableHead>
                  <TableHead
                    className={`font-bold ${isRTL ? 'text-right' : 'text-left'
                      }`}
                  >
                    {t('description')}
                  </TableHead>
                  <TableHead className="font-bold text-right">
                    {t('amount')}
                  </TableHead>
                  <TableHead
                    className={`font-bold ${isRTL ? 'text-right' : 'text-left'
                      }`}
                  >
                    {t('propertyName')}
                  </TableHead>
                  <TableHead
                    className={`font-bold ${isRTL ? 'text-right' : 'text-left'
                      }`}
                  >
                    {t('date')}
                  </TableHead>
                  <TableHead
                    className={`font-bold ${isRTL ? 'text-right' : 'text-left'
                      }`}
                  >
                    {t('file')}
                  </TableHead>
                  <TableHead
                    className={`font-bold ${isRTL ? 'text-right' : 'text-left'
                      }`}
                  >
                    {t('actions') || 'الإجراءات'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {filteredInvoices.length > 0 ? (
                    filteredInvoices.map((invoice) => (
                      <motion.tr
                        key={invoice.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className={`hover:bg-gray-50 ${isRTL ? 'text-right' : 'text-left'
                          }`}
                      >
                        <TableCell className="font-medium py-4">
                          {invoice.invoice_number || '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate py-4">
                          {invoice.description || '-'}
                        </TableCell>
                        <TableCell className="font-medium py-4 text-right">
                          {invoice.amount
                            ? invoice.amount.toFixed(2)
                            : '-'}{' '}
                          <span className="text-xs">ر.س</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <div
                            className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''
                              }`}
                          >
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{invoice.properties?.name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {formatDate(invoice.uploaded_at)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(invoice.uploaded_at)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          {invoice.file_path ? (
                            <div className="flex items-center gap-2">
                              {getFileIcon(invoice.file_name)}
                              <span className="text-sm truncate max-w-[100px]">
                                {invoice.file_name}
                              </span>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              {t('noFile')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-wrap gap-2">
                            {invoice.file_path && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  downloadInvoice(
                                    invoice.file_path,
                                    invoice.file_name
                                  )
                                }
                                title={t('downloadFile')}
                                className="flex items-center gap-1"
                              >
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">
                                  {t('download')}
                                </span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(invoice)}
                              title={t('edit')}
                              className="flex items-center gap-1"
                            >
                              <Edit className="h-4 w-4" />
                              <span className="hidden sm:inline">
                                {t('edit')}
                              </span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive flex items-center gap-1"
                              onClick={() =>
                                handleDelete(
                                  invoice.id,
                                  invoice.invoice_number
                                )
                              }
                              title={t('delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="hidden sm:inline">
                                {t('delete')}
                              </span>
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Alert className="max-w-md mx-auto">
                          <AlertCircle className="h-5 w-5" />
                          <AlertTitle>{t('noInvoicesFound')}</AlertTitle>
                          <AlertDescription>
                            {t('noInvoicesDescription')}
                          </AlertDescription>
                        </Alert>
                      </TableCell>
                    </TableRow>
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
