import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Building2, Plus, Edit, Trash2, Search, Link, FileText, Phone, MapPin, Download, Eye, AlertCircle, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function Properties() {
  const { t } = useTranslation()
  const [properties, setProperties] = useState([])
  const [filteredProperties, setFilteredProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showUploadSuccess, setShowUploadSuccess] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    type: 'apartment',
    status: 'vacant',
    address: '',
    city: '',
    electricity_bill_number: '',
    water_bill_number: '',
    phone_number: '',
    location_link: '',
    purchase_deed_path: '',
    ownership_deed_path: '',
    construction_license_path: '',
    apartment_count: 0,
  })

  const handleFileChange = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    // 🧽 تنظيف اسم الملف والمسار من الرموز والمسافات
    const cleanName = (formData.name || "property")
      .replace(/[^a-zA-Z0-9_-]/g, "_") // يمنع العربية والرموز
      .toLowerCase();

    const cleanFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .toLowerCase();

    // 🧱 مسار آمن متوافق مع Supabase
    const filePath = `${cleanName}/${fieldName}/${Date.now()}_${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from("property_documents")
      .upload(filePath, file, { upsert: true });

    if (error) {
      console.error(`Error uploading ${fieldName}:`, error);
      alert(`❌ Failed to upload ${fieldName}. Please try again.`);
    } else {
      const { data: publicUrlData } = supabase.storage
        .from("property_documents")
        .getPublicUrl(data.path);

      setFormData({ ...formData, [fieldName]: publicUrlData.publicUrl });
      setShowUploadSuccess(true);
      setTimeout(() => setShowUploadSuccess(false), 3000);
    }
  };

  const getFileExtension = (url) => {
    try {
      return url.split('.').pop().split('?')[0];
    } catch {
      return 'file'; // في حال فشل استخراج الامتداد
    }
  };

  useEffect(() => {
    fetchProperties()
  }, [])

  useEffect(() => {
    filterProperties()
  }, [properties, searchTerm, filterType, filterStatus])

  const fetchProperties = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProperties(data || [])
    } catch (error) {
      console.error('Error fetching properties:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterProperties = () => {
    let filtered = [...properties]

    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.address.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (filterType !== 'all') {
      filtered = filtered.filter((p) => p.type === filterType)
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((p) => p.status === filterStatus)
    }

    setFilteredProperties(filtered)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingProperty) {
        const { error } = await supabase
          .from('properties')
          .update(formData)
          .eq('id', editingProperty.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('properties').insert([formData])

        if (error) throw error
      }

      setDialogOpen(false)
      resetForm()
      fetchProperties()
    } catch (error) {
      console.error('Error saving property:', error)
    }
  }

  const handleEdit = (property) => {
    setEditingProperty(property)
    setFormData({
      name: property.name,
      type: property.type,
      status: property.status,
      address: property.address,
      city: property.city,
      electricity_bill_number: property.electricity_bill_number || '',
      water_bill_number: property.water_bill_number || '',
      phone_number: property.phone_number || '',
      location_link: property.location_link || '',
      purchase_deed_path: property.purchase_deed_path || '',
      ownership_deed_path: property.ownership_deed_path || '',
      construction_license_path: property.construction_license_path || '',
      apartment_count: property.apartment_count || 0,
    })
    setDialogOpen(true)
  }

  const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(link.href)
    } catch (err) {
      console.error('❌ Error downloading file:', err)
      alert('حدث خطأ أثناء تحميل الملف')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('confirmDelete') || 'هل أنت متأكد من الحذف؟')) return

    try {
      const { error } = await supabase.from('properties').delete().eq('id', id)

      if (error) throw error
      fetchProperties()
    } catch (error) {
      console.error('Error deleting property:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'apartment',
      status: 'vacant',
      address: '',
      city: '',
      electricity_bill_number: '',
      water_bill_number: '',
      phone_number: '',
      location_link: '',
      purchase_deed_path: '',
      ownership_deed_path: '',
      construction_license_path: '',
      apartment_count: 0,
    })
    setEditingProperty(null)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'rented':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'vacant':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'maintenance':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'rented':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'vacant':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'maintenance':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  // Loading skeleton for cards
  const renderSkeletonCards = () => {
    return Array.from({ length: 3 }).map((_, index) => (
      <Card key={index} className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div>
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <div className="flex gap-2 mt-4">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{t('filterByType')}</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes') || 'كل الأنواع'}</SelectItem>
                <SelectItem value="apartment">{t('apartment') || 'شقة'}</SelectItem>
                <SelectItem value="shop">{t('shop') || 'محل'}</SelectItem>
                <SelectItem value="villa">{t('villa') || 'فيلا'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{t('filterByStatus')}</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatuses') || 'كل الحالات'}</SelectItem>
                <SelectItem value="rented">{t('rented') || 'مؤجر'}</SelectItem>
                <SelectItem value="vacant">{t('vacant') || 'شاغر'}</SelectItem>
                <SelectItem value="maintenance">{t('maintenance') || 'صيانة'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {t('addProperty')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>
                  {editingProperty ? t('editProperty') : t('addProperty')}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('propertyName')}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">{t('propertyType')}</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartment">{t('apartment') || 'شقة'}</SelectItem>
                      <SelectItem value="shop">{t('shop') || 'محل'}</SelectItem>
                      <SelectItem value="villa">{t('villa') || 'فيلا'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">{t('propertyStatus')}</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rented">{t('rented') || 'مؤجر'}</SelectItem>
                      <SelectItem value="vacant">{t('vacant') || 'شاغر'}</SelectItem>
                      <SelectItem value="maintenance">{t('maintenance') || 'صيانة'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">{t('address')}</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">{t('city')}</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="electricity_bill_number">{t('electricityBillNumber')}</Label>
                  <Input
                    id="electricity_bill_number"
                    value={formData.electricity_bill_number}
                    onChange={(e) => setFormData({ ...formData, electricity_bill_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="water_bill_number">{t('waterBillNumber')}</Label>
                  <Input
                    id="water_bill_number"
                    value={formData.water_bill_number}
                    onChange={(e) => setFormData({ ...formData, water_bill_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_number">{t('phoneNumber')}</Label>
                  <Input
                    id="phone_number"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location_link">{t('locationLink')}</Label>
                  <Input
                    id="location_link"
                    value={formData.location_link}
                    onChange={(e) => setFormData({ ...formData, location_link: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apartment_count">{t('apartmentCount')}</Label>
                  <Input
                    id="apartment_count"
                    type="number"
                    value={formData.apartment_count}
                    onChange={(e) => setFormData({ ...formData, apartment_count: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>{t('documents')}</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="purchase_deed_path">{t('purchaseDeed')}</Label>
                      <Input
                        id="purchase_deed_path"
                        type="file"
                        onChange={(e) => handleFileChange(e, 'purchase_deed_path')}
                      />
                      {formData.purchase_deed_path && (
                        <div className="flex items-center gap-2 mt-1">
                          <Eye className="h-4 w-4 text-blue-500" />
                          <a href={formData.purchase_deed_path} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">
                            {t('viewFile')}
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ownership_deed_path">{t('ownershipDeed')}</Label>
                      <Input
                        id="ownership_deed_path"
                        type="file"
                        onChange={(e) => handleFileChange(e, 'ownership_deed_path')}
                      />
                      {formData.ownership_deed_path && (
                        <div className="flex items-center gap-2 mt-1">
                          <Eye className="h-4 w-4 text-blue-500" />
                          <a href={formData.ownership_deed_path} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">
                            {t('viewFile')}
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="construction_license_path">{t('constructionLicense')}</Label>
                      <Input
                        id="construction_license_path"
                        type="file"
                        onChange={(e) => handleFileChange(e, 'construction_license_path')}
                      />
                      {formData.construction_license_path && (
                        <div className="flex items-center gap-2 mt-1">
                          <Eye className="h-4 w-4 text-blue-500" />
                          <a href={formData.construction_license_path} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">
                            {t('viewFile')}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter className="md:col-span-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button type="submit">{t('save')}</Button>
                </DialogFooter>
              </form>

              {showUploadSuccess && (
                <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>{t('fileUploadedSuccessfully')}</span>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Success Notification */}
      {showUploadSuccess && (
        <div className="fixed bottom-4 right-4 p-4 bg-green-500 text-white rounded-lg shadow-lg flex items-center gap-2 animate-fade-in-up">
          <CheckCircle className="h-5 w-5" />
          <span>{t('fileUploadedSuccessfully')}</span>
        </div>
      )}

      {/* Properties Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          renderSkeletonCards()
        ) : filteredProperties.length > 0 ? (
          filteredProperties.map((property) => (
            <Card key={property.id} className="hover:shadow-lg transition-all duration-300 border border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{property.name}</CardTitle>
                      <Badge variant="secondary" className="capitalize">
                        {property.type}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1">
                      {getStatusIcon(property.status)}
                      <span className="text-xs font-medium">{property.status}</span>
                    </div>
                    <Badge className={`${getStatusColor(property.status)} mt-1`}>
                      {property.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{property.address}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{property.phone_number || '-'}</span>
                    </div>
                  </div>

                  {property.apartment_count > 0 && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('apartmentCount')}: {property.apartment_count}</span>
                    </div>
                  )}

                  {property.electricity_bill_number && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('electricityBillNumber')}: {property.electricity_bill_number}</span>
                    </div>
                  )}

                  {property.water_bill_number && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('waterBillNumber')}: {property.water_bill_number}</span>
                    </div>
                  )}

                  {property.location_link && (
                    <div className="flex items-center gap-2">
                      <Link className="h-4 w-4 text-muted-foreground" />
                      <a href={property.location_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline">
                        {t('locationLink')}
                      </a>
                    </div>
                  )}

                  <div className="pt-2">
                    <div className="flex flex-wrap gap-2">
                      {property.purchase_deed_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDownload(
                              property.purchase_deed_path,
                              `صك_الشراء_${property.name}.${property.purchase_deed_path.split('.').pop().split('?')[0]}`
                            )
                          }
                          className="flex items-center gap-1 text-xs"
                        >
                          <Download className="h-3 w-3" />
                          {t('purchaseDeed')}
                        </Button>
                      )}

                      {property.ownership_deed_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDownload(
                              property.ownership_deed_path,
                              `صك_الملكية_${property.name}.${property.ownership_deed_path.split('.').pop().split('?')[0]}`
                            )
                          }
                          className="flex items-center gap-1 text-xs"
                        >
                          <Download className="h-3 w-3" />
                          {t('ownershipDeed')}
                        </Button>
                      )}

                      {property.construction_license_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDownload(
                              property.construction_license_path,
                              `رخصة_البناء_${property.name}.${property.construction_license_path.split('.').pop().split('?')[0]}`
                            )
                          }
                          className="flex items-center gap-1 text-xs"
                        >
                          <Download className="h-3 w-3" />
                          {t('constructionLicense')}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleEdit(property)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      {t('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(property.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <Building2 className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">{t('noPropertiesFound')}</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {t('noPropertiesMessage') || 'لم يتم العثور على ممتلكات. ابدأ بإضافة ممتلكات جديدة.'}
            </p>
            <Button
              className="mt-4"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('addProperty')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}