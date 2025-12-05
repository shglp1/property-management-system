import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription, // استيراد DialogDescription
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Key, Plus, Edit, Trash2, CheckCircle, XCircle, AlertTriangle, Calendar, User, FileText, Phone, DollarSign, MapPin, Users, Download, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

export default function Rentals() {
  const { t } = useTranslation();
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRental, setEditingRental] = useState(null);
  const [formData, setFormData] = useState({
    apartmentNumber: '',
    contractNumber: '',
    tenantName: '',
    tenantPhone: '',
    startDate: '',
    endDate: '',
    paymentDueDate: '',
    monthlyRent: '',
    isRented: false,
    lease_contract_path: '',
  });

  const [rentalStats, setRentalStats] = useState({});
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);

  useEffect(() => {
    fetchProperties().then(() => fetchRentalStats());
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchRentals(selectedProperty.id);
    }
  }, [selectedProperty]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('name');

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRentalStats = async () => {
    try {
      const { data, error } = await supabase
        .from('rentals')
        .select('property_id, payment_status');

      if (error) throw error;

      const statsMap = {};
      data.forEach((item) => {
        if (!statsMap[item.property_id]) {
          statsMap[item.property_id] = { pending: 0, due_soon: 0, overdue: 0, paid: 0 };
        }
        statsMap[item.property_id][item.payment_status] += 1;
      });

      setRentalStats(statsMap);
    } catch (error) {
      console.error('Error fetching rental stats:', error);
    }
  };

  const fetchRentals = async (propertyId) => {
    try {
      const { data, error } = await supabase
        .from('rentals')
        .select('*')
        .eq('property_id', propertyId)
        .order('apartment_number');

      if (error) throw error;
      setRentals(data || []);
    } catch (error) {
      console.error('Error fetching rentals:', error);
    }
  };

  const getStatusColor = (status, isRented = null) => {
    if (isRented !== null) {
      if (isRented) {
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      } else {
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      }
    }

    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'due_soon':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'pending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getRowBgColor = (paymentStatus, isRented) => {
    if (!isRented) return 'bg-gray-50 dark:bg-gray-800/10'; // شاغرة
    if (paymentStatus === 'paid') return 'bg-green-50 dark:bg-green-900/10'; // مدفوعة
    if (paymentStatus === 'due_soon') return 'bg-yellow-50 dark:bg-yellow-900/10'; // قريبة
    if (paymentStatus === 'overdue') return 'bg-red-50 dark:bg-red-900/10'; // متأخرة
    return 'bg-blue-50 dark:bg-blue-900/10'; // افتراضي (pending)
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'due_soon':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <XCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleFileChange = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    const cleanName = (formData.apartmentNumber || "apartment")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase();

    const cleanFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .toLowerCase();

    const filePath = `contracts/${cleanName}/${Date.now()}_${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from("rental_contracts")
      .upload(filePath, file, { upsert: true });

    if (error) {
      console.error(`Error uploading ${fieldName}:`, error);
      alert(`❌ Failed to upload ${fieldName}. Please try again.`);
    } else {
      // استخدام getPublicUrl للحصول على الرابط
      const { data: urlData } = supabase.storage
        .from("rental_contracts")
        .getPublicUrl(data.path);

      setFormData({ ...formData, [fieldName]: urlData.publicUrl });
      setShowUploadSuccess(true);
      setTimeout(() => setShowUploadSuccess(false), 3000);
    }
  };

  const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('❌ Error downloading file:', err);
      alert('حدث خطأ أثناء تحميل الملف');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProperty) return;

    try {
      const rentalData = {
        property_id: selectedProperty.id,
        apartment_number: formData.apartmentNumber,
        contract_number: formData.contractNumber || null,
        tenant_name: formData.tenantName || null,
        tenant_phone: formData.tenantPhone || null,
        start_date: formData.startDate || null,
        end_date: formData.endDate || null,
        payment_due_date: formData.paymentDueDate || null,
        monthly_rent: parseFloat(formData.monthlyRent) || 0,
        is_rented: formData.isRented,
        lease_contract_path: formData.lease_contract_path || null,
      };

      let result;
      if (editingRental) {
        result = await supabase.from('rentals').update(rentalData).eq('id', editingRental.id);
      } else {
        result = await supabase.from('rentals').insert([rentalData]);
      }

      if (result.error) throw result.error;

      setDialogOpen(false);
      setEditingRental(null);
      setFormData({
        apartmentNumber: '',
        contractNumber: '',
        tenantName: '',
        tenantPhone: '',
        startDate: '',
        endDate: '',
        paymentDueDate: '',
        monthlyRent: '',
        isRented: false,
        lease_contract_path: '',
      });
      fetchRentals(selectedProperty.id);
      fetchRentalStats();
    } catch (error) {
      console.error('Error saving rental:', error);
      alert(t('saveError') || 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleEdit = (rental) => {
    setEditingRental(rental);
    setFormData({
      apartmentNumber: rental.apartment_number,
      contractNumber: rental.contract_number || '',
      tenantName: rental.tenant_name || '',
      tenantPhone: rental.tenant_phone || '',
      startDate: rental.start_date || '',
      endDate: rental.end_date || '',
      paymentDueDate: rental.payment_due_date || '',
      monthlyRent: rental.monthly_rent || '',
      isRented: rental.is_rented,
      lease_contract_path: rental.lease_contract_path || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm(t('confirmDelete') || 'هل أنت متأكد من الحذف؟')) return;

    try {
      const { error } = await supabase.from('rentals').delete().eq('id', id);

      if (error) throw error;
      fetchRentals(selectedProperty.id);
      fetchRentalStats();
    } catch (error) {
      console.error('Error deleting rental:', error);
      alert(t('deleteError') || 'حدث خطأ أثناء الحذف');
    }
  };

  const handleMarkAsPaid = async (rental) => {
    try {
      const { error } = await supabase
        .from('rentals')
        .update({ payment_status: 'paid', last_status_update: new Date().toISOString().split('T')[0] })
        .eq('id', rental.id);

      if (error) throw error;
      fetchRentals(selectedProperty.id);
      fetchRentalStats();
    } catch (error) {
      console.error('Error marking as paid:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('rentals') || 'الإيجارات'}</h1>
      </div>

      {/* Grid العقارات */}
      {!selectedProperty ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Card
              key={property.id}
              className="hover:shadow-lg transition-all duration-300 border border-border"
              onClick={() => setSelectedProperty(property)}
            >
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
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{property.address}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{t('apartmentCount')}: {property.apartment_count || 0}</span>
                  </div>

                  {rentalStats[property.id] && (
                    <div className="mt-4 grid grid-cols-2 gap-3"> {/* زيادة التباعد */}
                      <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/10 rounded-lg"> {/* تحسين مظهر Badge */}
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> {/* زيادة حجم الأيقونة */}
                        <span className="text-xs font-medium truncate">{t('paid')}: {rentalStats[property.id].paid || 0}</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg"> {/* تحسين مظهر Badge */}
                        <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" /> {/* زيادة حجم الأيقونة */}
                        <span className="text-xs font-medium truncate">{t('dueSoon')}: {rentalStats[property.id].due_soon || 0}</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/10 rounded-lg"> {/* تحسين مظهر Badge */}
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" /> {/* زيادة حجم الأيقونة */}
                        <span className="text-xs font-medium truncate">{t('overdue')}: {rentalStats[property.id].overdue || 0}</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg"> {/* تحسين مظهر Badge */}
                        <XCircle className="h-4 w-4 text-blue-500 flex-shrink-0" /> {/* زيادة حجم الأيقونة */}
                        <span className="text-xs font-medium truncate">{t('pending')}: {rentalStats[property.id].pending || 0}</span>
                      </div>
                    </div>
                  )}


                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedProperty(property)}
                    >
                      {t('viewApartments')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* رأس العقار المحدد */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Building2 className="h-6 w-6 text-black dark:text-gray-200 flex-shrink-0" />
                    <span className="truncate">{selectedProperty.name}</span>
                  </h2>
                  <p className="text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-4 w-4 flex-shrink-0" /> <span className="truncate">{selectedProperty.address}</span>
                  </p>
                  <Badge variant="secondary" className="capitalize mt-1 inline-block">
                    {selectedProperty.type}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <Dialog open={dialogOpen} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                      setEditingRental(null);
                      setFormData({
                        apartmentNumber: '',
                        contractNumber: '',
                        tenantName: '',
                        tenantPhone: '',
                        startDate: '',
                        endDate: '',
                        paymentDueDate: '',
                        monthlyRent: '',
                        isRented: false,
                        lease_contract_path: '',
                      });
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button className="h-10 text-base">
                        <Plus className="mr-2 h-4 w-4" />
                        {t('addApartment') || 'إضافة شقة'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[700px] max-h-[90vh] overflow-y-auto p-6">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-semibold">
                          {editingRental ? t('editApartment') : t('addApartment')}
                        </DialogTitle>
                        <DialogDescription>
                          {editingRental
                            ? t('fillRentalInfoEdit') || 'تعديل بيانات الشقة وعقد الإيجار.'
                            : t('fillRentalInfo') || 'إضافة بيانات الشقة ورفع عقد الإيجار.'
                          }
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="apartmentNumber" className="flex items-center gap-1">
                              <Key className="h-4 w-4" /> {t('apartmentNumber') || 'رقم الشقة'} *
                            </Label>
                            <Input
                              id="apartmentNumber"
                              value={formData.apartmentNumber}
                              onChange={(e) => setFormData({ ...formData, apartmentNumber: e.target.value })}
                              required
                              className="h-10 text-base"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="contractNumber" className="flex items-center gap-1">
                              <FileText className="h-4 w-4" /> {t('contractNumber') || 'رقم العقد'}
                            </Label>
                            <Input
                              id="contractNumber"
                              value={formData.contractNumber}
                              onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                              className="h-10 text-base bg-gray-50 dark:bg-gray-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tenantName" className="flex items-center gap-1">
                              <User className="h-4 w-4" /> {t('tenantName') || 'اسم المستأجر'}
                            </Label>
                            <Input
                              id="tenantName"
                              value={formData.tenantName}
                              onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                              className="h-10 text-base bg-gray-50 dark:bg-gray-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tenantPhone" className="flex items-center gap-1">
                              <Phone className="h-4 w-4" /> {t('tenantPhone') || 'هاتف المستأجر'}
                            </Label>
                            <Input
                              id="tenantPhone"
                              value={formData.tenantPhone}
                              onChange={(e) => setFormData({ ...formData, tenantPhone: e.target.value })}
                              className="h-10 text-base bg-gray-50 dark:bg-gray-800"
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="startDate" className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" /> {t('startDate') || 'تاريخ البداية'}
                            </Label>
                            <Input
                              id="startDate"
                              type="date"
                              value={formData.startDate}
                              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                              className="h-10 text-base bg-gray-50 dark:bg-gray-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="endDate" className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" /> {t('endDate') || 'تاريخ النهاية'}
                            </Label>
                            <Input
                              id="endDate"
                              type="date"
                              value={formData.endDate}
                              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                              className="h-10 text-base bg-gray-50 dark:bg-gray-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="paymentDueDate" className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" /> {t('paymentDueDate') || 'تاريخ استحقاق الدفع'}
                            </Label>
                            <Input
                              id="paymentDueDate"
                              type="date"
                              value={formData.paymentDueDate}
                              onChange={(e) => setFormData({ ...formData, paymentDueDate: e.target.value })}
                              className="h-10 text-base bg-gray-50 dark:bg-gray-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="monthlyRent" className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" /> {t('monthlyRent') || 'الإيجار الشهري'}
                            </Label>
                            <Input
                              id="monthlyRent"
                              type="number"
                              step="0.01"
                              value={formData.monthlyRent}
                              onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
                              className="h-10 text-base bg-gray-50 dark:bg-gray-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="isRented" className="flex items-center gap-1">
                              {t('rentalStatus') || 'حالة الإيجار'}
                            </Label>
                            <Select
                              value={formData.isRented.toString()}
                              onValueChange={(value) => setFormData({ ...formData, isRented: value === 'true' })}
                            >
                              <SelectTrigger className="h-10 text-base">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">{t('rented') || 'مؤجرة'}</SelectItem>
                                <SelectItem value="false">{t('vacant') || 'شاغرة'}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="lease_contract_path">{t('leaseContract') || 'عقد الإيجار'}</Label>
                          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                            <div className="space-y-2">
                              <Input
                                id="lease_contract_path"
                                type="file"
                                onChange={(e) => handleFileChange(e, 'lease_contract_path')}
                              />
                              {formData.lease_contract_path && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Eye className="h-4 w-4 text-blue-500" />
                                  <a href={formData.lease_contract_path} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">
                                    {t('viewFile') || 'عرض الملف'}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <DialogFooter className="md:col-span-2 pt-4">
                          <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-9 text-sm">
                            {t('cancel')}
                          </Button>
                          <Button type="submit" className="h-9 text-sm">
                            {t('save')}
                          </Button>
                        </DialogFooter>
                      </form>

                      {showUploadSuccess && (
                        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                          <CheckCircle className="h-5 w-5" />
                          <span>{t('fileUploadedSuccessfully') || 'تم رفع الملف بنجاح!'}</span>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" onClick={() => setSelectedProperty(null)} className="h-10 text-base">
                    {t('back') || 'رجوع'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* جدول الشقق */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <Key className="h-6 w-6 text-black dark:text-gray-200" />
                {t('apartments') || 'الشقق'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                      <TableHead className="text-center">{t('status') || 'حالة الدفع'}</TableHead>
                      <TableHead className="text-center">{t('rentalStatus') || 'حالة الإيجار'}</TableHead>
                      <TableHead className="text-center">{t('apartmentNumber')}</TableHead>
                      <TableHead className="text-center">{t('contractNumber')}</TableHead>
                      <TableHead className="text-center">{t('tenantName')}</TableHead>
                      <TableHead className="text-center">{t('startDate')}</TableHead>
                      <TableHead className="text-center">{t('endDate')}</TableHead>
                      <TableHead className="text-center">{t('paymentDueDate')}</TableHead>
                      <TableHead className="text-center">{t('monthlyRent')}</TableHead>
                      <TableHead className="text-center">{t('leaseContract') || 'عقد الإيجار'}</TableHead>
                      <TableHead className="text-center">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentals.length > 0 ? (
                      rentals.map((rental) => (
                        <TableRow
                          key={rental.id}
                          className={`${getRowBgColor(rental.payment_status, rental.is_rented)} hover:bg-opacity-70 dark:hover:bg-opacity-50 transition-colors duration-150`}
                        >
                          <TableCell className="text-center align-middle">
                            <div className="flex flex-col items-center justify-center">
                              <div className="flex items-center gap-1 mb-1">
                                {getStatusIcon(rental.payment_status)}
                                <span className="text-sm font-medium">
                                  {rental.payment_status === 'overdue' && (t('overdue') || 'متأخر')}
                                  {rental.payment_status === 'due_soon' && (t('dueSoon') || 'قريب')}
                                  {rental.payment_status === 'paid' && (t('paid') || 'مدفوع')}
                                  {rental.payment_status === 'pending' && (t('pending') || 'بالانتظار')}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            <Badge className={`rounded-full text-xs font-medium ${getStatusColor(null, rental.is_rented)}`}>
                              {rental.is_rented ? t('rented') : t('vacant')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center align-middle font-medium text-lg">{rental.apartment_number}</TableCell>
                          <TableCell className="text-center align-middle">{rental.contract_number || '-'}</TableCell>
                          <TableCell className="text-center align-middle truncate max-w-[100px]">{rental.tenant_name || '-'}</TableCell>
                          <TableCell className="text-center align-middle">
                            {rental.start_date
                              ? format(parseISO(rental.start_date), 'dd/MM/yyyy', { locale: ar })
                              : '-'}
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            {rental.end_date
                              ? format(parseISO(rental.end_date), 'dd/MM/yyyy', { locale: ar })
                              : '-'}
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            {rental.payment_due_date
                              ? format(parseISO(rental.payment_due_date), 'dd/MM/yyyy', { locale: ar })
                              : '-'}
                          </TableCell>
                          <TableCell className="text-center align-middle font-bold text-lg">
                            {rental.monthly_rent ? new Intl.NumberFormat('ar-SA').format(parseFloat(rental.monthly_rent)) : '0.00'} {t('currency') || 'ر.س'}
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            {rental.lease_contract_path ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleDownload(
                                    rental.lease_contract_path,
                                    `عقد_الإيجار_${rental.apartment_number}.${rental.lease_contract_path.split('.').pop().split('?')[0]}`
                                  )
                                }
                                className="flex items-center gap-1 text-xs"
                              >
                                <Download className="h-3 w-3" />
                                {t('downloadContract') || 'تحميل'}
                              </Button>
                            ) : (
                              <span className="text-xs text-gray-500">{t('noContract') || 'لا يوجد'}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            <div className="flex flex-wrap justify-center gap-2">
                              {rental.is_rented && rental.payment_due_date && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 h-9 text-sm"
                                  onClick={() => handleMarkAsPaid(rental)}
                                >
                                  {t('markAsPaid') || 'تم السداد'}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="hover:bg-blue-50 dark:hover:bg-blue-900/20 h-9 text-sm"
                                onClick={() => handleEdit(rental)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive hover:bg-red-50 dark:hover:bg-red-900/20 h-9 text-sm"
                                onClick={() => handleDelete(rental.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-12">
                          <div className="flex flex-col items-center">
                            <Key className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-medium">{t('noData')}</h3>
                            <p className="text-sm text-muted-foreground mt-2">
                              {t('noApartmentsFound') || 'لم يتم العثور على شقق'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}