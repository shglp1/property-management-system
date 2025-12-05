
// src/pages/CustodySystem.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DollarSign,
    Building2,
    Users,
    TrendingUp,
    TrendingDown,
    Wallet,
    FileText,
    Plus,
    RefreshCw,
    AlertCircle,
    User,
    Eye,
    Search,
    Filter,
    ArrowUpDown,
    ChevronDown,
    Loader2,
    LogOut,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const BUCKET_NAME = 'transaction_attachments';

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

export default function CustodySystem() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const isRTL = i18n.language === 'ar';
    const dateLocale = isRTL ? ar : enUS;
    const [userRole, setUserRole] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'email', direction: 'asc' }); // Default to email
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);


    // بيانات العهدة ومصروفات المستخدم (للمدير)
    const [myCustodyData, setMyCustodyData] = useState({
        custodyAmount: 0,
        totalExpenses: 0,
        remaining: 0,
    });
    const [myCustodyTransactions, setMyCustodyTransactions] = useState([]);
    // مصروفات جميع الموظفين (للأدمن) - من جدول transactions
    const [allCustodyTransactions, setAllCustodyTransactions] = useState([]);
    // جميع عهد الموظفين (للأدمن) - من جدول custody_system
    const [allEmployeeCustodies, setAllEmployeeCustodies] = useState([]);
    const [filteredCustodies, setFilteredCustodies] = useState([]);
    const [allUsers, setAllUsers] = useState([]); // To get user emails
    // حالة التحميل
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    // حوارات الإضافة
    const [custodyDialogOpen, setCustodyDialogOpen] = useState(false);
    const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
    const [properties, setProperties] = useState([]);
    // نموذج إضافة/تحديث عهدة (للأدمن)
    const [newCustody, setNewCustody] = useState({ user_id: '', amount: '' });
    // نموذج إضافة مصروف/دخل (للأدمن)
    const [newTransaction, setNewTransaction] = useState({
        type: 'expense',
        source_type: 'custody', // مخصص للعهدة
        amount: '',
        property_id: '',
        description: '',
        attachment: null,
    });
    const [selectedFile, setSelectedFile] = useState(null);

    const [myCurrentPage, setMyCurrentPage] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const transactionsPerPage = 10;


    const totalMyPages = Math.ceil(myCustodyTransactions.length / transactionsPerPage);
    const indexOfLast = myCurrentPage * transactionsPerPage;
    const indexOfFirst = indexOfLast - transactionsPerPage;
    const currentMyTransactions = myCustodyTransactions.slice(indexOfFirst, indexOfLast);


    // -------------------------------- Effects --------------------------------
    useEffect(() => {
        if (!user) return;
        fetchUserRole();
        fetchProperties();
        fetchAllUsers();
    }, [user]);

    useEffect(() => {
        if (!userRole || !user) return;
        if (userRole === 'admin') {
            fetchAllCustodyData();
        } else {
            // For non-admin users, fetch only their data (though they shouldn't be here)
            fetchMyCustodyData();
        }
    }, [userRole]);

    useEffect(() => {
        filterAndSortCustodies();
    }, [allEmployeeCustodies, searchTerm, filterStatus, sortConfig]);

    // -------------------------------- Fetches --------------------------------
    const fetchUserRole = async () => {
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) throw userError || new Error("No authenticated user found");
            const { data, error } = await supabase
                .from("app_users")
                .select("role")
                .eq("id", user.id)
                .maybeSingle();
            if (error) throw error;
            setUserRole(data?.role || "employee");
        } catch (err) {
            console.error("Error fetching role:", err);
            setUserRole("employee"); // safe default
        }
    };

    const fetchAllUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('app_users')
                .select('id, email');

            if (error) throw error;

            const visibleUsers = data.filter(
                (u) => u.role !== 'admin' || u.id === user.id
            );

            setAllUsers(visibleUsers);
        } catch (error) {
            console.error("Error fetching all users:", error);
        }
    };


    const fetchProperties = async () => {
        try {
            const { data, error } = await supabase
                .from("properties")
                .select("id, name")
                .order("name");
            if (error) throw error;
            setProperties(data || []);
        } catch (error) {
            console.error("Error fetching properties:", error);
        }
    };

    const fetchAllCustodyData = useCallback(async () => {
        setLoading(true);
        setIsRefreshing(true);
        try {
            const { data: custodies, error: custodyErr } = await supabase
                .from('custody_system')
                .select(`
    id,
    user_id,
    custody_amount,
    total_expenses,
    remaining_balance,
    last_reset_date,
    updated_at,
    app_users:app_users!custody_system_user_id_fkey(email)
  `);

            if (custodyErr) throw custodyErr;

            // 2. Fetch all custody transactions for all users
            const { data: transactions, error: transErr } = await supabase
                .from('transactions')
                .select(`
    *,
    app_users:app_users!transactions_user_id_fkey(email),
    properties(name)
  `)
                .eq('source_type', 'custody')
                .order('date', { ascending: false });


            if (transErr) throw transErr;

            setAllCustodyTransactions(transactions || []);

            // 3. Map employee balances
            const employeeBalances = (custodies || []).map((custody) => ({
                id: custody.id,
                user_id: custody.user_id,
                email: custody.app_users?.email || 'Unknown',
                custodyAmount: Number(custody.custody_amount || 0),
                totalExpenses: Number(custody.total_expenses || 0),
                remaining: Number(custody.remaining_balance || 0),
                last_reset_date: custody.last_reset_date,
                updated_at: custody.updated_at,
            }));

            // 4. Calculate admin's own balances
            const myCustodyRecord = (custodies || []).find((c) => c.user_id === user.id);

            const myTotalGiven = Number(myCustodyRecord?.custody_amount || 0);
            const myTotalExpenses = Number(myCustodyRecord?.total_expenses || 0);
            const myRemaining = Number(myCustodyRecord?.remaining_balance || 0);

            setMyCustodyData({
                custodyAmount: myTotalGiven,
                totalExpenses: myTotalExpenses,
                remaining: myRemaining,
            });

            // جلب معاملات الأدمن فقط من جدول transactions
            const myTransactions = Array.isArray(transactions)
                ? transactions.filter(
                    (tx) => tx.user_id === user.id && tx.source_type === 'custody'
                )
                : [];

            setMyCustodyTransactions(myTransactions);

            setAllEmployeeCustodies(employeeBalances);
        } catch (err) {
            console.error('Error fetching custody data:', err);
            toast.error(t('errorFetchingData', 'حدث خطأ أثناء جلب بيانات النظام'));
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [user, t]);


    // Non-admin users shouldn't be here, but keeping this for completeness
    const fetchMyCustodyData = async () => {
        // ... (Simplified logic for non-admin, relying on transactions table)
        // This page is for admin, so this might not be needed.
    };

    // ------------------------------ Helper Functions ------------------------------
    const filterAndSortCustodies = useCallback(() => { // <-- useCallback for performance
        let filtered = [...allEmployeeCustodies];

        // تطبيق البحث
        if (searchTerm) {
            filtered = filtered.filter(c =>
                c.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // تطبيق التصفية
        if (filterStatus !== 'all') {
            if (filterStatus === 'overdrawn') {
                filtered = filtered.filter(c => c.remaining < 0);
            } else if (filterStatus === 'normal') {
                filtered = filtered.filter(c => c.remaining >= 0);
            }
        }

        // تطبيق الترتيب - الآن في الكود الأمامي
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        setFilteredCustodies(filtered);
    }, [allEmployeeCustodies, searchTerm, filterStatus, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? <ChevronDown className='h-4 w-4 inline' /> : <ArrowUpDown className='h-4 w-4 inline' />;
    };

    const getEmployeeEmail = (userId) => {
        return allUsers.find(u => u.id === userId)?.email || 'Unknown User';
    };

    // ------------------------------ Handlers ------------------------------
    const handleSetCustody = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const amount = parseFloat(newCustody.amount);
            if (!amount || amount <= 0) {
                toast.error(t("pleaseEnterValidAmount"));
                return;
            }
            if (!newCustody.user_id) {
                toast.error(t("pleaseSelectEmployee"));
                return;
            }

            // Update custody amount in custody_system
            // The DB trigger (reset_custody_on_update) should handle resetting total_expenses and remaining_balance
            const { data, error } = await supabase
                .from('custody_system')
                .upsert(
                    {
                        user_id: newCustody.user_id,
                        custody_amount: amount,
                        // total_expenses and remaining_balance will be reset by the DB trigger
                        // last_reset_date will be updated by the DB trigger
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'user_id' }
                )
                .select()
                .single();
            if (error) throw error;

            toast.success(t("custodyUpdatedSuccessfully"));
            setCustodyDialogOpen(false);
            fetchAllCustodyData(); // Refresh data to reflect DB changes
        } catch (error) {
            console.error("Error setting custody:", error);
            toast.error(t("errorSettingCustody"));
        } finally {
            setLoading(false);
        }
    };

    const handleAddTransaction = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const amount = parseFloat(newTransaction.amount);
            if (!amount || amount <= 0) {
                toast.error(t("pleaseEnterValidAmount"));
                return;
            }
            if (!newTransaction.property_id) {
                toast.error(t("pleaseSelectProperty"));
                return;
            }


            let attachmentPath = null;
            if (selectedFile) {
                const file = selectedFile;

                const ext = file.name.split(".").pop();
                const fileName = `${user.id}_${Date.now()}.${ext}`;

                const { data: uploadData, error: uploadError } = await supabase
                    .storage
                    .from("transaction_attachments")
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                attachmentPath = uploadData.path;
            }


            // Insert transaction for admin's own expenses
            const { error: insertError } = await supabase.from("transactions").insert([
                {
                    type: newTransaction.type,
                    // For admin's own expenses, amount sign depends on type
                    amount: newTransaction.type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
                    property_id: newTransaction.property_id,
                    description: newTransaction.description || null,
                    source_type: newTransaction.source_type, // 'custody'
                    user_id: user.id, // Admin's own ID
                    created_by: user.id,
                    has_attachments: !!attachmentPath,
                    attachment_path: attachmentPath,
                    date: new Date().toISOString(), // Ensure date column is set
                },
            ]);
            if (insertError) throw insertError;

            toast.success(t("transactionAddedSuccessfully"));
            setTransactionDialogOpen(false);
            fetchAllCustodyData(); // Refresh data
        } catch (err) {
            console.error("Error adding transaction:", err);
            toast.error(t("errorAddingTransaction"));
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (employeeCustody) => {
        // Find all transactions for this employee from the fetched list
        const employeeTransactions = allCustodyTransactions
            .filter(tx => tx.user_id === employeeCustody.user_id) // إصلاح 3: تغيير t إلى tx
            .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date)); // Prioritize date if available

        setSelectedEmployee({
            ...employeeCustody,
            transactions: employeeTransactions,
        });
        setShowDetailsDialog(true);
    };

    // ------------------------------ Render Helpers ------------------------------
    const renderEmployeeCustodyTable = () => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead onClick={() => requestSort('email')} className='cursor-pointer'>
                        {t("employee")} {getSortIcon('email')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('custodyAmount')} className='cursor-pointer'>
                        {t("custodyAmount")} {getSortIcon('custodyAmount')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('totalExpenses')} className='cursor-pointer'>
                        {t("totalExpenses")} {getSortIcon('totalExpenses')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('remaining')} className='cursor-pointer'>
                        {t("remaining")} {getSortIcon('remaining')}
                    </TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("lastUpdate")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredCustodies.map((c) => (
                    <TableRow key={c.user_id}>
                        <TableCell className="font-medium">{c.email}</TableCell>
                        <TableCell>{formatCurrency(c.custodyAmount)}</TableCell>
                        <TableCell>{formatCurrency(c.totalExpenses)}</TableCell>
                        <TableCell>
                            <span className={`font-bold ${c.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(c.remaining)}
                            </span>
                        </TableCell>
                        <TableCell>
                            <Badge variant={c.remaining >= 0 ? 'default' : 'destructive'}>
                                {c.remaining >= 0 ? t("normal") : t("overdrawn")}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            {c.updated_at ? format(parseISO(c.updated_at), 'dd MMMM yyyy', { locale: dateLocale }) : '-'}
                        </TableCell>
                        <TableCell>
                            <Button variant="outline" size="sm" onClick={() => handleViewDetails(c)}>
                                <Eye className="h-4 w-4" />
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );



  
    const renderAllEmployeeTransactionsTable = () => {
        // Pagination logic 
        const indexOfLast = currentPage * transactionsPerPage;
        const indexOfFirst = indexOfLast - transactionsPerPage;
        const currentTransactions = allCustodyTransactions.slice(indexOfFirst, indexOfLast);
        const totalPages = Math.ceil(allCustodyTransactions.length / transactionsPerPage);

        return (
            <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse border text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 border">{t("employee")}</th>
                            <th className="p-2 border">{t("date")}</th>
                            <th className="p-2 border">{t("description")}</th>
                            <th className="p-2 border">{t("property")}</th>
                            <th className="p-2 border">{t("amount")}</th>
                            <th className="p-2 border">{t("type")}</th>
                            <th className="p-2 border text-center">{t("attachment")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentTransactions.map((tx) => (
                            <tr key={tx.id} className={tx.type === "expense" ? "bg-red-50" : "bg-green-50"}>
                                <td className="p-2 border">{tx.app_users.email}</td>
                                <td className="p-2 border">
                                    {tx.date
                                        ? format(parseISO(tx.date), "dd/MM/yyyy", { locale: dateLocale })
                                        : tx.created_at
                                            ? format(parseISO(tx.created_at), "dd/MM/yyyy", { locale: dateLocale })
                                            : "-"}
                                </td>
                                <td className="p-2 border">{tx.description || "-"}</td>
                                <td className="p-2 border">{tx.properties?.name || t("custody")}</td>
                                <td className="p-2 border text-red-600 font-bold">
                                    {formatCurrency(Math.abs(tx.amount))}
                                </td>
                                <td className="p-2 border">{t(tx.type)}</td>
                                <td className="p-2 border text-center">
                                    {tx.has_attachments ? (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    if (!tx.attachment_path) {
                                                        toast.error("لا يوجد ملف مرفق");
                                                        return;
                                                    }
                                                    const fileName = tx.attachment_path.split("/").pop();
                                                    const fileUrl = `${supabase.storageUrl}/object/public/transaction_attachments/${fileName}`;
                                                    const response = await fetch(fileUrl);
                                                    if (!response.ok) throw new Error("Failed to fetch file");
                                                    const blob = await response.blob();
                                                    const blobUrl = window.URL.createObjectURL(blob);
                                                    const link = document.createElement("a");
                                                    link.href = blobUrl;
                                                    link.download = fileName;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                    window.URL.revokeObjectURL(blobUrl);
                                                } catch (err) {
                                                    console.error("Error downloading file:", err);
                                                    toast.error("حدث خطأ أثناء تنزيل الملف");
                                                }
                                            }}
                                            className="text-blue-600 hover:underline"
                                        >
                                            <FileText className="h-4 w-4 mx-auto" />
                                        </button>
                                    ) : (
                                        "-"
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex justify-center mt-4 space-x-2">
                        {Array.from({ length: totalPages }, (_, i) => (
                            <button
                                key={i + 1}
                                onClick={() => setCurrentPage(i + 1)}
                                className={`px-3 py-1 border rounded-md ${currentPage === i + 1
                                    ? "bg-blue-500 text-white"
                                    : "bg-white text-gray-700 hover:bg-gray-100"
                                    }`}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">{t("loading")}</p>
            </div>
        );
    }

    if (userRole !== 'admin') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t("accessDenied")}</AlertTitle>
                    <AlertDescription>{t("onlyAdminCanAccess")}</AlertDescription>
                </Alert>
                <Button onClick={signOut} className="mt-4">{t("logout")}</Button>
            </div>
        );
    }

    return (
        <div className="p-6" dir={isRTL ? "rtl" : "ltr"}>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-extrabold text-gray-900">{t("custodySystem")}</h1>
                <Button onClick={signOut} variant="outline" className="text-red-500 hover:bg-red-50 hover:text-red-600">
                    <LogOut className="h-5 w-5 me-2" />
                    {t("logout")}
                </Button>
            </div>
            <Tabs defaultValue="employee_custodies" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="employee_custodies">{t("employeeCustodies")}</TabsTrigger>
                    <TabsTrigger value="all_transactions">{t("allCustodyTransactions")}</TabsTrigger>
                    <TabsTrigger value="my_expenses">{t("myCustodyExpenses")}</TabsTrigger>
                </TabsList>
                {/* Tab 1: All Employee Custodies */}
                <TabsContent value="employee_custodies">
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t("allEmployeeCustodies")}</CardTitle>
                            <div className="flex items-center space-x-2">
                                <Button onClick={fetchAllCustodyData} disabled={isRefreshing} variant="outline" size="sm">
                                    {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    <span className="sr-only">{t("refresh")}</span>
                                </Button>
                                <Dialog open={custodyDialogOpen} onOpenChange={setCustodyDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button onClick={() => setNewCustody({ user_id: '', amount: '' })}>
                                            <Plus className="h-4 w-4 me-2" /> {t("setCustody")}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent> 
                                        <DialogHeader>
                                            <DialogTitle>{t("setCustodyAmount")}</DialogTitle>
                                            <DialogDescription>{t("fillAndSaveCustodyAmount")}</DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handleSetCustody} className="space-y-4">
                                            <div>
                                                <Label htmlFor="employee">{t("employee")}</Label>
                                                <Select
                                                    value={newCustody.user_id}
                                                    onValueChange={(v) => setNewCustody({ ...newCustody, user_id: v })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={t("selectEmployee")} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {allUsers.map(u => (
                                                            <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label htmlFor="amount">{t("amount")}</Label>
                                                <Input
                                                    id="amount"
                                                    type="number"
                                                    step="0.01"
                                                    value={newCustody.amount}
                                                    onChange={(e) => setNewCustody({ ...newCustody, amount: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <DialogFooter>
                                                <Button type="button" variant="outline" onClick={() => setCustodyDialogOpen(false)}>{t("cancel")}</Button>
                                                <Button type="submit" disabled={loading}>
                                                    {loading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                                                    {t("save")}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex space-x-2">
                                    <Input
                                        placeholder={t("searchEmployee")}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="max-w-sm"
                                    />
                                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder={t("filterByStatus")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">{t("allStatuses")}</SelectItem>
                                            <SelectItem value="normal">{t("normal")}</SelectItem>
                                            <SelectItem value="overdrawn">{t("overdrawn")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                                {renderEmployeeCustodyTable()}
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-4">
                                <Card className="p-4 border-l-4 border-blue-500">
                                    <p className="text-sm text-gray-500">{t("totalCustodyGiven")}</p>
                                    <p className="text-xl font-bold">{formatCurrency(allEmployeeCustodies.reduce((sum, c) => sum + Number(c.custodyAmount || 0), 0))}</p>
                                </Card>
                                <Card className="p-4 border-l-4 border-red-500">
                                    <p className="text-sm text-gray-500">{t("totalExpenses")}</p>
                                    <p className="text-xl font-bold">{formatCurrency(allEmployeeCustodies.reduce((sum, c) => sum + Number(c.totalExpenses || 0), 0))}</p>
                                </Card>
                                <Card className="p-4 border-l-4 border-green-500">
                                    <p className="text-sm text-gray-500">{t("totalRemaining")}</p>
                                    <p className="text-xl font-bold">{formatCurrency(allEmployeeCustodies.reduce((sum, c) => sum + Number(c.remaining || 0), 0))}</p>
                                </Card>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* Tab 2: All Custody Transactions */}
                <TabsContent value="all_transactions">
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t("allEmployeeTransactions")}</CardTitle>
                            <Button onClick={fetchAllCustodyData} disabled={isRefreshing} variant="outline" size="sm">
                                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                <span className="sr-only">{t("refresh")}</span>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-lg overflow-hidden">
                                {renderAllEmployeeTransactionsTable()}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* Tab 3: My Custody Expenses (Admin's own) */}
                <TabsContent value="my_expenses">
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t("myCustodyExpenses")}</CardTitle>
                            <div className="flex items-center space-x-2">
                                <Button onClick={fetchAllCustodyData} disabled={isRefreshing} variant="outline" size="sm">
                                    {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    <span className="sr-only">{t("refresh")}</span>
                                </Button>
                                <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button onClick={() => setNewTransaction({ type: 'expense', source_type: 'custody', amount: '', property_id: '', description: '', attachment: null })}>
                                            <Plus className="h-4 w-4 me-2" /> {t("addExpense")}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent> {/* إصلاح 2: إضافة DialogDescription */}
                                        <DialogHeader>
                                            <DialogTitle>{t("addMyCustodyExpense")}</DialogTitle>
                                            <DialogDescription>{t("fillAndSaveCustodyExpense")}</DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handleAddTransaction} className="space-y-4">
                                            <div>
                                                <Label htmlFor="property">{t("property")}</Label>
                                                <Select
                                                    value={newTransaction.property_id}
                                                    onValueChange={(v) => setNewTransaction({ ...newTransaction, property_id: v })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={t("selectProperty")} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {properties.map((p) => (
                                                            <SelectItem key={p.id} value={p.id}>
                                                                {p.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label htmlFor="amount">{t("amount")}</Label>
                                                <Input
                                                    id="amount"
                                                    type="number"
                                                    step="0.01"
                                                    value={newTransaction.amount}
                                                    onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="description">{t("description")}</Label>
                                                <Textarea
                                                    id="description"
                                                    value={newTransaction.description}
                                                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="attachment">{t("attachment")}</Label>
                                                <Input
                                                    id="attachment"
                                                    type="file"
                                                    onChange={(e) => setSelectedFile(e.target.files[0])}
                                                />
                                            </div>
                                            <DialogFooter>
                                                <Button type="button" variant="outline" onClick={() => setTransactionDialogOpen(false)}>{t("cancel")}</Button>
                                                <Button type="submit" disabled={loading}>
                                                    {loading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                                                    {t("save")}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <Card className="p-4 border-l-4 border-blue-500">
                                    <p className="text-sm text-gray-500">{t("myCustodyGiven")}</p>
                                    <p className="text-xl font-bold">{formatCurrency(myCustodyData.custodyAmount)}</p>
                                </Card>
                                <Card className="p-4 border-l-4 border-red-500">
                                    <p className="text-sm text-gray-500">{t("myTotalExpenses")}</p>
                                    <p className="text-xl font-bold">{formatCurrency(myCustodyData.totalExpenses)}</p>
                                </Card>
                                <Card className="p-4 border-l-4 border-green-500">
                                    <p className="text-sm text-gray-500">{t("myRemainingBalance")}</p>
                                    <p className="text-xl font-bold">{formatCurrency(myCustodyData.remaining)}</p>
                                </Card>
                            </div>
                            <h3 className="text-lg font-semibold mb-2">{t("myRecentTransactions")}</h3>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t("date")}</TableHead>
                                            <TableHead>{t("description")}</TableHead>
                                            <TableHead>{t("property")}</TableHead>
                                            <TableHead>{t("amount")}</TableHead>
                                            <TableHead>{t("type")}</TableHead>
                                            <TableHead className="text-center">{t("attachment")}</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {currentMyTransactions.map((tx) => (
                                            <tr
                                                key={tx.id}
                                                className={tx.type === "expense" ? "bg-red-50/50" : "bg-green-50/50"}
                                            >
                                                <td className="p-2">
                                                    {tx.date
                                                        ? format(parseISO(tx.date), "dd/MM/yyyy", { locale: dateLocale })
                                                        : tx.created_at
                                                            ? format(parseISO(tx.created_at), "dd/MM/yyyy", { locale: dateLocale })
                                                            : "-"}
                                                </td>
                                                <td className="p-2">{tx.description || "-"}</td>
                                                <td className="p-2">{tx.properties?.name || t("custody")}</td>
                                                <td
                                                    className={`p-2 font-bold ${tx.type === "expense" ? "text-red-600" : "text-green-600"
                                                        }`}
                                                >
                                                    {formatCurrency(Math.abs(tx.amount))}
                                                </td>
                                                <td className="p-2">{t(tx.type)}</td>
                                                <td className="p-2 text-center">
                                                    {tx.has_attachments ? (
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    if (!tx.attachment_path) {
                                                                        toast.error("لا يوجد ملف مرفق");
                                                                        return;
                                                                    }

                                                                    const isFullUrl = tx.attachment_path.startsWith("http");
                                                                    const fileName = tx.attachment_path.split("/").pop();
                                                                    const fileUrl = isFullUrl
                                                                        ? tx.attachment_path
                                                                        : `${supabase.storageUrl}/object/public/transaction_attachments/${fileName}`;

                                                                    const response = await fetch(fileUrl);
                                                                    if (!response.ok) throw new Error("Failed to fetch file");
                                                                    const blob = await response.blob();
                                                                    const blobUrl = window.URL.createObjectURL(blob);

                                                                    const link = document.createElement("a");
                                                                    link.href = blobUrl;
                                                                    link.download = fileName;
                                                                    document.body.appendChild(link);
                                                                    link.click();
                                                                    document.body.removeChild(link);
                                                                    window.URL.revokeObjectURL(blobUrl);
                                                                } catch (err) {
                                                                    console.error("Error downloading file:", err);
                                                                    toast.error("حدث خطأ أثناء تنزيل الملف");
                                                                }
                                                            }}
                                                            className="text-blue-600 hover:underline"
                                                        >
                                                            <FileText className="h-4 w-4 mx-auto" />
                                                        </button>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </TableBody>
                                </Table>

                                {/* ✅ Pagination Controls */}
                                {totalMyPages > 1 && (
                                    <div className="flex justify-center gap-2 p-3">
                                        {Array.from({ length: totalMyPages }, (_, i) => (
                                            <button
                                                key={i + 1}
                                                onClick={() => setMyCurrentPage(i + 1)}
                                                className={`px-3 py-1 border rounded-md ${myCurrentPage === i + 1
                                                    ? "bg-blue-500 text-white"
                                                    : "bg-white text-gray-700 hover:bg-gray-100"
                                                    }`}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogPortal>
                    <DialogOverlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
                    <DialogContent
                        aria-describedby="employee-details-description"
                        className="max-w-6xl w-full max-h-[90vh] overflow-hidden bg-white rounded-xl shadow-2xl p-6 flex flex-col justify-start border border-gray-200"
                    >
                        {/* HEADER */}
                        <div className="flex justify-between items-start mb-4">
                            <DialogHeader className="flex-1">
                                <DialogTitle className="text-2xl font-bold text-gray-900">
                                    {t("employeeCustodyDetails")}: {selectedEmployee?.email}
                                </DialogTitle>
                                <DialogDescription
                                    id="employee-details-description"
                                    className="text-gray-500"
                                >
                                    {t("detailsFor")} {selectedEmployee?.email}
                                </DialogDescription>
                            </DialogHeader>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowDetailsDialog(false)}
                                className="text-gray-500 hover:text-gray-900"
                            >
                                ✕
                            </Button>
                        </div>
                        {/* BODY */}
                        <div className="flex-1 overflow-y-auto pr-1">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <Card className="p-4 border-l-4 border-blue-500 shadow-sm">
                                    <p className="text-sm text-gray-500">{t("custodyAmountGiven")}</p>
                                    <p className="text-xl font-semibold text-gray-800">
                                        {formatCurrency(selectedEmployee?.custodyAmount)}
                                    </p>
                                </Card>
                                <Card className="p-4 border-l-4 border-red-500 shadow-sm">
                                    <p className="text-sm text-gray-500">{t("totalExpenses")}</p>
                                    <p className="text-xl font-semibold text-gray-800">
                                        {formatCurrency(selectedEmployee?.totalExpenses)}
                                    </p>
                                </Card>
                                <Card className="p-4 border-l-4 border-green-500 shadow-sm">
                                    <p className="text-sm text-gray-500">{t("remainingBalance")}</p>
                                    <p className="text-xl font-semibold text-gray-800">
                                        {formatCurrency(selectedEmployee?.remaining)}
                                    </p>
                                </Card>
                            </div>
                            {/* Transactions */}
                            <h4 className="text-lg font-semibold mb-3">{t("recentTransactions")}</h4>
                            <div className="border rounded-lg overflow-y-auto max-h-[60vh] w-full">
                                <Table className="w-full min-w-[1000px]">
                                    <TableHeader className="sticky top-0 bg-white shadow-sm">
                                        <TableRow>
                                            <TableHead>{t("date")}</TableHead>
                                            <TableHead>{t("type")}</TableHead>
                                            <TableHead>{t("amount")}</TableHead>
                                            <TableHead>{t("description")}</TableHead>
                                            <TableHead>{t("property")}</TableHead>
                                            <TableHead className="text-center">{t("attachment")}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedEmployee?.transactions.map((tx) => (
                                            <TableRow
                                                key={tx.id}
                                                className={
                                                    tx.type === "expense" ? "bg-red-50/40" : "bg-green-50/40"
                                                }
                                            >
                                                <TableCell>
                                                    {tx.date
                                                        ? format(parseISO(tx.date), "dd/MM/yyyy", {
                                                            locale: dateLocale,
                                                        })
                                                        : tx.created_at
                                                            ? format(parseISO(tx.created_at), "dd/MM/yyyy", {
                                                                locale: dateLocale,
                                                            })
                                                            : "-"}
                                                </TableCell>
                                                <TableCell>
                                                    <span
                                                        className={`font-medium ${tx.type === "expense"
                                                            ? "text-red-600"
                                                            : "text-green-600"
                                                            }`}
                                                    >
                                                        {t(tx.type)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-bold">
                                                    {formatCurrency(Math.abs(tx.amount))}
                                                </TableCell>
                                                <TableCell>{tx.description || "-"}</TableCell>
                                                <TableCell>{tx.properties?.name || t("custody")}</TableCell>
                                                <TableCell className="text-center">
                                                    {tx.has_attachments ? (
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    if (!tx.attachment_path) {
                                                                        toast.error("لا يوجد ملف مرفق");
                                                                        return;
                                                                    }

                                                                    const isFullUrl = tx.attachment_path.startsWith("http");
                                                                    const fileName = tx.attachment_path.split("/").pop();
                                                                    const fileUrl = isFullUrl
                                                                        ? tx.attachment_path
                                                                        : `${supabase.storageUrl}/object/public/transaction_attachments/${fileName}`;

                                                                    const response = await fetch(fileUrl);
                                                                    if (!response.ok) throw new Error("Failed to fetch file");
                                                                    const blob = await response.blob();
                                                                    const blobUrl = window.URL.createObjectURL(blob);

                                                                    const link = document.createElement("a");
                                                                    link.href = blobUrl;
                                                                    link.download = fileName;
                                                                    document.body.appendChild(link);
                                                                    link.click();
                                                                    document.body.removeChild(link);

                                                                    window.URL.revokeObjectURL(blobUrl);
                                                                } catch (err) {
                                                                    console.error("Error downloading file:", err);
                                                                    toast.error("حدث خطأ أثناء تنزيل الملف");
                                                                }
                                                            }}
                                                            className="text-blue-600 hover:underline"
                                                            title="تحميل الملف"
                                                        >
                                                            <FileText className="h-4 w-4 mx-auto" />
                                                        </button>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                        {/* FOOTER */}
                        <div className="mt-6 flex justify-end">
                            <Button onClick={() => setShowDetailsDialog(false)}>
                                {t("close")}
                            </Button>
                        </div>
                    </DialogContent>
                </DialogPortal>
            </Dialog>
        </div>
    );
}