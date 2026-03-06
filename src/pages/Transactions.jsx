import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Receipt,
  Plus,
  Edit,
  Trash2,
  FileText,
  Search,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";

export default function Transactions() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar"; // 👈 مهم
  const { user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);

  // --- Pagination States ---
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 10;

  const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);
  const indexOfLast = currentPage * transactionsPerPage;
  const indexOfFirst = indexOfLast - transactionsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirst, indexOfLast);
  // --- End Pagination States ---

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  const [formData, setFormData] = useState({
    type: "income",
    amount: "",
    description: "",
    property_id: "",
    date: new Date().toISOString().split("T")[0],
    invoice_number: "",
    has_attachments: false,
    attachment_path: "",
  });

  useEffect(() => {
    fetchTransactions();
    fetchProperties();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [transactions, searchTerm, filterType]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, properties(name)")
        .order("date", { ascending: false });
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = /\.(jpg|jpeg|png|pdf|docx)$/i;
    if (!file.name.match(allowedExtensions)) {
      alert("صيغة الملف غير مدعومة. المسموح: JPG, PNG, PDF, DOCX");
      return;
    }

    try {
      const ext = file.name.split(".").pop(); // الامتداد
      const cleanBase = file.name
        .replace(/\.[^/.]+$/, "") // إزالة الامتداد
        .replace(/[^a-zA-Z0-9_-]/g, ""); // مسح أي شيء غير لاتيني
      const safeName = cleanBase || "file";
      const filePath = `${Date.now()}_${safeName}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("transaction_attachments")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("transaction_attachments")
        .getPublicUrl(filePath);

      setFormData((prev) => ({
        ...prev,
        attachment_path: data.publicUrl,
        has_attachments: true,
      }));

      alert("تم رفع الملف بنجاح ✅");
    } catch (error) {
      console.error("Upload error:", error);
      alert("فشل في رفع الملف. تحقق من الاسم أو حاول إعادة التسمية بالإنجليزية.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const transactionData = {
        ...formData,
        created_by: user?.id,
        amount: parseFloat(formData.amount),
      };

      let data, error;
      if (editingTransaction) {
        ({ data, error } = await supabase
          .from("transactions")
          .update(transactionData)
          .eq("id", editingTransaction.id)
          .select());
      } else {
        ({ data, error } = await supabase
          .from("transactions")
          .insert([transactionData])
          .select());
      }
      if (error) throw error;

      setDialogOpen(false);
      resetForm();
      fetchTransactions();
    } catch (error) {
      console.error("Error saving transaction:", error);
      alert("حدث خطأ أثناء الحفظ");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      fetchTransactions();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("فشل في الحذف");
    }
  };

  const resetForm = () => {
    setFormData({
      type: "income",
      amount: "",
      description: "",
      property_id: "",
      date: new Date().toISOString().split("T")[0],
      invoice_number: "",
      has_attachments: false,
      attachment_path: "",
    });
    setEditingTransaction(null);
  };

  const filterTransactions = () => {
    let filtered = [...transactions];
    if (searchTerm) {
      filtered = filtered.filter(
        (tx) =>
          tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tx.properties?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tx.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterType !== "all") {
      filtered = filtered.filter((tx) => tx.type === filterType);
    }
    setFilteredTransactions(filtered);
  };

  const totalIncome = filteredTransactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const totalExpenses = filteredTransactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0);
  const netBalance = totalIncome - totalExpenses;

  if (loading)
    return (
      <div className="flex justify-center items-center h-96 text-lg">
        {t("loading")}
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex justify-between items-center pb-2">
            <CardTitle>{t("totalIncome")}</CardTitle>
            <TrendingUp className="text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalIncome.toFixed(2)}ر.س
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex justify-between items-center pb-2">
            <CardTitle>{t("totalExpenses")}</CardTitle>
            <TrendingDown className="text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalExpenses.toFixed(2)}ر.س
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex justify-between items-center pb-2">
            <CardTitle>{t("netBalance")}</CardTitle>
            <Receipt className="text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {(totalIncome - totalExpenses).toFixed(2)}ر.س
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex gap-2">
          <Input
            placeholder={t("search")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t("filter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              <SelectItem value="income">{t("income")}</SelectItem>
              <SelectItem value="expense">{t("expense")}</SelectItem>
              <SelectItem value="salary_advance">{t("salary_advance")}</SelectItem>
              <SelectItem value="salary_advance_repayment">{t("salary_advance_repayment")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("addTransaction")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingTransaction ? t("editTransaction") : t("addTransaction")}
              </DialogTitle>
              {/* Added Description for Accessibility */}
              <p className="text-sm text-muted-foreground">
                {isArabic
                  ? "أدخل تفاصيل المعاملة المالية أدناه."
                  : "Enter transaction details below."}
              </p>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("type")}</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">{t("income")}</SelectItem>
                    <SelectItem value="expense">{t("expense")}</SelectItem>
                    <SelectItem value="salary_advance">{t("salary_advance")}</SelectItem>
                    <SelectItem value="salary_advance_repayment">{t("salary_advance_repayment")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("amount")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("property")}</Label>
                <Select
                  value={formData.property_id}
                  onValueChange={(v) =>
                    setFormData({ ...formData, property_id: v })
                  }
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
              <div className="space-y-2">
                <Label>{t("description")}</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("date")}</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />
              </div>
              {formData.type === "expense" && (
                <div className="space-y-2">
                  <Label>{t("invoiceNumber")}</Label>
                  <Input
                    value={formData.invoice_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        invoice_number: e.target.value,
                      })
                    }
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("attachments")}</Label>
                <Input type="file" accept=".jpg,.jpeg,.png,.docx,.pdf,image/jpeg,image/png,application/pdf" onChange={handleFileUpload} />
                {formData.attachment_path && (
                  <a
                    href={formData.attachment_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline flex items-center gap-1"
                  >
                    <FileText className="h-4 w-4" /> {t("viewFile")}
                  </a>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button type="submit">{t("save")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Receipt className="inline mr-2" /> {t("transactions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("date")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("type")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("amount")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("property")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("description")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("invoiceNumber")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("attachments")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentTransactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  className={isArabic ? "text-right" : "text-left"}
                >
                  <TableCell>
                    {format(new Date(tx.date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>{t(tx.type)}</TableCell>
                  <TableCell>{tx.amount.toFixed(2)}</TableCell>
                  <TableCell>{tx.properties?.name || "-"}</TableCell>
                  <TableCell>{tx.description}</TableCell>
                  <TableCell>{tx.invoice_number || "-"}</TableCell>

                  {/* المرفقات */}
                  <TableCell>
                    {tx.attachment_path ? (
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={async () => {
                          try {
                            // 1. Get Public URL (It's always available for public buckets)
                            const { data } = supabase.storage
                              .from("transaction_attachments")
                              .getPublicUrl(tx.attachment_path.split('/').pop()); // attachment_path might be full URL or path. 
                            // The stored path in DB:
                            // "attachment_path": "https://..." (from handleFileUpload)
                            // Wait, handleFileUpload stores `data.publicUrl`.
                            // So `tx.attachment_path` IS the URL.

                            // If it's a URL, we can fetch it directly.
                            const fileUrl = tx.attachment_path;

                            const response = await fetch(fileUrl);
                            if (!response.ok) {
                              if (response.status === 404) {
                                toast.error(isArabic ? "المرفق غير موجود" : "File not found");
                                return;
                              }
                              throw new Error("Download failed");
                            }

                            const blob = await response.blob();

                            // Construct Filename: ${description}_${YYYY-MM-DD_HH-mm}.${ext}
                            const ext = fileUrl.split('.').pop() || 'dat';
                            const dateStr = format(new Date(), "yyyy-MM-dd_HH-mm");
                            const safeDesc = (tx.description || tx.invoice_number || "transaction")
                              .replace(/[^a-z0-9\u0600-\u06FF_-]/gi, '_') // Keep Arabic & English
                              .substring(0, 50);

                            const filename = `${safeDesc}_${dateStr}.${ext}`;

                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);

                            toast.success(isArabic ? "تم التحميل بنجاح" : "Downloaded successfully");
                          } catch (err) {
                            console.error(err);
                            toast.error(isArabic ? "فشل التحميل" : "Download failed");
                          }
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        {isArabic ? "تحميل" : "Download"}
                      </Button>
                    ) : (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                        {isArabic ? "لا توجد ملفات" : "No files"}
                      </span>
                    )}
                  </TableCell>

                  {/* الإجراءات */}
                  <TableCell>
                    <div className="flex gap-2 justify-center md:justify-start">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingTransaction(tx);
                          setFormData({
                            type: tx.type,
                            amount: tx.amount,
                            description: tx.description,
                            property_id: tx.property_id,
                            date: format(new Date(tx.date), "yyyy-MM-dd"),
                            invoice_number: tx.invoice_number || "",
                            has_attachments: !!tx.attachment_path,
                            attachment_path: tx.attachment_path || "",
                          });
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => handleDelete(tx.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {filteredTransactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4">
                    {t("noTransactionsFound")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
              >
                {t("previous") || "السابق"}
              </Button>

              <span className="text-sm text-muted-foreground">
                {t("page") || "صفحة"} {currentPage} {t("of") || "من"}{" "}
                {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
              >
                {t("next") || "التالي"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
