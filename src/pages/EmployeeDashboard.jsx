import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  LogOut,
  Loader2,
  DollarSign,
  FileText,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

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

export default function EmployeeDashboard() {
  const { t, i18n, ready } = useTranslation();
  const { user, signOut, userProfile } = useAuth(); // Added userProfile
  const isRTL = i18n.language === "ar";
  const locale = isRTL ? ar : enUS;
  const dir = isRTL ? "rtl" : "ltr";

  const [custody, setCustody] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [properties, setProperties] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState("expense");
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const [formData, setFormData] = useState({
    source_type: "custody",
    type: "expense",
    amount: "",
    property_id: "",
    description: "",
    attachment: null,
  });

  // --------------------------------- Data Fetching ---------------------------------

  const fetchCustody = useCallback(async () => {
    if (!user) return;
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from("custody_system")
        .select(
          "id, user_id, custody_amount, total_expenses, remaining_balance, updated_at"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setCustody(data);
    } catch (error) {
      console.error("Error fetching custody ", error);
      toast.error(t("errorFetchingCustodyData"));
    }
    setIsFetching(false);
  }, [user, t]);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, properties(name)")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) {
        console.error("CRITICAL DB ERROR in fetchTransactions:", error);
        toast.error(t("errorFetchingTransactions") + ": " + error.message);
        throw error;
      }
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error(t("errorFetchingTransactions"));
    }
  }, [user, t]);

  const fetchProperties = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (user) {
      fetchCustody();
      fetchTransactions();
      fetchProperties();
    }
  }, [user, fetchCustody, fetchTransactions, fetchProperties]);

  // --------------------------------- Calculations (Using DB values) ---------------------------------
  const { totalGiven, totalCustodyExpenses, remainingBalance } = useMemo(() => {
    const given = custody?.custody_amount || 0;
    const expenses = custody?.total_expenses || 0;
    const remaining = custody?.remaining_balance || 0;

    return {
      totalGiven: Number(given),
      totalCustodyExpenses: Number(expenses),
      remainingBalance: Number(remaining),
    };
  }, [custody]);

  // --------------------------------- Handlers ---------------------------------

  const openModal = (type) => {
    setTransactionType(type);
    const defaultSource = type === "income" ? "property" : "custody";
    setFormData({
      source_type: defaultSource,
      type,
      amount: "",
      property_id: "",
      description: "",
      attachment: null,
    });
    setModalOpen(true);
  };

  const handleLogout = async () => {
    await signOut();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const amount = parseFloat(formData.amount);
      if (!amount || amount <= 0) {
        toast.error(t("pleaseEnterValidAmount"));
        return;
      }

      // property_id مطلوب فقط عند مصروف من العهدة
      if (
        formData.source_type === "custody" &&
        formData.type === "expense" &&
        !formData.property_id
      ) {
        toast.error(t("pleaseSelectPropertyForCustodyExpense"));
        return;
      }

      if (!formData.property_id && formData.source_type !== "custody") {
        toast.error(t("pleaseSelectProperty"));
        return;
      }

      if (
        formData.source_type === "custody" &&
        formData.type === "expense" &&
        amount > remainingBalance
      ) {
        toast.error(t("insufficientCustodyBalance"));
        return;
      }

      let attachmentPath = null;
      if (formData.attachment || selectedFile) {
        const file = formData.attachment || selectedFile;
        const ext = file.name.split(".").pop();
        const fileName = `${user.id}_${Date.now()}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("transaction_attachments")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        attachmentPath = uploadData.path;
      }

      const transactionAmount =
        formData.type === "expense" ? -Math.abs(amount) : Math.abs(amount);

      const { error: insertError } = await supabase
        .from("transactions")
        .insert([
          {
            type: formData.type,
            amount: transactionAmount,
            property_id: formData.property_id,
            description: formData.description || null,
            source_type: formData.source_type,
            user_id: user.id,
            created_by: user.id,
            has_attachments: !!attachmentPath,
            attachment_path: attachmentPath,
            date: new Date().toISOString(),
          },
        ]);
      if (insertError) throw insertError;

      await supabase.from("notifications").insert([
        {
          user_id: null,
          title: t("newTransaction"),
          message: `${t(formData.type)} ${t("addedBy")} ${user.email}`,
        },
      ]);

      toast.success(t("transactionAddedSuccessfully"));
      setModalOpen(false);
      fetchTransactions();
      fetchCustody();
    } catch (err) {
      console.error("Error adding transaction:", err);
      toast.error(t("errorAddingTransaction"));
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------- UI/UX ---------------------------------

  if (!ready || isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir={dir}>
      {/* Header and Logout */}
      <div className="flex justify-between items-center mb-8">
        <div className={isRTL ? "text-right" : "text-left"}>
          <h1 className="text-4xl font-extrabold text-gray-900">
            {t("employeeDashboard")}
          </h1>
          <p className="text-lg text-gray-600">
            {t("welcome")}, {userProfile?.full_name || user?.email}
          </p>
        </div>
        <Button
          onClick={handleLogout}
          variant="outline"
          className="text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-5 w-5 me-2" />
          {t("logout")}
        </Button>
      </div>

      {/* Custody Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-lg border-l-4 border-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">
              {t("custodyAmountGiven")}
            </CardTitle>
            <Wallet className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(totalGiven)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("totalAmountAssignedByAdmin")}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-l-4 border-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              {t("totalExpenses")}
            </CardTitle>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(totalCustodyExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("totalAmountSpentFromCustody")}
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-lg border-l-4 ${remainingBalance >= 0 ? "border-green-500" : "border-orange-500"
            }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle
              className={`text-sm font-medium ${remainingBalance >= 0 ? "text-green-600" : "text-orange-600"
                }`}
            >
              {t("remainingBalance")}
            </CardTitle>
            <DollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(remainingBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("currentAvailableBalance")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mb-8">
        <Button
          size="lg"
          onClick={() => openModal("expense")}
          className="bg-red-600 hover:bg-red-700"
        >
          <TrendingDown className="mr-2" />
          {t("addExpense")}
        </Button>
        <Button size="lg" onClick={() => openModal("income")} variant="secondary">
          <TrendingUp className="mr-2" />
          {t("addIncome")}
        </Button>
      </div>

      {/* Recent Transactions Table */}
      <Card className="shadow-lg">
        <CardHeader className={isRTL ? "text-right" : "text-left"}>
          <CardTitle>{t("recentTransactions")}</CardTitle>
          <CardDescription>{t("allTransactions")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={isRTL ? "text-right" : "text-left"}>
                  {t("date")}
                </TableHead>
                <TableHead className={isRTL ? "text-right" : "text-left"}>
                  {t("type")}
                </TableHead>
                <TableHead className={isRTL ? "text-right" : "text-left"}>
                  {t("amount")}
                </TableHead>
                <TableHead className={isRTL ? "text-right" : "text-left"}>
                  {t("description")}
                </TableHead>
                <TableHead className={isRTL ? "text-right" : "text-left"}>
                  {t("source")}
                </TableHead>
                <TableHead className="text-center">
                  {t("attachment")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.slice(0, 10).map((tx) => {
                const dateValue = tx.date;
                const date = dateValue ? new Date(dateValue) : null;
                const formattedDate =
                  date && !isNaN(date)
                    ? format(date, "dd/MM/yyyy", { locale })
                    : "-";

                let sourceDisplay =
                  tx.source_type === "custody" ? t("custody") : t("property");
                if (tx.property_id && tx.properties?.name) {
                  sourceDisplay = `${sourceDisplay} (${tx.properties.name})`;
                }

                const displayAmount = Math.abs(tx.amount);

                return (
                  <TableRow
                    key={tx.id}
                    className={`${isRTL ? "text-right" : "text-left"
                      } ${tx.type === "expense" ? "bg-red-50/50" : "bg-green-50/50"}`}
                  >
                    <TableCell>{formattedDate}</TableCell>
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
                      {formatCurrency(displayAmount)}
                    </TableCell>
                    <TableCell>{tx.description || "-"}</TableCell>
                    <TableCell>{sourceDisplay}</TableCell>
                    <TableCell className="text-center">
                      {tx.has_attachments ? (
                        <button
                          onClick={async () => {
                            try {
                              if (!tx.attachment_path) {
                                toast.error(
                                  t("noFile") || "لا يوجد ملف مرفق"
                                );
                                return;
                              }

                              const isFullUrl =
                                tx.attachment_path.startsWith("http");
                              const fileName =
                                tx.attachment_path.split("/").pop();
                              const fileUrl = isFullUrl
                                ? tx.attachment_path
                                : `${supabase.storageUrl}/object/public/transaction_attachments/${fileName}`;

                              const response = await fetch(fileUrl);
                              const blob = await response.blob();
                              const blobUrl =
                                window.URL.createObjectURL(blob);

                              const link = document.createElement("a");
                              link.href = blobUrl;
                              link.download = fileName;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);

                              window.URL.revokeObjectURL(blobUrl);
                            } catch (err) {
                              console.error(
                                "Error downloading file:",
                                err
                              );
                              toast.error(
                                t("errorDownloadingFile") ||
                                "حدث خطأ أثناء تنزيل الملف"
                              );
                            }
                          }}
                          className="text-blue-600 hover:underline"
                          title={t("download") || "تحميل الملف"}
                        >
                          <FileText className="h-4 w-4 mx-auto" />
                        </button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    {t("noTransactionsYet")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent dir={dir}>
          <DialogHeader>
            <DialogTitle>
              {transactionType === "income" ? t("addIncome") : t("addExpense")}
            </DialogTitle>
            <DialogDescription>{t("fillTransactionDetails")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* sourceType */}
            <div>
              <Label>{t("sourceType")}</Label>
              <Select
                value={formData.source_type}
                onValueChange={(v) =>
                  setFormData({ ...formData, source_type: v, property_id: "" })
                }
                disabled={transactionType === "income"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {transactionType === "expense" && (
                    <>
                      <SelectItem value="custody">
                        {t("custody")}
                      </SelectItem>
                      <SelectItem value="property">
                        {t("property")}
                      </SelectItem>
                    </>
                  )}
                  {transactionType === "income" && (
                    <SelectItem value="property">{t("property")}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* property data */}
            <div>
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

            <div>
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

            <div>
              <Label>{t("description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div>
              <Label>{t("attachment")}</Label>
              <Input
                type="file"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    attachment: e.target.files[0],
                  })
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin me-2" />
                ) : null}
                {loading ? t("saving") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
