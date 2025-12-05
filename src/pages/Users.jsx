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
    role: "employee",
    password: "",
    status: "active",
    salary: "",
    salary_advance: "",
  });

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
    if (error) console.error(error);
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

    const payload = {
      email: formData.email.trim(),
      role: formData.role,
      status: formData.status,
      salary: parseFloat(formData.salary) || 0,
      salary_advance: parseFloat(formData.salary_advance) || 0,
    };

    try {
      let error;

      if (editingUser) {
        ({ error } = await supabase
          .from("app_users")
          .update(payload)
          .eq("id", editingUser.id));
      } else {
        if (!formData.password || formData.password.length < 6) {
          toast.error(
            isArabic
              ? "يجب أن تكون كلمة المرور 6 أحرف على الأقل"
              : "Password must be at least 6 characters."
          );
          return;
        }

        const { data: existingAppUser, error: existingError } = await supabase
          .from("app_users")
          .select("id")
          .eq("email", payload.email)
          .maybeSingle();

        if (existingError) {
          console.error("Error checking existing user:", existingError);
          toast.error(t("error"));
          return;
        }

        if (existingAppUser) {
          toast.error(
            isArabic
              ? "يوجد مستخدم مسجل بهذا البريد الإلكتروني بالفعل."
              : "A user with this email already exists."
          );
          return;
        }

        const { data: signUpData, error: signUpError } =
          await supabaseAdmin.auth.signUp({
            email: payload.email,
            password: formData.password,
          });

        if (signUpError) {
          console.error("Auth signUp error:", signUpError);

          const msg = signUpError.message?.includes(
            "Database error saving new user"
          )
            ? isArabic
              ? "هذا البريد مسجل بالفعل في نظام الدخول."
              : "This email is already registered in Auth."
            : signUpError.message?.includes("For security purposes")
            ? isArabic
              ? "حاول مرة أخرى بعد دقيقة، يوجد حد على عدد محاولات إنشاء الحساب."
              : "Please wait about a minute before creating another user (rate limit)."
            : isArabic
            ? "حدث خطأ عند إنشاء حساب الدخول."
            : "Error creating auth user.";

          toast.error(msg);
          return;
        }

        ({ error } = await supabase.from("app_users").insert([payload]));
      }

      if (error) {
        toast.error(t("error"));
        console.error(error);
        return;
      }

      toast.success(t("success"));
      setDialogOpen(false);
      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error(t("error"));
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: "",
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
      password: "",
      role: "employee",
      status: "active",
      salary: "",
      salary_advance: "",
    });
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
            className={`absolute ${
              isArabic ? "right-3" : "left-3"
            } top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground`}
          />
          <Input
            placeholder={t("search")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${isArabic ? "pr-10" : "pl-10"}`}
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
            <DialogContent dir={dir}>
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? t("editUser") : t("addUser")}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>{t("email")}</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    disabled={editingUser}
                  />
                </div>
                {!editingUser && (
                  <div>
                    <Label>{t("password")}</Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      {isArabic
                        ? "سيتم استخدام هذه ككلمة المرور لتسجيل دخول المستخدم"
                        : "This will be the user's login password."}
                    </p>
                  </div>
                )}

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
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    {t("cancel")}
                  </Button>
                  <Button type="submit">{t("save")}</Button>
                </DialogFooter>
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
