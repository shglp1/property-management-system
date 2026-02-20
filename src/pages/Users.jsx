import { useEffect, useState } from "react";
import { supabase, supabaseAdmin } from "@/lib/supabaseClient";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Users as UsersIcon,
  Plus,
  Edit,
  Trash2,
  FileDown,
  Search,
} from "lucide-react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

export default function Users() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const dir = isArabic ? "rtl" : "ltr";

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    role: "employee",
    password: "",
    confirmPassword: "",
    status: "active",
    salary: "",
    salary_advance: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP State
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifyingEmail, setVerifyingEmail] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [processingOtp, setProcessingOtp] = useState(false);
  /* eslint-disable react-hooks/exhaustive-deps */

  useEffect(() => {
    let interval;
    if (otpTimer > 0) {
      interval = setInterval(() => setOtpTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users:", error);
    }

    setUsers(data || []);
    setLoading(false);
  };

  const filterUsers = () => {
    const filtered = users.filter((u) =>
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    // Validate passwords for new users or if password is provided
    if ((!editingUser || formData.password) && (!formData.password || formData.password.length < 6)) {
      toast.error(isArabic ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters");
      setIsSubmitting(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error(isArabic ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      setIsSubmitting(false);
      return;
    }

    try {
      let authUserId = null;

      if (editingUser) {
        // --- EDIT FLOW ---
        // 1. Update Password if provided
        if (formData.password) {
          const { data: funcData, error: funcError } = await supabase.functions.invoke('admin-tasks', {
            body: {
              action: 'change_password',
              user_id: editingUser.id,
              email: editingUser.email, // Added email
              password: formData.password
            }
          });

          if (funcError || (funcData && funcData.error)) {
            const e = new Error("Password update failed");
            e.cause = funcData?.error || funcError;
            throw e;
          }
        }

        // 2. Update Public Data
        const { error } = await supabase
          .from("app_users")
          .update({
            full_name: formData.full_name,
            role: formData.role,
            status: formData.status,
            salary: parseFloat(formData.salary) || 0,
            salary_advance: parseFloat(formData.salary_advance) || 0,
          })
          .eq("id", editingUser.id);

        if (error) throw error;
        toast.success(t("success"));

      } else {
        // --- ADD FLOW (Password Base) ---
        // ... (unchanged)
        const { data: funcData, error: funcError } = await supabase.functions.invoke('admin-tasks', {
          body: {
            action: 'create_user',
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            role: formData.role
          }
        });

        if (funcError || (funcData && funcData.error)) {
          const e = new Error("Request failed");
          e.cause = funcData?.error || funcError;
          throw e;
        }

        authUserId = funcData.user.id;

        const { error: upsertError } = await supabase
          .from("app_users")
          .upsert({
            id: authUserId,
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
            status: formData.status,
            salary: parseFloat(formData.salary) || 0,
            salary_advance: parseFloat(formData.salary_advance) || 0,
          });

        if (upsertError) throw upsertError;
        toast.success(t("success"));
      }

      setDialogOpen(false);
      setEditingUser(null);
      resetForm();
      setTimeout(() => fetchUsers(), 500);
    } catch (err) {
      console.error(err);
      let msg = err.message;
      if (err.cause) {
        if (typeof err.cause === 'object' && err.cause.error) {
          msg = err.cause.error;
        } else if (typeof err.cause === 'string') {
          msg = err.cause;
        } else {
          msg = JSON.stringify(err.cause);
        }
      }

      msg = msg.replace("INTERNAL ERROR: ", "");

      if (msg.includes("UserSyncError")) {
        msg = isArabic
          ? "خطأ في المزامنة: المستخدم موجود في قاعدة البيانات ولكن غير موجود في نظام المصادقة. يرجى حذف المستخدم وإعادة إنشائه."
          : "Sync Error: User exists in DB but missing from Auth. Please delete and recreate the user.";
      }

      if (msg.includes("Session from session_id claim in JWT does not exist") || msg.includes("Unauthorized")) {
        toast.error(isArabic ? "انتهت الجلسة، يرجى تسجيل الدخول مجدداً" : "Session expired, please login again");
        await supabase.auth.signOut();
        window.location.href = "/login";
        return;
      }

      toast.error(t("error") + ": " + msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Removed OTP handlers (handleVerifyOtp, handleResendOtp) as they are no longer needed.

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name || "",
      password: "",
      confirmPassword: "",
      role: user.role,
      status: user.status,
      salary: user.salary || "",
      salary_advance: user.salary_advance || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("app_users").delete().eq("id", id);
    if (error) toast.error(t("error"));
    else {
      toast.success(t("success"));
      fetchUsers();
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      full_name: "",
      password: "",
      confirmPassword: "",
      role: "employee",
      status: "active",
      salary: "",
      salary_advance: "",
    });
    setEditingUser(null);
    setOtpMode(false);
    setOtpCode("");
    setVerifyingEmail("");
    setOtpTimer(0);
    setIsSubmitting(false);
  };

  const exportToExcel = () => {
    const data = users.map((u) => ({
      [t("email")]: u.email,
      [t("userRole")]: t(u.role),
      [t("userStatus")]: t(u.status),
      [t("salary")]: u.salary || 0,
      [t("salaryAdvance")]: u.salary_advance || 0,
      [t("netBalance")]:
        (u.salary || 0) - (u.salary_advance || 0),
      [t("createdAt")]: format(new Date(u.created_at), "yyyy-MM-dd"),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");

    const lang = isArabic ? "_AR" : "_EN";
    const fileName = `Users_Report_${new Date()
      .toISOString()
      .split("T")[0]}${lang}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    toast.success(t("exportToExcel"));
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-96 text-lg">
        {t("loading")}
      </div>
    );

  return (
    <div
      className={`space-y-6 ${dir === "rtl" ? "text-right" : "text-left"}`}
      dir={dir}
    >
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 max-w-md relative">
          <Search
            className={`absolute ${isArabic ? "right-3" : "left-3"
              } top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground`}
          />
          <Input
            placeholder={t("search")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${isArabic ? "pr-10 text-right" : "pl-10 text-left"}`}
          />
        </div>

        <div className="flex gap-2">
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("addUser")}
              </Button>
            </DialogTrigger>
            <DialogContent dir={dir} className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? t("editUser") : t("addUser")}
                </DialogTitle>
                <DialogDescription>
                  {isArabic ? "أدخل تفاصيل المستخدم أدناه." : "Enter user details below."}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* --- Normal Form --- */}
                <>
                  <div>
                    <Label>{t("email")}</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                      disabled={editingUser} // Admin can't change email of existing user
                    />
                  </div>

                  <div>
                    <Label>{isArabic ? "الاسم الكامل" : "Full Name"}</Label>
                    <Input
                      value={formData.full_name}
                      onChange={(e) =>
                        setFormData({ ...formData, full_name: e.target.value })
                      }
                    />
                  </div>

                  {/* Password Fields - Required for New, Optional for Edit */}
                  <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
                    <h4 className="text-sm font-semibold">
                      {editingUser
                        ? (isArabic ? "تغيير كلمة المرور (اختياري)" : "Change Password (Optional)")
                        : (isArabic ? "تعيين كلمة المرور" : "Set Password")
                      }
                    </h4>
                    <div>
                      <Label className="text-xs">{isArabic ? "كلمة المرور" : "Password"}</Label>
                      <Input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="******"
                        required={!editingUser} // Required for new users
                        className={formData.password && formData.password.length >= 6 ? "border-green-500" : ""}
                      />
                      {/* Password Strength Hint */}
                      <p className={`text-[10px] mt-1 ${formData.password && formData.password.length >= 6 ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
                        {isArabic ? "يجب أن تكون 6 أحرف على الأقل" : "Must be at least 6 characters"}
                        {formData.password && formData.password.length >= 6 && " ✓"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">{isArabic ? "تأكيد كلمة المرور" : "Confirm Password"}</Label>
                      <Input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required={!editingUser}
                        className={formData.confirmPassword && formData.password !== formData.confirmPassword ? "border-red-500" : (formData.confirmPassword ? "border-green-500" : "")}
                      />
                      {/* Match Error */}
                      {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                        <p className="text-[10px] text-red-600 mt-1 font-medium">
                          {isArabic ? "كلمتا المرور غير متطابقتين" : "Passwords do not match"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* role select */}
                  <div>
                    <Label>{t("userRole")}</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) =>
                        setFormData({ ...formData, role: value })
                      }
                    >
                      <SelectTrigger className="w-full border rounded-md">
                        <SelectValue placeholder={t("select")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{t("admin")}</SelectItem>
                        <SelectItem value="employee">{t("employee")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* status select */}
                  <div>
                    <Label>{t("userStatus")}</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger className="w-full border rounded-md">
                        <SelectValue placeholder={t("select")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t("active")}</SelectItem>
                        <SelectItem value="inactive">{t("inactive")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{t("salary")}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.salary}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          salary: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t("salaryAdvance")}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.salary_advance}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          salary_advance: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="bg-gray-50 p-3 rounded-md text-sm border">
                    <strong>{t("netBalance")}:</strong>{" "}
                    {(
                      (parseFloat(formData.salary) || 0) -
                      (parseFloat(formData.salary_advance) || 0)
                    ).toFixed(2)}{" "}
                    {isArabic ? "ريال" : "SAR"}
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      {t("cancel")}
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? t("loading") : t("save")}
                    </Button>
                  </DialogFooter>
                </>
              </form>
            </DialogContent>
          </Dialog>

          <Button onClick={exportToExcel}>
            <FileDown className="mr-2 h-4 w-4" />
            {t("exportToExcel")}
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            <UsersIcon className="inline mr-2" /> {t("users")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {isArabic ? "الاسم" : "Name"}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("email")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("userRole")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("userStatus")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("salary")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("salaryAdvance")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("netBalance")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("createdAt")}
                </TableHead>
                <TableHead className={isArabic ? "text-right" : "text-left"}>
                  {t("actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow
                  key={u.id}
                  className={isArabic ? "text-right" : "text-left"}
                >
                  <TableCell>
                    {u.full_name || u.email.split('@')[0]}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{t(u.role)}</TableCell>
                  <TableCell>{t(u.status)}</TableCell>
                  <TableCell>{u.salary?.toFixed(2) || "0.00"}</TableCell>
                  <TableCell>
                    {u.salary_advance?.toFixed(2) || "0.00"}
                  </TableCell>
                  <TableCell>
                    {((u.salary || 0) - (u.salary_advance || 0)).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {format(new Date(u.created_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-center md:justify-start">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(u)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(u.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
