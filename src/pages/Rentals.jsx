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
import { Building2, Key, Plus, Edit, Trash2, CheckCircle, XCircle, AlertTriangle, Calendar, User, FileText, Phone, DollarSign, MapPin, Users, Download, Eye, ChevronRight, ChevronLeft, CalendarDays, Clock } from 'lucide-react';
import { format, parseISO, differenceInDays, addMonths } from 'date-fns';
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

  const [paymentSchedule, setPaymentSchedule] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleRental, setScheduleRental] = useState(null);
  const [scheduleYear, setScheduleYear] = useState(new Date().getFullYear());

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

    const allowedExtensions = /\.(jpg|jpeg|png|pdf|docx)$/i;
    if (!file.name.match(allowedExtensions)) {
      alert("صيغة الملف غير مدعومة. المسموح: JPG, PNG, PDF, DOCX");
      return;
    }

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
      if (!response.ok) {
        if (response.status === 404) {
          alert(t('fileNotFound') || 'الملف غير موجود');
          return;
        }
        throw new Error('Download failed');
      }

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
        result = await supabase.from('rentals').update(rentalData).eq('id', editingRental.id).select();
      } else {
        result = await supabase.from('rentals').insert([rentalData]).select();
      }

      if (result.error) throw result.error;
      const savedRental = result.data[0];

      if (!editingRental && savedRental.start_date && savedRental.end_date && savedRental.monthly_rent > 0) {
        const start = parseISO(savedRental.start_date);
        const end = parseISO(savedRental.end_date);
        const months = Math.ceil(differenceInDays(end, start) / 30);
        if (months > 0) {
          const scheduleInputs = [];
          for (let i = 0; i < months; i++) {
            scheduleInputs.push({
              rental_id: savedRental.id,
              month_index: i + 1,
              expected_amount: savedRental.monthly_rent,
              paid_amount: 0,
              month_date: format(addMonths(start, i), 'yyyy-MM-dd')
            });
          }
          await supabase.from('rental_payments').insert(scheduleInputs);
        }
      }

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

  const fetchPaymentSchedule = async (rentalId) => {
    setLoadingSchedule(true);
    try {
      const { data, error } = await supabase
        .from('rental_payments')
        .select('*')
        .eq('rental_id', rentalId)
        .order('month_index', { ascending: true });
      if (error) throw error;
      setPaymentSchedule(data || []);
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleGenerateSchedule = async () => {
    if (!scheduleRental || !scheduleRental.start_date || !scheduleRental.end_date || !scheduleRental.monthly_rent) {
      alert(t('missingDatesOrRent') || 'يجب اكتمال بيانات وتواريخ العقد لتوليد الجدولة');
      return;
    }
    const start = parseISO(scheduleRental.start_date);
    const end = parseISO(scheduleRental.end_date);
    const months = Math.ceil(differenceInDays(end, start) / 30);
    if (months <= 0) {
      alert(t('invalidDates') || 'تاريخ النهاية يجب أن يكون بعد البداية');
      return;
    }

    setLoadingSchedule(true);
    const scheduleInputs = [];
    for (let i = 0; i < months; i++) {
      scheduleInputs.push({
        rental_id: scheduleRental.id,
        month_index: i + 1,
        expected_amount: scheduleRental.monthly_rent,
        paid_amount: 0,
        month_date: format(addMonths(start, i), 'yyyy-MM-dd')
      });
    }
    try {
      const { error } = await supabase.from('rental_payments').insert(scheduleInputs);
      if (error) throw error;
      fetchPaymentSchedule(scheduleRental.id);
    } catch (err) {
      console.error('Error generating schedule:', err);
      alert(t('saveError') || 'حدث خطأ أثناء حفظ الجدولة');
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleUpdatePayment = async (paymentId, newPaidAmount) => {
    try {
      const { error } = await supabase.from('rental_payments').update({ paid_amount: newPaidAmount }).eq('id', paymentId);
      if (error) throw error;
      if (scheduleRental) {
        fetchPaymentSchedule(scheduleRental.id);
      }
    } catch (err) {
      console.error('Error updating payment:', err);
      alert(t('saveError') || 'حدث خطأ أثناء التحديث');
    }
  };

  const handleEdit = (rental) => {
    setEditingRental(rental);
    fetchPaymentSchedule(rental.id);
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
                                accept=".jpg,.jpeg,.png,.docx,.pdf,image/jpeg,image/png,application/pdf"
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
            <CardContent className="p-0 md:p-6">
              <div className="overflow-x-auto">
                <Table className="min-w-full hidden md:table">
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
                          <TableCell className="text-center align-middle">
                            <div className="flex flex-col items-center justify-center">
                              <span className="truncate max-w-[150px]">{rental.tenant_name || '-'}</span>
                              {rental.tenant_phone && (
                                <span className="text-xs text-gray-500 mt-0.5" dir="ltr">{rental.tenant_phone}</span>
                              )}
                            </div>
                          </TableCell>
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
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-indigo-600 border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 h-9 text-sm"
                                onClick={() => {
                                  setScheduleRental(rental);
                                  setScheduleYear(new Date(rental.start_date || new Date()).getFullYear());
                                  setScheduleDialogOpen(true);
                                  fetchPaymentSchedule(rental.id);
                                }}
                                title={t('paymentSchedule') || 'جدولة الدفعات'}
                              >
                                <CalendarDays className="h-4 w-4" />
                              </Button>
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

                {/* Mobile View for Rentals List */}
                <div className="md:hidden grid gap-4 p-4">
                  {rentals.length > 0 ? (
                    rentals.map((rental) => (
                      <Card key={rental.id} className={`${getRowBgColor(rental.payment_status, rental.is_rented)} overflow-hidden border`}>
                        <div className={`h-1.5 w-full ${rental.is_rented ? (rental.payment_status === 'paid' ? 'bg-green-500' : rental.payment_status === 'overdue' ? 'bg-red-500' : rental.payment_status === 'due_soon' ? 'bg-yellow-500' : 'bg-blue-500') : 'bg-gray-300'}`} />
                        <CardContent className="p-4 space-y-4 shadow-sm">
                          {/* Top Row: Apt & Badges */}
                          <div className="flex flex-col gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                  {t('apartmentNumber')} {rental.apartment_number}
                                </div>
                                <div className="flex flex-col mt-1 gap-1">
                                  <div className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
                                    <User className="h-4 w-4" />
                                    {rental.tenant_name || <span className="italic">{t('noData')}</span>}
                                  </div>
                                  {rental.tenant_phone && (
                                    <div className="text-xs font-semibold text-gray-400 flex items-center gap-1.5" dir="ltr">
                                      <Phone className="h-3 w-3" />
                                      {rental.tenant_phone}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 items-end">
                                <Badge variant="outline" className={`text-[11px] font-bold ${rental.is_rented ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                                  }`}>
                                  {rental.is_rented ? t('rented') : t('vacant')}
                                </Badge>
                                <Badge variant="outline" className={`text-[11px] font-bold flex items-center gap-1 ${rental.payment_status === 'overdue' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' :
                                  rental.payment_status === 'due_soon' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800' :
                                    rental.payment_status === 'paid' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' :
                                      'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                                  }`}>
                                  {getStatusIcon(rental.payment_status)}
                                  <span>
                                    {rental.payment_status === 'overdue' && (t('overdue') || 'متأخر')}
                                    {rental.payment_status === 'due_soon' && (t('dueSoon') || 'قريب الاستحقاق')}
                                    {rental.payment_status === 'paid' && (t('paid') || 'مدفوع')}
                                    {rental.payment_status === 'pending' && (t('pending') || 'بالانتظار')}
                                  </span>
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Financial Row */}
                          <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                            <div className="flex flex-col">
                              <span className="text-[11px] text-gray-500 font-medium">{t('monthlyRent')}</span>
                              <span className="text-lg font-black text-indigo-700 dark:text-indigo-400 mt-0.5">
                                {rental.monthly_rent ? new Intl.NumberFormat('ar-SA').format(parseFloat(rental.monthly_rent)) : '0.00'} <span className="text-xs font-medium">{t('currency') || 'ر.س'}</span>
                              </span>
                            </div>
                            {rental.payment_due_date && (
                              <div className="flex flex-col items-end">
                                <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-gray-400" />
                                  {t('paymentDueDate') || 'تاريخ الاستحقاق'}
                                </span>
                                <div className="font-bold text-gray-800 dark:text-gray-200 mt-0.5">
                                  {format(parseISO(rental.payment_due_date), 'dd/MM/yyyy', { locale: ar })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Dates Grid */}
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex flex-col bg-white dark:bg-gray-950 p-2.5 rounded-md border border-gray-100 dark:border-gray-800 shadow-sm">
                              <span className="text-gray-500 text-[10px] font-medium">{t('startDate')}</span>
                              <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 mt-1">
                                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                                {rental.start_date ? format(parseISO(rental.start_date), 'dd/MM/yyyy', { locale: ar }) : '-'}
                              </div>
                            </div>
                            <div className="flex flex-col bg-white dark:bg-gray-950 p-2.5 rounded-md border border-gray-100 dark:border-gray-800 shadow-sm">
                              <span className="text-gray-500 text-[10px] font-medium">{t('endDate')}</span>
                              <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 mt-1">
                                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                                {rental.end_date ? format(parseISO(rental.end_date), 'dd/MM/yyyy', { locale: ar }) : '-'}
                              </div>
                            </div>
                          </div>

                          {/* Actions Row */}
                          <div className="pt-3 border-t flex flex-wrap gap-2 justify-end items-center">
                            {rental.is_rented && rental.payment_due_date && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-700 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 shadow-sm flex-1 md:flex-none"
                                onClick={() => handleMarkAsPaid(rental)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1 rtl:ml-1 rtl:mr-0" />
                                {t('markAsPaid') || 'تم السداد'}
                              </Button>
                            )}

                            {rental.lease_contract_path && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleDownload(
                                    rental.lease_contract_path,
                                    `عقد_الإيجار_${rental.apartment_number}.${rental.lease_contract_path.split('.').pop().split('?')[0]}`
                                  )
                                }
                                className="text-blue-700 border-blue-200 hover:bg-blue-50 shadow-sm px-3"
                                title={t('downloadContract') || 'تحميل العقد'}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}

                            <div className="flex gap-2 w-full sm:w-auto">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 shadow-sm flex-1"
                                onClick={() => {
                                  setScheduleRental(rental);
                                  setScheduleYear(new Date(rental.start_date || new Date()).getFullYear());
                                  setScheduleDialogOpen(true);
                                  fetchPaymentSchedule(rental.id);
                                }}
                              >
                                <CalendarDays className="h-4 w-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                                {t('paymentSchedule') || 'الجدولة'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-gray-700 border-gray-200 hover:bg-gray-100 shadow-sm px-3"
                                onClick={() => handleEdit(rental)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50 shadow-sm px-3"
                                onClick={() => handleDelete(rental.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="flex flex-col items-center py-12 text-center bg-gray-50 dark:bg-gray-800/30 rounded-lg">
                      <Key className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-medium">{t('noData')}</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        {t('noApartmentsFound') || 'لم يتم العثور على شقق'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Standalone Payment Schedule Dialog */}
      <Dialog
        open={scheduleDialogOpen}
        onOpenChange={(open) => {
          setScheduleDialogOpen(open);
          if (!open) {
            setScheduleRental(null);
            setPaymentSchedule([]);
          }
        }}
      >
        <DialogContent className="max-w-[90vw] md:max-w-4xl w-full max-h-[90vh] overflow-y-auto p-4 md:p-6 [&>button.absolute]:hidden md:[&>button.absolute]:flex" dir={document.documentElement.dir || 'rtl'}>
          {scheduleRental && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex justify-between items-start w-full md:w-auto">
                    <div>
                      <DialogTitle className="text-xl md:text-2xl font-bold flex items-center gap-2">
                        <CalendarDays className="h-6 w-6 text-indigo-500" />
                        {t('paymentSchedule') || 'جدولة الدفعات'} - {t('apartmentNumber')} {scheduleRental.apartment_number}
                      </DialogTitle>
                      <DialogDescription className="mt-2 text-base">
                        {scheduleRental.tenant_name || t('vacant')} | {scheduleRental.monthly_rent} {t('currency') || 'ر.س'} / {t('monthly') || 'شهرياً'}
                      </DialogDescription>
                    </div>
                    {/* Explicit Mobile Close Button */}
                    <Button
                      variant="outline"
                      onClick={() => setScheduleDialogOpen(false)}
                      className="md:hidden flex-shrink-0 ml-4 rtl:ml-0 rtl:mr-4 h-9 px-3 bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700"
                    >
                      <XCircle className="h-4 w-4 mr-1 rtl:ml-1 rtl:mr-0" /> {t('close') || 'إغلاق'}
                    </Button>
                  </div>

                  {/* Year Navigation */}
                  {paymentSchedule.length > 0 && (
                    <div className="flex items-center bg-gray-50 dark:bg-gray-800/50 p-1.5 rounded-lg border w-full md:w-auto shrink-0 justify-between md:justify-start gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScheduleYear(y => y - 1)}>
                        {document.documentElement.dir === 'ltr' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                      <div className="text-lg font-bold min-w-[60px] text-center">{scheduleYear}</div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScheduleYear(y => y + 1)}>
                        {document.documentElement.dir === 'ltr' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>
              </DialogHeader>

              {/* Generate Button if empty */}
              {paymentSchedule.length === 0 && !loadingSchedule && (
                <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed flex flex-col items-center justify-center">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-full mb-4">
                    <CalendarDays className="h-10 w-10 text-indigo-500" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t('noScheduleFound') || 'لا توجد دفعات مجدولة'}</h3>
                  <p className="text-gray-500 mb-6 max-w-sm px-4 text-center">
                    {t('scheduleEmptyDesc') || 'قم بتوليد الجدولة الزمنية تلقائياً بناءً على تاريخ بداية ونهاية العقد للإيجار الشهري.'}
                  </p>
                  <Button
                    onClick={handleGenerateSchedule}
                    size="lg"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Plus className="mr-2 h-5 w-5 rtl:ml-2 rtl:mr-0" />
                    {t('generateSchedule') || 'توليد الجدولة الآن'}
                  </Button>
                </div>
              )}

              {/* Content */}
              {loadingSchedule ? (
                <div className="py-16 text-center text-muted-foreground animate-pulse">{t('loading')}...</div>
              ) : paymentSchedule.length > 0 ? (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto border rounded-xl shadow-sm bg-white dark:bg-gray-900">
                    <Table>
                      <TableHeader className="bg-gray-50 dark:bg-gray-800">
                        <TableRow>
                          <TableHead className="text-center font-semibold">{t('month') || 'الشهر'}</TableHead>
                          <TableHead className="text-center font-semibold">{t('dueDate') || 'تاريخ الاستحقاق'}</TableHead>
                          <TableHead className="text-center font-semibold">{t('expectedAmount') || 'المبلغ المستحق'}</TableHead>
                          <TableHead className="text-center font-semibold">{t('paidAmount') || 'المبلغ المدفوع'}</TableHead>
                          <TableHead className="text-center font-semibold">{t('status') || 'الحالة'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentSchedule
                          .filter(p => new Date(p.month_date).getFullYear() === scheduleYear)
                          .map((payment) => {
                            const isPaid = payment.paid_amount >= payment.expected_amount;
                            return (
                              <TableRow key={payment.id} className={isPaid ? 'bg-green-50/30 hover:bg-green-50/50' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}>
                                <TableCell className="text-center font-bold text-gray-700 dark:text-gray-300">{payment.month_index}</TableCell>
                                <TableCell className="text-center font-medium">
                                  {format(parseISO(payment.month_date), 'dd/MM/yyyy', { locale: ar })}
                                </TableCell>
                                <TableCell className="text-center text-gray-600 dark:text-gray-400 font-medium">
                                  {payment.expected_amount} {t('currency') || 'ر.س'}
                                </TableCell>
                                <TableCell className="text-center text-gray-500 min-w-[140px]">
                                  <div className="flex justify-center">
                                    <Input
                                      type="number"
                                      min="0"
                                      max={payment.expected_amount}
                                      className="h-10 w-32 justify-center text-center font-semibold bg-white dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500"
                                      defaultValue={payment.paid_amount}
                                      onBlur={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (val !== parseFloat(payment.paid_amount) && !isNaN(val)) {
                                          handleUpdatePayment(payment.id, Math.min(val, payment.expected_amount));
                                        }
                                      }}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {isPaid ? (
                                    <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200 py-1 px-3">
                                      <CheckCircle className="h-3.5 w-3.5 mr-1 rtl:ml-1 rtl:mr-0" />
                                      {t('paid') || 'مدفوع'}
                                    </Badge>
                                  ) : payment.paid_amount > 0 ? (
                                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 py-1 px-3">
                                      <AlertTriangle className="h-3.5 w-3.5 mr-1 rtl:ml-1 rtl:mr-0" />
                                      {t('partialPayment') || 'مدفوع جزئياً'}
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200 py-1 px-3">
                                      <XCircle className="h-3.5 w-3.5 mr-1 rtl:ml-1 rtl:mr-0" />
                                      {t('unpaid') || 'غير مدفوع'}
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        {paymentSchedule.filter(p => new Date(p.month_date).getFullYear() === scheduleYear).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground bg-gray-50/50">
                              {t('noDataForYear') || 'لا توجد دفعات مسجلة لهذا العام.'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="grid md:hidden gap-4 pb-6">
                    {paymentSchedule
                      .filter(p => new Date(p.month_date).getFullYear() === scheduleYear)
                      .map((payment) => {
                        const isPaid = payment.paid_amount >= payment.expected_amount;
                        return (
                          <Card key={payment.id} className={`shadow-sm overflow-hidden ${isPaid ? 'border-green-200' : ''}`}>
                            <div className={`h-1.5 w-full ${isPaid ? 'bg-green-400' : payment.paid_amount > 0 ? 'bg-yellow-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                            <CardContent className={`p-4 space-y-4 ${isPaid ? 'bg-green-50/30' : ''}`}>
                              <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
                                <div className="flex gap-2 items-center">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 font-bold text-gray-700 dark:text-gray-300 text-sm">
                                    {payment.month_index}
                                  </span>
                                  <span className="font-bold text-lg text-indigo-700 dark:text-indigo-400">
                                    {format(parseISO(payment.month_date), 'dd/MM/yyyy', { locale: ar })}
                                  </span>
                                </div>
                                {isPaid ? (
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                                    {t('paid') || 'مدفوع'}
                                  </Badge>
                                ) : payment.paid_amount > 0 ? (
                                  <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                                    {t('partialPayment') || 'جزئي'}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">
                                    {t('unpaid') || 'غير مدفوع'}
                                  </Badge>
                                )}
                              </div>

                              <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-gray-500 font-medium">{t('expectedAmount') || 'المستحق'}:</span>
                                  <span className="font-bold text-gray-900 dark:text-white">{payment.expected_amount} {t('currency') || 'ر.س'}</span>
                                </div>

                                <div className="flex justify-between items-center text-sm bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
                                  <span className="text-gray-600 dark:text-gray-400 font-medium">{t('paidAmount') || 'المدفوع'}:</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    max={payment.expected_amount}
                                    className="h-10 w-28 text-center font-bold bg-white dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 shadow-sm border-gray-200"
                                    defaultValue={payment.paid_amount}
                                    onBlur={(e) => {
                                      const val = parseFloat(e.target.value);
                                      if (val !== parseFloat(payment.paid_amount) && !isNaN(val)) {
                                        handleUpdatePayment(payment.id, Math.min(val, payment.expected_amount));
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    {paymentSchedule.filter(p => new Date(p.month_date).getFullYear() === scheduleYear).length === 0 && (
                      <div className="text-center py-10 text-muted-foreground border border-dashed rounded-xl bg-gray-50/50 dark:bg-gray-800/30">
                        {t('noDataForYear') || 'لا توجد دفعات مسجلة لهذا العام.'}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}