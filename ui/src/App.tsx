import {
  ArrowUp,
  BarChart3,
  Baby,
  Boxes,
  Calculator,
  CalendarDays,
  Clock3,
  ClipboardList,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Home,
  Info,
  LogIn,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  ReceiptIndianRupee,
  ReceiptText,
  RefreshCcw,
  Scale,
  ScanLine,
  Search,
  Send,
  Minus,
  Menu,
  Moon,
  PiggyBank,
  Sun,
  Trash2,
  Utensils,
  UsersRound,
  WalletCards
} from "lucide-react";
import type React from "react";
import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import html2canvas from "html2canvas";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, apiBlob, toQuery } from "@/lib/api";
import { cn } from "@/lib/utils";

type ResourceKey = "dashboard" | "funds" | "dinner" | "reports" | "festivals" | "house" | "volunteers" | "estimates" | "expenses" | "inventory" | "todos";
type AnyRow = Record<string, any>;
type Pagination = { total: number; page: number; limit: number; totalPages: number };
type FieldType = "text" | "number" | "date" | "password" | "checkbox" | "select";
type Field = { key: string; label: string; type?: FieldType; options?: string[]; allowCustom?: boolean };
type ResourceConfig = {
  key: ResourceKey;
  title: string;
  path: string;
  icon: typeof Home;
  columns: string[];
  fields: Field[];
  searchFields?: string[];
};
type PublicSummary = {
  totalFunds: number;
  totalExpenses: number;
  balance: number;
  houseCount: number;
  fundByPayment: Record<string, number>;
  expenseByPayment: Record<string, number>;
};
type YearTotals = { fund: number; expense: number; balance: number };
type YearComparison = {
  currentYear: number;
  previousYear: number;
  current: YearTotals;
  previous: YearTotals;
};

const years = Array.from({ length: 14 }, (_, index) => 2024 + index);
const currentYear = new Date().getFullYear();
const logoBlank = "/assets/festival_logo_blank.png";
const logoWhite = "/assets/festival_logo_white.png";
const mandalLogo = "/assets/shivam-yuvak-mandal.png";
const gpayQr = "/assets/gpay-qr-code.jpeg";
const kpLabsLogo = "/assets/kplabs.svg";
const activePageStorageKey = "activePage";
const mandalNameGujarati = "શિવમ્ યુવક મંડળ";

function DashboardBrand() {
  return (
    <div className="flex justify-center">
      <div className="inline-flex max-w-full flex-col items-center">
        <div className="inline-flex max-w-full items-center justify-center gap-3 text-center sm:gap-4">
          <img src={mandalLogo} alt="Shivam Yuvak Mandal logo" className="h-12 w-auto shrink-0 object-contain sm:h-16" />
          <h1 className="mandal-glow break-words text-2xl font-semibold sm:text-3xl">{mandalNameGujarati}</h1>
        </div>
        <p className="text-sm font-medium text-muted-foreground sm:ml-20 sm:text-base">અણખોલ</p>
      </div>
    </div>
  );
}

function getInitialTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialActivePage(): ResourceKey {
  const savedPage = localStorage.getItem(activePageStorageKey) as ResourceKey | null;
  const validPages: ResourceKey[] = ["dashboard", "funds", "dinner", "reports", ...resources.map((resource) => resource.key)];
  return savedPage && validPages.includes(savedPage) ? savedPage : "dashboard";
}

const resources: ResourceConfig[] = [
  {
    key: "house",
    title: "House",
    path: "/house",
    icon: Home,
    columns: ["houseNumber", "ownerName", "phone"],
    fields: [
      { key: "houseNumber", label: "House Number" },
      { key: "ownerName", label: "Owner Name" },
      { key: "phone", label: "Phone" }
    ]
  },
  {
    key: "volunteers",
    title: "Volunteer",
    path: "/volunteers",
    icon: UsersRound,
    columns: ["name", "phone"],
    fields: [
      { key: "name", label: "Name" },
      { key: "phone", label: "Phone" },
      { key: "password", label: "Password", type: "password" }
    ]
  },
  {
    key: "festivals",
    title: "Festival",
    path: "/festivals",
    icon: CalendarDays,
    columns: ["name", "year", "date", "notes"],
    fields: [
      { key: "name", label: "Name" },
      { key: "year", label: "Year", type: "number" },
      { key: "date", label: "Date", type: "date" },
      { key: "notes", label: "Notes" }
    ]
  },
  {
    key: "estimates",
    title: "Estimates",
    path: "/estimates",
    icon: Calculator,
    columns: ["festivalId", "category", "estimatedAmount", "description", "festivalYear"],
    fields: [
      { key: "festivalId", label: "Festival" },
      { key: "category", label: "Category", allowCustom: true },
      { key: "estimatedAmount", label: "Estimated Amount", type: "number" },
      { key: "description", label: "Description" }
    ]
  },
  {
    key: "expenses",
    title: "Expenses",
    path: "/expenses",
    icon: BarChart3,
    columns: ["festivalId", "category", "amount", "paymentMethod", "description", "volunteerId", "isSettled"],
    fields: [
      { key: "festivalId", label: "Festival" },
      { key: "category", label: "Category", allowCustom: true },
      { key: "amount", label: "Amount", type: "number" },
      { key: "paymentMethod", label: "Payment Method", type: "select", options: ["Cash", "GPay"] },
      { key: "description", label: "Description" },
      { key: "note", label: "Note" },
      { key: "volunteerId", label: "Volunteer" },
      { key: "isSettled", label: "Settled", type: "checkbox" }
    ]
  },
  {
    key: "inventory",
    title: "Inventory",
    path: "/inventory",
    icon: Boxes,
    columns: ["item", "category", "itemCount", "place", "note"],
    fields: [
      { key: "item", label: "Item" },
      { key: "category", label: "Category", allowCustom: true },
      { key: "itemCount", label: "Count", type: "number" },
      { key: "place", label: "Place" },
      { key: "note", label: "Note" }
    ]
  },
  {
    key: "todos",
    title: "Todos",
    path: "/todos",
    icon: ClipboardList,
    columns: ["title", "isDone", "role"],
    fields: [
      { key: "title", label: "Title" },
      { key: "isDone", label: "Done", type: "checkbox" }
    ]
  }
];

function money(value: unknown) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function rowId(row: AnyRow) {
  return String(row?._id || row?.mongo_id || row?.id || "");
}

function festivalLabel(festival: AnyRow) {
  const name = festival?.name || "";
  const year = festival?.year || festival?.festivalYear || "";
  return year ? `${name} (${year})` : name;
}

function display(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value == null) return "";
  if (typeof value === "object") {
    const row = value as AnyRow;
    return row.name || row.ownerName || row.houseNumber || row._id || row.id || "";
  }
  return String(value);
}

function formatDateDDMMYYYY(value: unknown) {
  if (!value) return "";
  const raw = String(value);
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function capitalizeFirst(value: unknown) {
  const text = String(value ?? "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function displayCell(row: AnyRow, column: string) {
  const value = row[column];
  if (column === "houseId") {
    const house = value && typeof value === "object" ? value as AnyRow : row.house;
    return house?.houseNumber || "";
  }
  if (column === "volunteerId") {
    const volunteer = value && typeof value === "object" ? value as AnyRow : row.volunteer;
    return volunteer?.name || "";
  }
  if (column === "festivalId") {
    const festival = value && typeof value === "object" ? value as AnyRow : row.festival;
    return festival ? festivalLabel(festival) : "";
  }
  return display(value);
}

function WhatsAppIcon() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center">
      <img alt="WhatsApp" className="h-5 w-5 object-contain" src="/assets/whatsapp.svg" />
    </span>
  );
}

function SettlementBadge({ isSettled, disabled, onToggle }: { isSettled: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      className={cn(
        "inline-flex h-6 w-24 items-center justify-center whitespace-nowrap rounded px-2 text-xs font-semibold text-white",
        isSettled ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:bg-destructive/90",
        disabled && "cursor-not-allowed opacity-50 hover:bg-inherit"
      )}
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      {isSettled ? "Settled" : "Not Settled"}
    </button>
  );
}

function sumRows(rows: AnyRow[], field = "amount") {
  return rows.reduce((sum, item) => sum + Number(item[field] || 0), 0);
}

function paymentTotal(rows: AnyRow[], method: string, field = "amount") {
  return rows
    .filter((item) => item.paymentMethod === method)
    .reduce((sum, item) => sum + Number(item[field] || 0), 0);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function SelectBox(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-10 w-full max-w-full appearance-none rounded-md border bg-background bg-[linear-gradient(45deg,transparent_50%,currentColor_50%),linear-gradient(135deg,currentColor_50%,transparent_50%)] bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-18px)_50%,calc(100%-13px)_50%] bg-no-repeat px-3 pr-9 text-base shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:text-sm",
        props.className
      )}
    />
  );
}

function ResponsiveNumberInput({ value, min = 0, onChange }: { value: string | number; min?: number; onChange: (value: string) => void }) {
  const numericValue = Number(value || 0);
  function step(delta: number) {
    onChange(String(Math.max(min, numericValue + delta)));
  }
  return (
    <>
      <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2 sm:hidden">
        <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => step(-1)}><Minus className="h-4 w-4" /></Button>
        <Input className="h-11 text-center text-lg font-semibold" type="number" min={min} value={value} onChange={(event) => onChange(event.target.value)} />
        <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => step(1)}><Plus className="h-4 w-4" /></Button>
      </div>
      <Input className="hidden sm:block" type="number" min={min} value={value} onChange={(event) => onChange(event.target.value)} />
    </>
  );
}

type SearchableOption = { value: string; label: string; search?: string };

function SearchableSelect({ value, options, placeholder = "Search", disabled, allowCustom, onChange }: { value: string; options: SearchableOption[]; placeholder?: string; disabled?: boolean; allowCustom?: boolean; onChange: (value: string) => void }) {
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label || (allowCustom ? value : ""));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selected?.label || (allowCustom ? value : ""));
  }, [allowCustom, selected?.label, value]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? options.filter((option) => `${option.label} ${option.search || ""}`.toLowerCase().includes(normalizedQuery)).slice(0, 30)
    : options.slice(0, 30);

  return (
    <div className="relative">
      <Input
        autoComplete="off"
        disabled={disabled}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setOpen(true);
          if (allowCustom || !next) onChange(next);
        }}
        onFocus={() => !disabled && setOpen(true)}
        placeholder={placeholder}
        value={query}
      />
      {open && !disabled ? (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-background p-1 shadow-lg">
          {filtered.length ? filtered.map((option) => (
            <button
              className={cn("block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted", option.value === value && "bg-muted font-medium")}
              key={option.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setQuery(option.label);
                setOpen(false);
              }}
              type="button"
            >
              {option.label}
            </button>
          )) : <div className="px-2 py-1.5 text-sm text-muted-foreground">No matches found</div>}
        </div>
      ) : null}
    </div>
  );
}

function Login({ onLogin, logoSrc, compact = false }: { onLogin: () => void; logoSrc: string; compact?: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await api<{ token: string; role: string; user: unknown }>("/auth/login", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      localStorage.setItem("token", response.token);
      localStorage.setItem("role", response.role);
      localStorage.setItem("user", JSON.stringify(response.user));
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    }
  }

  const content = (
    <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-center">
          <img src={logoSrc} alt="Festival Expense Logo" className="max-h-20 object-contain sm:max-h-24" />
        </div>
        <Card>
          <CardContent className="pt-5">
            <form className="space-y-3" onSubmit={submit}>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
              <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button className="w-full" type="submit">Sign In</Button>
            </form>
          </CardContent>
        </Card>
      </div>
  );

  if (compact) return content;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      {content}
    </main>
  );
}

function PublicDashboard() {
  const [year, setYear] = useState(String(currentYear));
  const [summary, setSummary] = useState<PublicSummary>({
    totalFunds: 0,
    totalExpenses: 0,
    balance: 0,
    houseCount: 0,
    fundByPayment: {},
    expenseByPayment: {}
  });
  const [yearComparison, setYearComparison] = useState<YearComparison | null>(null);

  useEffect(() => {
    api<PublicSummary>(`/public/dashboard-summary${toQuery({ festivalYear: year })}`, { auth: false })
      .then(setSummary)
      .catch(() => undefined);
  }, [year]);

  useEffect(() => {
    if (!year) {
      setYearComparison(null);
      return;
    }
    api<YearComparison>(`/public/dashboard-year-comparison${toQuery({ festivalYear: year })}`, { auth: false })
      .then(setYearComparison)
      .catch(() => setYearComparison(null));
  }, [year]);

  const fundTotal = Number(summary.totalFunds || 0);
  const expenseTotal = Number(summary.totalExpenses || 0);
  const balance = Number(summary.balance || 0);
  const progress = fundTotal ? Math.max(0, Math.min(100, (balance / fundTotal) * 100)) : 0;
  const cashBalance = Number(summary.fundByPayment?.Cash || 0) - Number(summary.expenseByPayment?.Cash || 0);
  const gpayBalance = Number(summary.fundByPayment?.GPay || 0) - Number(summary.expenseByPayment?.GPay || 0);

  return (
    <section className="space-y-4">
      <DashboardBrand />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <strong className="text-lg sm:text-xl">{money(balance)}</strong>
          <AnimatedProgressMeter progress={progress} start={0} end={fundTotal} />
        </div>
        <SelectBox className="sm:w-auto" value={year} onChange={(event) => setYear(event.target.value)}>
          <option value="">All</option>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </SelectBox>
      </div>
      <YearComparisonChart data={yearComparison} selectedYear={year} />
      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardBlock
          className="bg-[#28a745]"
          icon={Scale}
          title="Balance"
          value={balance}
          lines={[`Cash: ${money(cashBalance)} | GPay: ${money(gpayBalance)}`]}
        />
        <DashboardBlock
          className="bg-[#17a2b8]"
          icon={PiggyBank}
          title="Total Fund"
          value={fundTotal}
          lines={[`Cash: ${money(summary.fundByPayment?.Cash || 0)} | GPay: ${money(summary.fundByPayment?.GPay || 0)}`]}
        />
        <DashboardBlock
          className="bg-[#dc3545]"
          icon={ReceiptIndianRupee}
          title="Total Expense"
          value={expenseTotal}
          lines={[`Cash: ${money(summary.expenseByPayment?.Cash || 0)} | GPay: ${money(summary.expenseByPayment?.GPay || 0)}`]}
        />
        <CountBlock animate className="bg-[#ffc107] text-[#1f2937]" icon={Home} title="Houses" value={Number(summary.houseCount || 0)} />
      </div>
    </section>
  );
}

function Dashboard({ setActive }: { setActive: (key: ResourceKey) => void }) {
  const [year, setYear] = useState(String(currentYear));
  const [funds, setFunds] = useState<AnyRow[]>([]);
  const [expenses, setExpenses] = useState<AnyRow[]>([]);
  const [estimates, setEstimates] = useState<AnyRow[]>([]);
  const [houses, setHouses] = useState<AnyRow[]>([]);
  const [volunteers, setVolunteers] = useState<AnyRow[]>([]);
  const [todos, setTodos] = useState<AnyRow[]>([]);
  const [yearComparison, setYearComparison] = useState<YearComparison | null>(null);
  const [editingExpense, setEditingExpense] = useState<AnyRow | null>(null);

  async function loadDashboard() {
    const params = toQuery({ festivalYear: year, page: 1, limit: 250 });
    const [fundRes, expenseRes, estimateRes, houseRes, volunteerRes, todoRes] = await Promise.all([
      api<{ data: AnyRow[] }>(`/funds${params}`),
      api<{ data: AnyRow[] }>(`/expenses${params}`),
      api<{ data: AnyRow[] }>(`/estimates${params}`),
      api<{ data: AnyRow[] }>("/house?page=1&limit=500"),
      api<{ data: AnyRow[] }>("/volunteers?page=1&limit=250"),
      api<{ data: AnyRow[] }>("/todos?page=1&limit=5&sort=-createdAt")
    ]);
    setFunds(fundRes.data || []);
    setExpenses(expenseRes.data || []);
    setEstimates(estimateRes.data || []);
    setHouses(houseRes.data || []);
    setVolunteers(volunteerRes.data || []);
    setTodos(todoRes.data || []);
  }

  useEffect(() => {
    loadDashboard().catch(() => undefined);
  }, [year]);

  useEffect(() => {
    if (!year) {
      setYearComparison(null);
      return;
    }
    api<YearComparison>(`/dashboard/year-comparison${toQuery({ festivalYear: year })}`)
      .then(setYearComparison)
      .catch(() => setYearComparison(null));
  }, [year]);

  const fundTotal = sumRows(funds);
  const expenseTotal = sumRows(expenses);
  const estimateTotal = sumRows(estimates, "estimatedAmount");
  const balance = fundTotal - expenseTotal;
  const progress = fundTotal ? Math.max(0, Math.min(100, (balance / fundTotal) * 100)) : 0;
  const settledTotal = sumRows(expenses.filter((expense) => expense.isSettled));
  const unsettledTotal = expenseTotal - settledTotal;

  return (
    <section className="space-y-4">
      <DashboardBrand />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <strong className="text-lg sm:text-xl">{money(balance)}</strong>
          <AnimatedProgressMeter progress={progress} start={0} end={fundTotal} />
        </div>
        <SelectBox className="sm:w-auto" value={year} onChange={(event) => setYear(event.target.value)}>
          <option value="">All</option>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </SelectBox>
      </div>
      <YearComparisonChart data={yearComparison} selectedYear={year} />
      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardBlock
          className="bg-[#28a745]"
          icon={Scale}
          title="Balance"
          value={balance}
          lines={[`Cash: ${money(paymentTotal(funds, "Cash") - paymentTotal(expenses, "Cash"))} | GPay: ${money(paymentTotal(funds, "GPay") - paymentTotal(expenses, "GPay"))}`]}
        />
        <DashboardBlock
          className="bg-[#17a2b8]"
          icon={PiggyBank}
          title="Total Fund"
          value={fundTotal}
          lines={[`Cash: ${money(paymentTotal(funds, "Cash"))} | GPay: ${money(paymentTotal(funds, "GPay"))}`]}
          onMore={() => setActive("funds")}
        />
        <DashboardBlock
          className="bg-[#dc3545]"
          icon={ReceiptIndianRupee}
          title="Total Expense"
          value={expenseTotal}
          lines={[`Cash: ${money(paymentTotal(expenses, "Cash"))} | GPay: ${money(paymentTotal(expenses, "GPay"))}`, `Settled: ${money(settledTotal)} | Unsettled: ${money(unsettledTotal)}`]}
          onMore={() => setActive("expenses")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CountBlock animate className="bg-[#ffc107] text-[#1f2937]" icon={Home} title="Houses" value={houses.length} onMore={() => setActive("house")} />
          <CountBlock className="bg-[#007bff]" icon={UsersRound} title="Volunteers" value={volunteers.length} onMore={() => setActive("volunteers")} />
          <CountBlock animate className="bg-[#6f42c1]" icon={Calculator} title="Estimate" value={estimateTotal} format={money} onMore={() => setActive("estimates")} />
          <CountBlock animate className="bg-[#6c757d]" icon={ClipboardList} title="Todos" value={todos.length} onMore={() => setActive("todos")} />
        </div>
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RecentPanel title="Recent Funds" rows={funds.slice(0, 5)} columns={["type", "name", "amount", "paymentMethod"]} moneyColumns={["amount"]} addLabel="Add New Fund" viewLabel="View All Funds" onAdd={() => setActive("funds")} onView={() => setActive("funds")} />
        <RecentPanel
          title="Recent Expenses"
          rows={expenses.slice(0, 5)}
          columns={["category", "amount", "volunteerId"]}
          moneyColumns={["amount"]}
          addLabel="Add New Expense"
          viewLabel="View All Expense"
          onAdd={() => setActive("expenses")}
          onView={() => setActive("expenses")}
          onRowClick={setEditingExpense}
          rowClassName={(row) => !row.isSettled ? "bg-red-100 text-red-950 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/40" : ""}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>ToDo List</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {todos.map((todo) => <div key={rowId(todo)} className="flex items-center justify-between rounded-md border p-2 text-sm"><span className={todo.isDone ? "line-through text-muted-foreground" : ""}>{todo.title}</span><span>{todo.isDone ? "Completed" : "Pending"}</span></div>)}
            <div className="pt-2"><Button variant="outline" onClick={() => setActive("todos")}>View All</Button></div>
          </CardContent>
        </Card>
      </div>
      {editingExpense ? (
        <ExpenseEditModal
          expense={editingExpense}
          volunteers={volunteers}
          onClose={() => setEditingExpense(null)}
          onSaved={loadDashboard}
        />
      ) : null}
    </section>
  );
}

function YearComparisonChart({ data, selectedYear }: { data: YearComparison | null; selectedYear: string }) {
  const chartHeight = 190;
  const rows = data ? [
    { label: "Fund", previous: data.previous.fund, current: data.current.fund },
    { label: "Expense", previous: data.previous.expense, current: data.current.expense },
    { label: "Balance", previous: data.previous.balance, current: data.current.balance }
  ] : [];
  const maxValue = Math.max(1, ...rows.flatMap((row) => [Math.abs(row.current), Math.abs(row.previous)]));
  const axisStep = niceAxisStep(maxValue);
  const axisMax = axisStep * 4;
  const yTicks = [axisMax, axisMax * 0.75, axisMax * 0.5, axisMax * 0.25, 0];
  const currentLabel = data ? `Current Year (${data.currentYear})` : "Current Year";
  const previousLabel = data ? `Previous Year (${data.previousYear})` : "Previous Year";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between border-b">
        <CardTitle>Year Comparison</CardTitle>
        <div className="rounded-md border bg-muted/40 px-3 py-1 text-sm font-semibold text-muted-foreground">
          {data ? `${data.currentYear} vs ${data.previousYear}` : selectedYear ? "Loading..." : "Select year"}
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
        {data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground sm:text-sm">
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#19a7b8]/35" />{previousLabel}</span>
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#19a7b8]" />{currentLabel}</span>
            </div>
            <div className="overflow-x-auto">
              <div className="grid min-w-[440px] grid-cols-[50px_minmax(0,1fr)] grid-rows-[230px_auto_auto] sm:min-w-[680px] sm:grid-cols-[72px_minmax(0,1fr)] sm:grid-rows-[240px_auto_auto]">
                <div className="relative row-start-1 border-r border-border pr-3">
                  <span className="absolute -left-5 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-semibold text-muted-foreground sm:-left-3 sm:text-xs">Amount</span>
                  {yTicks.map((tick) => (
                    <span
                      key={tick}
                      className="absolute right-2 translate-y-1/2 text-right text-[10px] font-medium text-muted-foreground sm:right-3 sm:text-xs"
                      style={{ bottom: `${(tick / axisMax) * 100}%` }}
                    >
                      {compactIndianAmount(tick)}
                    </span>
                  ))}
                </div>
                <div className="relative row-start-1 border-b border-border">
                  {yTicks.slice(0, -1).map((tick) => (
                    <div
                      key={tick}
                      className="absolute left-0 right-0 border-t border-dashed border-border/70"
                      style={{ bottom: `${(tick / axisMax) * 100}%` }}
                    />
                  ))}
                  <div className="relative z-10 flex h-full items-end gap-3 px-2 sm:gap-6 sm:px-4">
                    {rows.map((row) => (
                      <div key={row.label} className="flex h-full flex-1 items-end justify-center gap-1.5 sm:gap-3">
                        <YearBar value={row.previous} maxValue={axisMax} chartHeight={chartHeight} colorClassName="bg-[#19a7b8]/35" />
                        <YearBar value={row.current} maxValue={axisMax} chartHeight={chartHeight} colorClassName="bg-[#19a7b8]" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-start-2 row-start-2 flex gap-3 px-2 pt-2 sm:gap-6 sm:px-4">
                  {rows.map((row) => <p key={row.label} className="flex-1 text-center text-xs font-semibold sm:text-sm">{row.label}</p>)}
                </div>
                <div className="col-start-2 row-start-3 pt-3 text-center text-xs font-semibold text-muted-foreground">Record Type</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Select a festival year to compare it with the previous year.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function niceAxisStep(maxValue: number) {
  if (maxValue <= 0) return 1000;
  const roughStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceMultiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceMultiplier * magnitude;
}

function compactIndianAmount(value: number) {
  const amount = Math.round(value);
  if (amount === 0) return "0";
  if (Math.abs(amount) >= 10000000) return `${formatCompactNumber(amount / 10000000)}Cr`;
  if (Math.abs(amount) >= 100000) return `${formatCompactNumber(amount / 100000)}L`;
  if (Math.abs(amount) >= 1000) return `${formatCompactNumber(amount / 1000)}K`;
  return String(amount);
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function YearBar({ value, maxValue, chartHeight, colorClassName }: { value: number; maxValue: number; chartHeight: number; colorClassName: string }) {
  const displayValue = useCountUpFromZero(value);
  const height = Math.max(displayValue ? 8 : 0, (Math.abs(displayValue) / maxValue) * chartHeight);

  return (
    <div className="relative h-full w-12 sm:w-24">
      <span
        className="absolute left-1/2 max-w-16 -translate-x-1/2 text-center text-[10px] font-semibold leading-tight sm:max-w-none sm:text-sm"
        style={{ bottom: height + 8 }}
      >
        {money(displayValue)}
      </span>
      <div
        className={cn("absolute bottom-0 left-0 w-full rounded-t-md shadow-sm", colorClassName, value < 0 && "opacity-70")}
        style={{ height }}
        title={money(value)}
      />
    </div>
  );
}

function useCountUpFromZero(value: number, duration = 1100) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }

    setDisplayValue(0);
    const startTime = performance.now();
    let frame = 0;

    function tick(now: number) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  return displayValue;
}

function ExpenseEditModal({ expense, volunteers, onClose, onSaved }: { expense: AnyRow; volunteers: AnyRow[]; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [festivals, setFestivals] = useState<AnyRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<AnyRow>({
    festivalId: rowId(expense.festivalId || expense.festival || {}),
    category: expense.category || "",
    amount: expense.amount || "",
    paymentMethod: expense.paymentMethod || "",
    description: expense.description || "",
    note: expense.note || "",
    volunteerId: rowId(expense.volunteerId || expense.volunteer || {}),
    isSettled: Boolean(expense.isSettled)
  });

  useEffect(() => {
    Promise.all([
      api<{ data: AnyRow[] }>("/festivals?page=1&limit=300"),
      api<{ data: string[] }>("/expenses/categories")
    ]).then(([festivalRes, categoryRes]) => {
      setFestivals(festivalRes.data || []);
      setCategories((categoryRes.data || []).filter(Boolean));
    }).catch(() => undefined);
  }, []);

  const festivalOptions = festivals.map((festival) => ({
    value: rowId(festival),
    label: festivalLabel(festival),
    search: `${festival.name || ""} ${festival.year || ""}`
  }));
  const volunteerOptions = volunteers.map((volunteer) => ({
    value: rowId(volunteer),
    label: volunteer.name || "",
    search: `${volunteer.phone || ""} ${volunteer.name || ""}`
  }));
  const categoryOptions = categories.map((category) => ({ value: category, label: category }));

  function setValue(key: string, value: string | boolean) {
    setForm((current: AnyRow) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value === "" ? null : value]));
      await api(`/expenses/${rowId(expense)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit Expense" onClose={onClose} wide>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <Field label="Festival"><SearchableSelect value={String(form.festivalId || "")} onChange={(value) => setValue("festivalId", value)} options={festivalOptions} placeholder="Search festival" /></Field>
        <Field label="Category"><SearchableSelect value={String(form.category || "")} onChange={(value) => setValue("category", value)} options={categoryOptions} placeholder="Search category" allowCustom /></Field>
        <Field label="Amount"><Input type="number" value={String(form.amount ?? "")} onChange={(event) => setValue("amount", event.target.value)} required /></Field>
        <Field label="Payment Method"><SelectBox value={String(form.paymentMethod || "")} onChange={(event) => setValue("paymentMethod", event.target.value)}><option value="">Select</option><option value="Cash">Cash</option><option value="GPay">GPay</option></SelectBox></Field>
        <Field label="Description"><Input value={String(form.description || "")} onChange={(event) => setValue("description", event.target.value)} /></Field>
        <Field label="Note"><Input value={String(form.note || "")} onChange={(event) => setValue("note", event.target.value)} /></Field>
        <Field label="Volunteer"><SearchableSelect value={String(form.volunteerId || "")} onChange={(value) => setValue("volunteerId", value)} options={volunteerOptions} placeholder="Search volunteer" /></Field>
        <Field label="Settled"><input className="h-5 w-5 accent-primary" type="checkbox" checked={Boolean(form.isSettled)} onChange={(event) => setValue("isSettled", event.target.checked)} /></Field>
        {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
        <div className="grid gap-2 md:col-span-2 sm:flex sm:flex-wrap">
          <Button className="w-full sm:w-auto" type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button className="w-full sm:w-auto" type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

function useAnimatedNumber(value: number, duration = 900) {
  const [displayValue, setDisplayValue] = useState(0);
  const displayValueRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      displayValueRef.current = value;
      setDisplayValue(value);
      return;
    }

    const startValue = displayValueRef.current;
    const change = value - startValue;
    const startTime = performance.now();
    let frame = 0;

    function tick(now: number) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + (change * eased);
      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  return displayValue;
}

function CountUpText({ value, format = (item) => String(Math.round(item)) }: { value: number; format?: (value: number) => string }) {
  const displayValue = useAnimatedNumber(value);
  return <>{format(displayValue)}</>;
}

function AnimatedProgressMeter({ progress, start, end }: { progress: number; start: number; end: number }) {
  const displayProgress = Math.max(0, Math.min(100, useAnimatedNumber(progress)));

  return (
    <div className="w-full min-w-0 sm:min-w-64 sm:flex-1">
      <div className="text-center text-sm font-semibold text-primary sm:text-base">
        <CountUpText value={progress} format={(value) => `${value.toFixed(2)}%`} />
      </div>
      <div className="mt-1 h-4 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-[repeating-linear-gradient(45deg,#1aa7b8_0,#1aa7b8_8px,#38bfd0_8px,#38bfd0_16px)] transition-[width]"
          style={{ width: `${displayProgress}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs font-semibold text-muted-foreground sm:text-sm">
        <span><CountUpText value={start} format={money} /></span>
        <span><CountUpText value={end} format={money} /></span>
      </div>
    </div>
  );
}

function DashboardBlock({ className, icon: Icon, title, value, lines, onMore }: { className: string; icon: typeof Home; title: string; value: number; lines: string[]; onMore?: () => void }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md text-white shadow-sm", className)}>
      <Icon className="pointer-events-none absolute right-4 top-1/2 h-24 w-24 -translate-y-1/2 opacity-20 sm:right-6 sm:h-32 sm:w-32" />
      <div className="relative z-10 space-y-4 p-4 pr-20 sm:space-y-5 sm:p-5 sm:pr-28">
        <p className="break-words text-3xl font-semibold sm:text-5xl"><CountUpText value={value} format={money} /></p>
        <div>
          <p className="text-lg font-medium sm:text-xl">{title}</p>
          <div className="mt-4 space-y-1 text-sm font-semibold sm:mt-6 sm:text-lg">{lines.map((line) => <p key={line}>{line}</p>)}</div>
        </div>
      </div>
      {onMore ? <button className="w-full bg-black/10 px-3 py-2 text-lg font-semibold hover:bg-black/20" type="button" onClick={onMore}>More info</button> : <div className="h-11 bg-black/5" />}
    </div>
  );
}

function CountBlock({ className, icon: Icon, title, value, format, animate, onMore }: { className: string; icon: typeof Home; title: string; value: number; format?: (value: number) => string; animate?: boolean; onMore?: () => void }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md text-white shadow-sm", className)}>
      <Icon className="pointer-events-none absolute right-4 top-1/2 h-20 w-20 -translate-y-1/2 opacity-20 sm:h-24 sm:w-24" />
      <div className="relative z-10 p-4 pr-20 sm:p-5 sm:pr-24">
        <p className="break-words text-3xl font-semibold sm:text-5xl">{animate ? <CountUpText value={value} format={format} /> : format ? format(value) : value}</p>
        <p className="mt-4 text-lg sm:mt-5 sm:text-xl">{title}</p>
      </div>
      {onMore ? <button className="w-full bg-black/10 px-3 py-2 text-lg font-semibold hover:bg-black/20" type="button" onClick={onMore}>More info</button> : <div className="h-11 bg-black/5" />}
    </div>
  );
}

function RecentPanel({ title, rows, columns, moneyColumns, addLabel, viewLabel, onAdd, onView, renderCell, rowClassName, onRowClick }: { title: string; rows: AnyRow[]; columns: string[]; moneyColumns: string[]; addLabel: string; viewLabel: string; onAdd: () => void; onView: () => void; renderCell?: (row: AnyRow, column: string) => React.ReactNode | undefined; rowClassName?: (row: AnyRow) => string; onRowClick?: (row: AnyRow) => void }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b">
        <CardTitle>{title}</CardTitle>
        <div className="flex gap-4 text-xl text-muted-foreground"><span>-</span><span>x</span></div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="min-w-0">
          <DataTable rows={rows} columns={columns} moneyColumns={moneyColumns} renderCell={renderCell} rowClassName={rowClassName} onRowClick={onRowClick} />
        </div>
        <div className="grid gap-2 border-t p-3 sm:flex sm:justify-between sm:p-4">
          <Button className="w-full sm:w-auto" onClick={onAdd}><Plus className="h-4 w-4" /> {addLabel}</Button>
          <Button className="w-full sm:w-auto" variant="outline" onClick={onView}>{viewLabel}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FundPage() {
  const [year, setYear] = useState(String(currentYear));
  const [volunteerId, setVolunteerId] = useState("");
  const [amount, setAmount] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sort, setSort] = useState("-createdAt");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [volunteers, setVolunteers] = useState<AnyRow[]>([]);
  const [modal, setModal] = useState<"form" | "unpaid" | "summary" | "whatsapp" | null>(null);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [draftFund, setDraftFund] = useState<AnyRow | null>(null);
  const [unpaid, setUnpaid] = useState<AnyRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [whatsApp, setWhatsApp] = useState<{ fund: AnyRow; phones: string[] } | null>(null);

  async function load() {
    const params = toQuery({ page, limit: pageSize, search, sort, festivalYear: year, volunteerId, amount, startDate, endDate });
    const [fundRes, volunteerRes] = await Promise.all([
      api<{ data: AnyRow[]; pagination?: Pagination }>(`/funds${params}`),
      api<{ data: AnyRow[] }>("/volunteers?page=1&limit=300")
    ]);
    setRows(fundRes.data || []);
    setPagination(fundRes.pagination || { total: fundRes.data?.length || 0, page, limit: pageSize, totalPages: 1 });
    setVolunteers(volunteerRes.data || []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [year, volunteerId, amount, search, startDate, endDate, sort, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [year, volunteerId, amount, search, startDate, endDate, sort, pageSize]);

  async function remove(id: string) {
    if (!confirm("Are you sure want to delete this fund ?")) return;
    await api(`/funds/${id}`, { method: "DELETE" });
    await load();
  }

  async function downloadReceipt(id: string) {
    const blob = await apiBlob(`/funds/download/${id}?action=download`);
    downloadBlob(blob, `receipt_${id}.pdf`);
  }

  async function openUnpaid() {
    const res = await api<{ sortedHouses: AnyRow[] }>(`/funds/unpaid${toQuery({ festivalYear: year })}`);
    setUnpaid(res.sortedHouses || []);
    setModal("unpaid");
  }

  async function openSummary() {
    const res = await api<any>(`/funds/summary-by-volunteers${toQuery({ festivalYear: year })}`);
    setSummary(res);
    setModal("summary");
  }

  function openWhatsApp(fund: AnyRow) {
    const house = fund.houseId || fund.house;
    const primary = fund.type === "house" ? house?.phone : "";
    const alternative = fund.alternativePhone;
    const phones = Array.from(new Set([primary, alternative].filter(Boolean)));
    setWhatsApp({ fund, phones });
    setModal("whatsapp");
  }

  function openFundForUnpaidHouse(house: AnyRow) {
    setEditing(null);
    setDraftFund({
      type: "house",
      houseId: house,
      name: house.ownerName || "",
      alternativePhone: house.phone || "",
      festivalYear: year || currentYear
    });
    setModal("form");
  }

  const columns = ["type", "name", "houseId", "amount", "volunteerId", "paymentMethod", "reference", "__delete"];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Fund List</h1>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-flow-col sm:auto-cols-max">
          <Button className="w-full sm:w-auto" variant="outline" onClick={openSummary}><UsersRound className="h-4 w-4" /> Volunteer Summary</Button>
          <Button className="w-full sm:w-auto" variant="outline" onClick={openUnpaid}><Home className="h-4 w-4" /> Unpaid List</Button>
          <Button className="w-full sm:w-auto" onClick={() => { setEditing(null); setDraftFund(null); setModal("form"); }}><Plus className="h-4 w-4" /> Add Fund</Button>
        </div>
      </div>
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => setSort("-createdAt")}><RefreshCcw className="h-4 w-4" /> Reset Sort</Button>
            <SelectBox className="sm:w-auto" value={year} onChange={(event) => setYear(event.target.value)}><option value="">All</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</SelectBox>
            <SelectBox className="sm:w-auto" value={volunteerId} onChange={(event) => setVolunteerId(event.target.value)}>
              <option value="">All Volunteers</option>
              {volunteers.map((volunteer) => <option key={rowId(volunteer)} value={rowId(volunteer)}>{volunteer.name}</option>)}
            </SelectBox>
            <Input className="sm:w-36" placeholder="Search amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <div className="relative sm:w-44">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Input className="sm:w-40" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <Input className="sm:w-40" type="date" value={endDate} min={startDate} disabled={!startDate} onChange={(event) => setEndDate(event.target.value)} />
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => { setStartDate(""); setEndDate(""); }}>Clear Dates</Button>
          </div>
          <DataTable
            rows={rows}
            columns={columns}
            moneyColumns={["amount"]}
            sortableColumns={["amount"]}
            onSort={(column) => setSort(sort === column ? `-${column}` : column)}
            stickyActions
            columnClassName={(column) => fundColumnClassName(column)}
            renderHeader={(column) => column === "type" ? (
              <>
                <span className="md:hidden">#</span>
                <span className="hidden md:inline">Type</span>
              </>
            ) : undefined}
            renderCell={(row, column) => {
              if (column === "type") {
                const type = capitalizeFirst(row.type);
                return (
                  <>
                    <span className="md:hidden">{type.charAt(0)}</span>
                    <span className="hidden md:inline">{type}</span>
                  </>
                );
              }
              if (column === "__delete") {
                return <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(rowId(row))}><Trash2 className="h-4 w-4" /></Button>;
              }
              return undefined;
            }}
            actions={(row) => (
              <div className="flex gap-1">
                <Button className="max-md:h-8 max-md:min-h-8 max-md:w-8" variant="outline" size="icon" title="Receipt" onClick={() => downloadReceipt(rowId(row))}><ReceiptText className="h-4 w-4" /></Button>
                <Button className="max-md:h-8 max-md:min-h-8 max-md:w-8" variant="outline" size="icon" title="WhatsApp" onClick={() => openWhatsApp(row)}><WhatsAppIcon /></Button>
                <Button className="max-md:h-8 max-md:min-h-8 max-md:w-8" variant="outline" size="icon" title="Edit" onClick={() => { setEditing(row); setModal("form"); }}><Pencil className="h-4 w-4" /></Button>
                <Button className="hidden md:inline-flex" variant="ghost" size="icon" title="Delete" onClick={() => remove(rowId(row))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}
          />
          <PaginationControls
            pagination={pagination}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
      {modal === "form" ? <FundForm fund={editing} initialFund={draftFund} volunteers={volunteers} year={year} onClose={() => { setDraftFund(null); setModal(null); }} onSaved={load} /> : null}
      {modal === "unpaid" ? <UnpaidModal houses={unpaid} onClose={() => setModal(null)} onSelectHouse={openFundForUnpaidHouse} /> : null}
      {modal === "summary" ? <VolunteerSummaryModal summary={summary} onClose={() => setModal(null)} /> : null}
      {modal === "whatsapp" && whatsApp ? <WhatsAppModal fund={whatsApp.fund} phones={whatsApp.phones} onClose={() => setModal(null)} /> : null}
    </section>
  );
}

function FundForm({ fund, initialFund, volunteers, year, onClose, onSaved }: { fund: AnyRow | null; initialFund?: AnyRow | null; volunteers: AnyRow[]; year: string; onClose: () => void; onSaved: () => void }) {
  const [houses, setHouses] = useState<AnyRow[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [savingMode, setSavingMode] = useState<"close" | "new" | "download" | null>(null);
  const source = fund || initialFund || {};
  const [form, setForm] = useState<AnyRow>({
    type: source.type || "",
    houseId: rowId(source.houseId || {}) || "",
    name: source.name || "",
    amount: source.amount || "",
    paymentMethod: source.paymentMethod || "",
    reference: source.reference || "",
    date: String(source.date || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    festivalYear: source.festivalYear || year || currentYear,
    alternativePhone: source.alternativePhone || "",
    volunteerId: rowId(source.volunteerId || {}) || ""
  });

  useEffect(() => {
    api<{ data: AnyRow[] }>("/house?page=1&limit=500").then((res) => setHouses(res.data || [])).catch(() => undefined);
  }, []);

  const houseOptions = houses.map((house) => ({
    value: rowId(house),
    label: `${house.houseNumber || ""} - ${house.ownerName || ""}`.trim(),
    search: `${house.phone || ""} ${house.ownerName || ""} ${house.houseNumber || ""}`
  }));
  const volunteerOptions = volunteers.map((volunteer) => ({
    value: rowId(volunteer),
    label: volunteer.name || "",
    search: `${volunteer.phone || ""} ${volunteer.name || ""}`
  }));
  const bccbBankVolunteerId = rowId(volunteers.find((volunteer) => String(volunteer.name || "").toLowerCase().includes("bccb bank")) || {});

  function setValue(key: string, value: string) {
    const next = { ...form, [key]: value };
    if (key === "paymentMethod" && value === "GPay" && bccbBankVolunteerId) {
      next.volunteerId = bccbBankVolunteerId;
    }
    if (key === "houseId") {
      const selected = houses.find((house) => rowId(house) === value);
      if (selected) {
        next.name = selected.ownerName || next.name;
        next.alternativePhone = selected.phone || next.alternativePhone;
      }
    }
    setForm(next);
  }

  async function submit(event: FormEvent, mode: "close" | "new" | "download" = "close") {
    event.preventDefault();
    if (savingMode) return;
    setSavingMode(mode);
    try {
      const payload = { ...form };
      if (payload.type !== "house") {
        delete payload.houseId;
        delete payload.alternativePhone;
      }
      const res = await api<{ data: AnyRow }>(fund ? `/funds/${rowId(fund)}` : "/funds", {
        method: fund ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      await onSaved();
      if (mode === "download") {
        const id = rowId(res.data);
        const blob = await apiBlob(`/funds/download/${id}?action=download`);
        downloadBlob(blob, `receipt_${id}.pdf`);
      }
      if (mode === "new") {
        setForm({ ...form, name: "", amount: "", reference: "", houseId: "" });
        return;
      }
      onClose();
    } finally {
      setSavingMode(null);
    }
  }

  const saving = savingMode !== null;

  return (
    <Modal title={fund ? "Edit Fund" : "Add Fund"} onClose={onClose} wide>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => submit(event)}>
        <Field label="Type"><SelectBox value={form.type} onChange={(event) => setValue("type", event.target.value)} required><option value="">Select</option><option value="house">House</option><option value="sponsor">Sponsor</option><option value="donor">Donor</option><option value="balance">Balance</option><option value="aarti">Aarti</option></SelectBox></Field>
        <Field label="House"><SearchableSelect value={form.houseId} onChange={(value) => setValue("houseId", value)} disabled={form.type !== "house"} options={houseOptions} placeholder="Search house" /></Field>
        <Field label="Name"><Input value={form.name} onChange={(event) => setValue("name", event.target.value)} disabled={form.type === "aarti"} /></Field>
        <Field label="Amount"><Input type="number" value={form.amount} onChange={(event) => setValue("amount", event.target.value)} required /></Field>
        <Field label="Payment Method"><SelectBox value={form.paymentMethod} onChange={(event) => setValue("paymentMethod", event.target.value)} required><option value="">Select</option><option value="Cash">Cash</option><option value="GPay">GPay</option></SelectBox></Field>
        <Field label="Reference"><Input value={form.reference} onChange={(event) => setValue("reference", event.target.value)} /></Field>
        <Field label="Date"><Input type="date" value={form.date} onChange={(event) => setValue("date", event.target.value)} /></Field>
        <Field label="Festival Year"><SelectBox value={form.festivalYear} onChange={(event) => setValue("festivalYear", event.target.value)}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</SelectBox></Field>
        <Field label="Alternative Phone"><Input value={form.alternativePhone} onChange={(event) => setValue("alternativePhone", event.target.value)} /></Field>
        <Field label="Volunteer"><SearchableSelect value={form.volunteerId} onChange={(value) => setValue("volunteerId", value)} options={volunteerOptions} placeholder="Search volunteer" /></Field>
        <div className="md:col-span-2">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted sm:w-auto"
            onClick={() => setQrOpen(true)}
          >
            <QrCode className="h-4 w-4 shrink-0" />
            Open QR Code
          </button>
        </div>
        <div className="grid gap-2 md:col-span-2 sm:flex sm:flex-wrap">
          <Button className="w-full sm:w-auto" type="submit" disabled={saving}>
            {savingMode === "close" ? <RefreshCcw className="h-4 w-4 animate-spin" /> : null}
            {savingMode === "close" ? "Saving..." : "Save"}
          </Button>
          <Button className="w-full sm:w-auto" type="button" variant="secondary" disabled={saving} onClick={(event) => submit(event as unknown as FormEvent, "download")}>
            {savingMode === "download" ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {savingMode === "download" ? "Saving..." : "Save & Download"}
          </Button>
          <Button className="w-full sm:w-auto" type="button" variant="outline" disabled={saving} onClick={(event) => submit(event as unknown as FormEvent, "new")}>
            {savingMode === "new" ? <RefreshCcw className="h-4 w-4 animate-spin" /> : null}
            {savingMode === "new" ? "Saving..." : "Save & New"}
          </Button>
          <Button className="w-full sm:w-auto" type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
        </div>
      </form>
      {qrOpen ? (
        <Modal title="Google Pay QR" onClose={() => setQrOpen(false)}>
          <div className="flex justify-center">
            <img src={gpayQr} alt="Google Pay QR" className="max-h-[70vh] w-full max-w-md rounded-md border bg-white object-contain p-3" />
          </div>
        </Modal>
      ) : null}
    </Modal>
  );
}

function Reports({ publicMode = false }: { publicMode?: boolean }) {
  const [year, setYear] = useState(String(currentYear));
  const [reportData, setReportData] = useState<any>({ income: 0, expenses: {}, totalExpense: 0, balance: 0 });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const prefix = publicMode ? "/public/reports" : "/reports";
    api<{ data: any }>(`${prefix}/yearly-report${toQuery({ year })}`, { auth: !publicMode }).then((res) => setReportData(res.data || {})).catch(() => undefined);
  }, [publicMode, year]);

  async function downloadReport() {
    setDownloading(true);
    try {
      const prefix = publicMode ? "/public/reports" : "/reports";
      const blob = await apiBlob(`${prefix}/download-report${toQuery({ year })}`, { auth: !publicMode });
      downloadBlob(blob, `festival_income_expense_report_${year}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  const incomeKeys = Object.keys(reportData.incomeGroup || {});
  const festivalKeys = Object.keys(reportData.expenses || {});

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Festival Income & Expense Report</h1>
      </div>
      <Card>
        <CardContent className="grid gap-3 pt-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-end">
            <Field label="Filter Year">
              <SelectBox className="sm:w-32" value={year} onChange={(event) => setYear(event.target.value)}>
                <option value="">All</option>
                {years.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectBox>
            </Field>
          </div>
          <Button className="w-full sm:w-auto" onClick={downloadReport} disabled={downloading}>
            <Download className="h-4 w-4" /> {downloading ? "Exporting..." : "Export PDF"}
          </Button>
        </CardContent>
      </Card>
      <div className="sm:hidden">
        <MobileReportView reportData={reportData} incomeKeys={incomeKeys} festivalKeys={festivalKeys} />
      </div>
      <Card className="hidden sm:block">
        <CardContent className="overflow-x-auto p-2 sm:p-5">
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow className="border-[#343a40] bg-[#212529] hover:bg-[#212529]">
                <TableHead className="h-11 text-center text-sm font-bold text-white sm:text-base">Title</TableHead>
                <TableHead className="h-11 text-center text-sm font-bold text-white sm:text-base">Income</TableHead>
                <TableHead className="h-11 text-center text-sm font-bold text-white sm:text-base">Expense</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="h-10">
                <TableCell className="py-2 text-sm font-bold sm:text-base">Total Income</TableCell>
                <TableCell className="py-2 text-right text-sm font-bold sm:text-base">{money(reportData.income)}</TableCell>
                <TableCell />
              </TableRow>
              {incomeKeys.map((key) => (
                <TableRow className="h-10" key={key}>
                  <TableCell className="py-2 pr-4 text-right text-sm italic sm:text-base">{incomeLabel(key)}</TableCell>
                  <TableCell className="py-2 text-right text-sm sm:text-base">{money(reportData.incomeGroup[key].total)}</TableCell>
                  <TableCell />
                </TableRow>
              ))}
              {festivalKeys.map((festival) => (
                <Fragment key={festival}>
                  <TableRow className="h-10 bg-[#b8dcff] hover:bg-[#b8dcff]">
                    <TableCell className="py-2 text-sm font-bold text-black sm:text-base" colSpan={3}>{festival}</TableCell>
                  </TableRow>
                  {Object.keys(reportData.expenses[festival] || {}).map((category) => (
                    <Fragment key={`${festival}-${category}`}>
                      <TableRow className="h-10 bg-[#e4ebf2] hover:bg-[#e4ebf2] dark:bg-[#263443] dark:hover:bg-[#263443]">
                        <TableCell className="py-2 pr-6 text-right text-sm italic text-slate-950 dark:text-slate-100 sm:text-base">{category}</TableCell>
                        <TableCell />
                        <TableCell className="py-2 pr-4 text-right text-sm font-bold text-slate-950 dark:text-slate-100 sm:text-base">{money(reportData.expenses[festival][category].total)}</TableCell>
                      </TableRow>
                      {(reportData.expenses[festival][category].items || []).map((item: AnyRow, index: number) => (
                        <TableRow className="h-10" key={`${festival}-${category}-${index}`}>
                          <TableCell className="py-2 pr-4 text-right text-sm sm:text-base">{item.title || item.description || "-"}</TableCell>
                          <TableCell />
                          <TableCell className="py-2 text-right text-sm sm:text-base">{money(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                  <TableRow className="h-10">
                    <TableCell className="py-2 pr-4 text-right text-sm font-bold sm:text-base">Subtotal - {festival}</TableCell>
                    <TableCell />
                    <TableCell className="py-2 text-right text-sm font-bold sm:text-base">{money(festivalTotal(reportData.expenses[festival]))}</TableCell>
                  </TableRow>
                  <TableRow className="h-3"><TableCell className="py-1" colSpan={3} /></TableRow>
                </Fragment>
              ))}
              <TableRow className="h-10">
                <TableCell className="py-2 text-sm font-bold sm:text-base">Total</TableCell>
                <TableCell className="py-2 text-right text-sm font-bold sm:text-base">{money(reportData.income)}</TableCell>
                <TableCell className="py-2 text-right text-sm font-bold sm:text-base">{money(reportData.totalExpense)}</TableCell>
              </TableRow>
              <TableRow className="h-10">
                <TableCell className="py-2 text-sm font-bold sm:text-base">Balance</TableCell>
                <TableCell />
                <TableCell className={cn("py-2 text-right text-sm font-bold sm:text-base", Number(reportData.balance || 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>{money(reportData.balance)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function MobileReportView({ reportData, incomeKeys, festivalKeys }: { reportData: any; incomeKeys: string[]; festivalKeys: string[] }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <ReportMetric label="Income" value={reportData.income} />
        <ReportMetric label="Expense" value={reportData.totalExpense} />
        <ReportMetric
          className="col-span-2"
          label="Balance"
          value={reportData.balance}
          valueClassName={Number(reportData.balance || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}
        />
      </div>

      {incomeKeys.length ? (
        <div className="rounded-md border bg-card">
          <div className="border-b px-3 py-2 text-sm font-semibold">Income</div>
          <div className="divide-y">
            {incomeKeys.map((key) => (
              <ReportAmountRow key={key} label={incomeLabel(key)} value={reportData.incomeGroup[key].total} />
            ))}
          </div>
        </div>
      ) : null}

      {festivalKeys.map((festival) => (
        <div className="rounded-md border bg-card" key={festival}>
          <div className="flex items-center justify-between gap-3 border-b bg-[#b8dcff] px-3 py-2 text-sm font-bold text-black">
            <span className="min-w-0 break-words">{festival}</span>
            <span className="shrink-0">{money(festivalTotal(reportData.expenses[festival]))}</span>
          </div>
          <div className="divide-y">
            {Object.keys(reportData.expenses[festival] || {}).map((category) => (
              <div className="space-y-2 px-3 py-2" key={`${festival}-${category}`}>
                <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                  <span className="min-w-0 break-words italic">{category}</span>
                  <span className="shrink-0">{money(reportData.expenses[festival][category].total)}</span>
                </div>
                <div className="space-y-1">
                  {(reportData.expenses[festival][category].items || []).map((item: AnyRow, index: number) => (
                    <ReportAmountRow
                      compact
                      key={`${festival}-${category}-${index}`}
                      label={item.title || item.description || "-"}
                      value={item.amount}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportMetric({ label, value, className, valueClassName }: { label: string; value: unknown; className?: string; valueClassName?: string }) {
  return (
    <div className={cn("rounded-md border bg-card p-3", className)}>
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className={cn("mt-1 break-words text-lg font-bold", valueClassName)}>{money(value)}</div>
    </div>
  );
}

function ReportAmountRow({ label, value, compact = false }: { label: string; value: unknown; compact?: boolean }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-3 py-2 text-sm", compact && "px-0 py-0.5 text-xs text-muted-foreground")}>
      <span className="min-w-0 break-words">{label}</span>
      <span className="shrink-0 font-semibold text-foreground">{money(value)}</span>
    </div>
  );
}

function ResourcePage({ config }: { config: ResourceConfig }) {
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(config.key === "festivals" || config.key === "estimates" || config.key === "expenses" ? String(currentYear) : "");
  const [festivalId, setFestivalId] = useState("");
  const [volunteerId, setVolunteerId] = useState("");
  const [amount, setAmount] = useState("");
  const [todoStatus, setTodoStatus] = useState("");
  const [todoSort, setTodoSort] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [festivals, setFestivals] = useState<AnyRow[]>([]);
  const [volunteers, setVolunteers] = useState<AnyRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState<AnyRow>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedVolunteer, setExpandedVolunteer] = useState<Record<string, boolean>>({});
  const [volunteerExpenses, setVolunteerExpenses] = useState<Record<string, AnyRow[]>>({});
  const [settlementExpense, setSettlementExpense] = useState<AnyRow | null>(null);
  const [settlementSaving, setSettlementSaving] = useState(false);
  const role = localStorage.getItem("role");
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}") as AnyRow;
    } catch {
      return {};
    }
  })();

  async function load() {
    const params: Record<string, string | number | undefined> = { page, limit: pageSize, search };
    if (config.key === "festivals") params.year = year;
    if (config.key === "estimates" || config.key === "expenses") {
      params.festivalYear = festivalId ? "" : year;
      params.festivalId = festivalId;
      params.amount = amount;
    }
    if (config.key === "expenses") params.volunteerId = volunteerId;
    if (config.key === "todos") {
      params.isDone = todoStatus;
      params.sort = todoSort === "asc" ? "createdAt" : "-createdAt";
    }
    const response = await api<{ data: AnyRow[]; pagination?: Pagination }>(`${config.path}${toQuery(params)}`);
    setRows(response.data || []);
    setPagination(response.pagination || { total: response.data?.length || 0, page, limit: pageSize, totalPages: 1 });
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [config.path, search, year, festivalId, volunteerId, amount, todoStatus, todoSort, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [config.path, search, year, festivalId, volunteerId, amount, todoStatus, todoSort, pageSize]);

  useEffect(() => {
    if (config.key === "estimates" || config.key === "expenses") {
      api<{ data: AnyRow[] }>("/festivals?page=1&limit=300").then((res) => setFestivals(res.data || [])).catch(() => undefined);
    }
    if (config.key === "expenses") {
      api<{ data: AnyRow[] }>("/volunteers?page=1&limit=300").then((res) => setVolunteers(res.data || [])).catch(() => undefined);
    }
  }, [config.key]);

  useEffect(() => {
    const categoryEndpoints: Partial<Record<ResourceKey, string>> = {
      estimates: "/estimates/categories",
      expenses: "/expenses/categories",
      inventory: "/inventory/category"
    };
    const endpoint = categoryEndpoints[config.key];
    if (!endpoint) {
      setCategories([]);
      return;
    }
    api<{ data: string[] }>(endpoint)
      .then((res) => setCategories((res.data || []).filter(Boolean)))
      .catch(() => setCategories([]));
  }, [config.key]);

  function edit(row: AnyRow) {
    const next: AnyRow = {};
    config.fields.forEach((field) => {
      const value = row[field.key];
      if (field.key === "festivalId" || field.key === "volunteerId") {
        next[field.key] = value && typeof value === "object" ? rowId(value) : value == null ? "" : String(value);
        return;
      }
      next[field.key] = typeof value === "boolean" ? value : value == null ? "" : String(value).slice(0, field.type === "date" ? 10 : undefined);
    });
    setEditingId(rowId(row));
    setForm(next);
    setShowForm(true);
    setTimeout(() => document.getElementById("resource-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function openForm() {
    setForm({});
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById("resource-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const body = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value === "" ? null : value]));
    await api(editingId ? `${config.path}/${editingId}` : config.path, { method: editingId ? "PUT" : "POST", body: JSON.stringify(body) });
    if (typeof body.category === "string" && body.category.trim()) {
      setCategories((current) => current.includes(body.category as string) ? current : [...current, body.category as string]);
    }
    setForm({});
    setEditingId(null);
    setShowForm(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Are you sure want to delete this record ?")) return;
    await api(`${config.path}/${id}`, { method: "DELETE" });
    await load();
  }

  function expenseVolunteerId(expense: AnyRow) {
    const volunteer = expense.volunteerId || expense.volunteer;
    if (volunteer && typeof volunteer === "object") return rowId(volunteer);
    return String(volunteer || "");
  }

  function canToggleSettlement(expense: AnyRow) {
    return role === "admin" || (role === "volunteer" && currentUser?.id === expenseVolunteerId(expense));
  }

  async function confirmExpenseSettlement() {
    if (!settlementExpense) return;
    const isSettled = Boolean(settlementExpense.isSettled);
    setSettlementSaving(true);
    try {
      await api("/expenses/settle", {
        method: "PUT",
        body: JSON.stringify({ expenseId: rowId(settlementExpense), isSettled: !isSettled })
      });
      setSettlementExpense(null);
      await load();
    } finally {
      setSettlementSaving(false);
    }
  }

  async function toggleVolunteerExpenses(volunteer: AnyRow) {
    const id = rowId(volunteer);
    setExpandedVolunteer((current) => ({ ...current, [id]: !current[id] }));
    if (!volunteerExpenses[id]) {
      const res = await api<{ data: AnyRow[] }>(`/expenses/volunteer/${id}`);
      setVolunteerExpenses((current) => ({ ...current, [id]: res.data || [] }));
    }
  }

  const festivalOptions = festivals.map((festival) => ({
    value: rowId(festival),
    label: festivalLabel(festival),
    search: `${festival.name || ""} ${festival.year || ""}`
  }));
  const volunteerOptions = volunteers.map((volunteer) => ({
    value: rowId(volunteer),
    label: volunteer.name || "",
    search: `${volunteer.phone || ""} ${volunteer.name || ""}`
  }));
  const categoryOptions = categories.map((category) => ({ value: category, label: category }));
  const relationOptions = { festivalId: festivalOptions, volunteerId: volunteerOptions, category: categoryOptions };

  return (
    <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div id="resource-form" className={cn("min-w-0 xl:hidden", showForm ? "block" : "hidden")}>
        <ResourceFormCard config={config} editingId={editingId} form={form} relationOptions={relationOptions} setForm={setForm} onSave={save} onClear={() => { setForm({}); setEditingId(null); setShowForm(false); }} />
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{config.title} List</h1>
          <Button className="w-full sm:w-auto" onClick={openForm}><Plus className="h-4 w-4" /> {`Add ${config.title}`}</Button>
        </div>
        <Card>
          <CardContent className="grid gap-2 pt-4 sm:flex sm:flex-wrap sm:items-center">
            {config.key === "festivals" || config.key === "estimates" || config.key === "expenses" ? <SelectBox className="sm:w-auto" value={year} onChange={(event) => { setYear(event.target.value); if (event.target.value) setFestivalId(""); }}><option value="">All</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</SelectBox> : null}
            {config.key === "estimates" || config.key === "expenses" ? <SelectBox className="sm:w-56" value={festivalId} onChange={(event) => { setFestivalId(event.target.value); if (event.target.value) setYear(""); }}><option value="">All Festivals</option>{festivals.map((festival) => <option key={rowId(festival)} value={rowId(festival)}>{festival.name} ({festival.year})</option>)}</SelectBox> : null}
            {config.key === "expenses" ? <SelectBox className="sm:w-48" value={volunteerId} onChange={(event) => setVolunteerId(event.target.value)}><option value="">All Volunteers</option>{volunteers.map((volunteer) => <option key={rowId(volunteer)} value={rowId(volunteer)}>{volunteer.name}</option>)}</SelectBox> : null}
            {config.key === "estimates" || config.key === "expenses" ? <Input className="sm:w-36" placeholder="Search amount" value={amount} onChange={(event) => setAmount(event.target.value)} /> : null}
            {config.key === "todos" ? <SelectBox className="sm:w-auto" value={todoStatus} onChange={(event) => setTodoStatus(event.target.value)}><option value="">All</option><option value="false">Pending</option><option value="true">Completed</option></SelectBox> : null}
            {config.key === "todos" ? <SelectBox className="sm:w-auto" value={todoSort} onChange={(event) => setTodoSort(event.target.value)}><option value="desc">Latest First</option><option value="asc">Oldest First</option></SelectBox> : null}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-0 overflow-hidden"><CardContent className="min-w-0 p-0">
          {config.key === "volunteers" ? (
            <VolunteerTable rows={rows} expanded={expandedVolunteer} expenses={volunteerExpenses} onToggle={toggleVolunteerExpenses} onEdit={edit} onDelete={(row) => remove(rowId(row))} />
          ) : (
            <DataTable
              rows={rows}
              columns={config.columns}
              moneyColumns={["amount", "estimatedAmount"]}
              renderCell={(row, column) => config.key === "expenses" && column === "isSettled" ? (
                <SettlementBadge disabled={!canToggleSettlement(row)} isSettled={Boolean(row.isSettled)} onToggle={() => setSettlementExpense(row)} />
              ) : undefined}
              actions={(row) => <div className="flex gap-1"><Button variant="outline" size="icon" onClick={() => edit(row)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove(rowId(row))}><Trash2 className="h-4 w-4" /></Button></div>}
            />
          )}
          <PaginationControls
            pagination={pagination}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent></Card>
      </div>
      <div className="hidden min-w-0 xl:block" id="resource-form-desktop">
        <ResourceFormCard config={config} editingId={editingId} form={form} relationOptions={relationOptions} setForm={setForm} onSave={save} onClear={() => { setForm({}); setEditingId(null); }} />
      </div>
      {settlementExpense ? (
        <SettlementConfirmModal
          expense={settlementExpense}
          loading={settlementSaving}
          onClose={() => !settlementSaving && setSettlementExpense(null)}
          onConfirm={confirmExpenseSettlement}
        />
      ) : null}
    </section>
  );
}

function SettlementConfirmModal({ expense, loading, onClose, onConfirm }: { expense: AnyRow; loading: boolean; onClose: () => void; onConfirm: () => void }) {
  const isSettled = Boolean(expense.isSettled);
  const action = isSettled ? "unsettle" : "settle";
  return (
    <Modal title="Confirm Settlement" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm">
          Are you sure want to {action} this expense?
        </p>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p><strong>{display(expense.category || expense.description || "Expense")}</strong></p>
          <p className="text-muted-foreground">{money(expense.amount)}</p>
        </div>
        <div className="grid gap-2 sm:flex sm:justify-end">
          <Button className="w-full sm:w-auto" disabled={loading} variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="w-full sm:w-auto" disabled={loading} onClick={onConfirm}>{loading ? "Updating..." : action.charAt(0).toUpperCase() + action.slice(1)}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ResourceFormCard({ config, editingId, form, relationOptions = {}, setForm, onSave, onClear }: { config: ResourceConfig; editingId: string | null; form: AnyRow; relationOptions?: Record<string, SearchableOption[]>; setForm: React.Dispatch<React.SetStateAction<AnyRow>>; onSave: (event: FormEvent) => void; onClear: () => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>{editingId ? "Edit" : "Add"} {config.title}</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1" onSubmit={onSave}>
          {config.fields.map((field) => <FieldEditor key={field.key} field={field} options={relationOptions[field.key]} value={form[field.key]} onChange={(value) => setForm((current: AnyRow) => ({ ...current, [field.key]: value }))} />)}
          <div className="grid gap-2 sm:col-span-2 sm:flex xl:col-span-1"><Button className="w-full sm:w-auto" type="submit">{editingId ? "Update" : "Create"}</Button><Button className="w-full sm:w-auto" type="button" variant="outline" onClick={onClear}>Clear</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function VolunteerTable({ rows, expanded, expenses, onToggle, onEdit, onDelete }: { rows: AnyRow[]; expanded: Record<string, boolean>; expenses: Record<string, AnyRow[]>; onToggle: (row: AnyRow) => void; onEdit: (row: AnyRow) => void; onDelete: (row: AnyRow) => void }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow><TableHead className="w-12" /><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length ? rows.map((volunteer) => {
            const id = rowId(volunteer);
            const list = expenses[id] || [];
            const total = sumRows(list);
            const cash = paymentTotal(list, "Cash");
            const gpay = paymentTotal(list, "GPay");
            return (
              <>
                <TableRow key={id}>
                  <TableCell><Button variant="outline" size="icon" onClick={() => onToggle(volunteer)}>{expanded[id] ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</Button></TableCell>
                  <TableCell>{volunteer.name}</TableCell>
                  <TableCell>{volunteer.phone}</TableCell>
                  <TableCell><div className="flex gap-1"><Button variant="outline" size="icon" onClick={() => onEdit(volunteer)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => onDelete(volunteer)}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
                </TableRow>
                {expanded[id] ? (
                  <TableRow key={`${id}-expenses`}>
                    <TableCell colSpan={4} className="bg-muted/40 p-0">
                      <DataTable
                        rows={list}
                        columns={["festivalId", "category", "amount", "paymentMethod", "date"]}
                        moneyColumns={["amount"]}
                        renderCell={(row, column) => column === "date" ? formatDateDDMMYYYY(row.date) : undefined}
                      />
                      <div className="border-t bg-background px-4 py-2 text-sm font-semibold">
                        Total: {money(total)} <span className="ml-2 text-muted-foreground">(Cash: {money(cash)}, GPay: {money(gpay)})</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </>
            );
          }) : <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No records found</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

function FieldEditor({ field, value, options, onChange }: { field: Field; value: any; options?: SearchableOption[]; onChange: (value: any) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{field.label}</span>
      {options ? <SearchableSelect value={String(value ?? "")} onChange={onChange} options={options} placeholder={`Search ${field.label.toLowerCase()}`} allowCustom={field.allowCustom} /> :
        field.type === "checkbox" ? <input className="h-5 w-5 accent-primary" type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /> :
        field.type === "select" ? <SelectBox value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}><option value="">Select</option>{(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</SelectBox> :
          <Input type={field.type || "text"} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function fundColumnClassName(column: string) {
  const sharedStickyBg = "max-md:bg-card max-md:shadow-[8px_0_12px_-12px_rgba(0,0,0,0.7)]";
  const classes: Record<string, string> = {
    type: `max-md:sticky max-md:left-0 max-md:z-20 max-md:w-8 max-md:min-w-8 max-md:max-w-8 max-md:px-1 max-md:text-center ${sharedStickyBg}`,
    name: `max-md:sticky max-md:left-8 max-md:z-20 max-md:w-[92px] max-md:min-w-[92px] max-md:max-w-[92px] max-md:overflow-hidden max-md:text-ellipsis max-md:whitespace-nowrap max-md:px-1 ${sharedStickyBg}`,
    houseId: "max-md:w-16 max-md:min-w-16 max-md:max-w-16 max-md:px-1",
    amount: "max-md:w-20 max-md:min-w-20 max-md:max-w-20 max-md:px-1",
    __delete: "max-md:w-12 max-md:min-w-12 max-md:max-w-12 max-md:px-1 md:hidden"
  };
  return classes[column] || "";
}

function DataTable({ rows, columns, actions, renderCell, renderHeader, moneyColumns = [], sortableColumns = [], onSort, rowClassName, onRowClick, stickyActions, columnClassName, actionColumnClassName }: { rows: AnyRow[]; columns: string[]; actions?: (row: AnyRow) => React.ReactNode; renderCell?: (row: AnyRow, column: string) => React.ReactNode | undefined; renderHeader?: (column: string) => React.ReactNode | undefined; moneyColumns?: string[]; sortableColumns?: string[]; onSort?: (column: string) => void; rowClassName?: string | ((row: AnyRow) => string); onRowClick?: (row: AnyRow) => void; stickyActions?: boolean; columnClassName?: (column: string) => string; actionColumnClassName?: string }) {
  function cellValue(row: AnyRow, column: string) {
    return renderCell?.(row, column) ?? (moneyColumns.includes(column) ? money(row[column]) : displayCell(row, column));
  }

  const pinActions = stickyActions ?? Boolean(actions);

  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain">
      <Table>
        <TableHeader>
          <TableRow>{columns.map((column) => <TableHead key={column} onClick={() => sortableColumns.includes(column) && onSort?.(column)} className={cn(sortableColumns.includes(column) && "cursor-pointer text-primary", columnClassName?.(column))}>{renderHeader?.(column) ?? label(column)}</TableHead>)}{actions ? <TableHead className={cn(pinActions && "max-md:sticky max-md:right-0 max-md:z-30 max-md:w-[104px] max-md:min-w-[104px] max-md:bg-card max-md:px-1 max-md:shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.7)]", actionColumnClassName)}>Action</TableHead> : null}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? rows.map((row) => <TableRow key={rowId(row)} className={cn(typeof rowClassName === "function" ? rowClassName(row) : rowClassName, onRowClick && "cursor-pointer")} onClick={() => onRowClick?.(row)}>{columns.map((column) => <TableCell key={column} className={columnClassName?.(column)}>{cellValue(row, column)}</TableCell>)}{actions ? <TableCell className={cn(pinActions && "max-md:sticky max-md:right-0 max-md:z-20 max-md:w-[104px] max-md:min-w-[104px] max-md:bg-card max-md:px-1 max-md:shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.7)]", actionColumnClassName)}>{actions(row)}</TableCell> : null}</TableRow>) : <TableRow><TableCell colSpan={columns.length + (actions ? 1 : 0)} className="text-center text-muted-foreground">No records found</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

function PaginationControls({ pagination, pageSize, onPageChange, onPageSizeChange }: { pagination: Pagination; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void }) {
  const totalPages = Math.max(1, pagination.totalPages || 1);
  const page = Math.min(Math.max(1, pagination.page || 1), totalPages);
  const start = pagination.total ? ((page - 1) * pageSize) + 1 : 0;
  const end = Math.min(pagination.total || 0, page * pageSize);

  return (
    <div className="grid gap-3 border-t p-3 text-sm sm:flex sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Show</span>
        <SelectBox className="w-20" value={String(pageSize)} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
        </SelectBox>
        <span className="text-muted-foreground">records per page</span>
      </div>
      <div className="grid gap-2 sm:flex sm:items-center">
        <span className="text-muted-foreground sm:mr-1">{start}-{end} of {pagination.total || 0}</span>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button variant="outline" className="h-9 min-h-9 px-2 py-1" disabled={page <= 1} onClick={() => onPageChange(1)}>First</Button>
          <Button variant="outline" className="h-9 min-h-9 px-2 py-1" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</Button>
          <span className="col-span-2 text-center font-medium sm:px-2">Page {page} / {totalPages}</span>
          <Button variant="outline" className="h-9 min-h-9 px-2 py-1" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
          <Button variant="outline" className="h-9 min-h-9 px-2 py-1" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>Last</Button>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className={cn("max-h-[94vh] w-full overflow-auto rounded-lg bg-background shadow-xl sm:max-h-[90vh]", wide ? "max-w-4xl" : "max-w-2xl")}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background p-3 sm:p-4"><h2 className="min-w-0 break-words font-semibold">{title}</h2><Button variant="ghost" onClick={onClose}>Close</Button></div>
        <div className="p-3 sm:p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm"><span className="font-medium">{label}</span>{children}</label>;
}

function UnpaidModal({ houses, onClose, onSelectHouse }: { houses: AnyRow[]; onClose: () => void; onSelectHouse: (house: AnyRow) => void }) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? houses.filter((house) => `${house.houseNumber || ""} ${house.ownerName || ""} ${house.phone || ""}`.toLowerCase().includes(normalizedSearch))
    : houses;

  return (
    <Modal title="Unpaid Houses" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search house" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="max-h-[65vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow><TableHead>House Number</TableHead><TableHead>Owner Name</TableHead><TableHead>Phone</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length ? filtered.map((house) => (
                <TableRow className="cursor-pointer" key={rowId(house)} onClick={() => onSelectHouse(house)}>
                  <TableCell className="py-1.5">{house.houseNumber}</TableCell>
                  <TableCell className="py-1.5">{house.ownerName}</TableCell>
                  <TableCell className="py-1.5">{house.phone}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No houses found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </Modal>
  );
}

function VolunteerSummaryModal({ summary, onClose }: { summary: any; onClose: () => void }) {
  const volunteers = summary?.volunteers || [];
  const volunteerTotal = volunteers.reduce((sum: number, item: AnyRow) => sum + Number(item.totalAmount || 0), 0);
  const cashTotal = Number(summary?.cash?.totalAmount || 0);
  return (
    <Modal title="Volunteer Summary" onClose={onClose}>
      <DataTable rows={volunteers} columns={["volunteerName", "totalAmount"]} moneyColumns={["totalAmount"]} />
      <div className="mt-4 rounded-md bg-muted p-3 text-sm"><p>Cash Contributions: <strong>{money(cashTotal)}</strong></p><p>Grand Total: <strong>{money(volunteerTotal + cashTotal)}</strong></p></div>
    </Modal>
  );
}

function WhatsAppModal({ fund, phones, onClose }: { fund: AnyRow; phones: string[]; onClose: () => void }) {
  const id = rowId(fund);
  const [sendingPhone, setSendingPhone] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function sendReceipt(phone: string) {
    setError("");
    setSendingPhone(phone);
    try {
      const res = await api<{ url: string }>(`/funds/download/${id}?action=send`);
      const message = `Thank you for your contribution!

Get your collection receipt from the link below:
${res.url}

Track fund, balance, expenses and reports here:
https://festival.kplab.dev

Jay Shree Ram`;
      let whatsAppPhone = String(phone).replace(/\D/g, "");
      if (whatsAppPhone && !whatsAppPhone.startsWith("91")) {
        whatsAppPhone = `91${whatsAppPhone}`;
      }
      const params = new URLSearchParams({ text: message });
      window.open(`https://wa.me/${whatsAppPhone}?${params.toString()}`, "_blank");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate receipt");
    } finally {
      setSendingPhone(null);
    }
  }

  return (
    <Modal title="Send Fund Receipt" onClose={onClose}>
      <div className="space-y-2">
        {phones.length ? phones.map((phone) => (
          <button className="flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60" disabled={Boolean(sendingPhone)} key={phone} onClick={() => sendReceipt(phone)} type="button">
            <span className="min-w-0 break-words">{phone}</span>
            {sendingPhone === phone ? <RefreshCcw className="h-5 w-5 animate-spin text-emerald-700" /> : <WhatsAppIcon />}
          </button>
        )) : <p className="text-sm text-muted-foreground">No phone number found for this fund.</p>}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </Modal>
  );
}

const dinnerStatuses = ["Draft", "Upcoming", "Collection Open", "Collection Closed", "Plate Count Finalized", "Active", "Completed", "Settled", "Cancelled"];
const contributionTypes = [
  { value: "complimentary", label: "Fully Complimentary" },
  { value: "payee_full", label: "Payee Full Payment" },
  { value: "split", label: "Yuvak Mandal + Payee Split" }
];

function DinnerPage() {
  const [events, setEvents] = useState<AnyRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"event" | "register" | "coupon" | "checkin" | "settlementPaid" | "menu" | null>(null);
  const [editingEvent, setEditingEvent] = useState<AnyRow | null>(null);
  const [activeTab, setActiveTab] = useState("registrations");
  const [registrations, setRegistrations] = useState<AnyRow[]>([]);
  const [report, setReport] = useState<any>(null);
  const [settlement, setSettlement] = useState<AnyRow | null>(null);
  const [collectionSummary, setCollectionSummary] = useState<any>(null);
  const [workingRow, setWorkingRow] = useState<AnyRow | null>(null);
  const [notice, setNotice] = useState("");
  const tabContentRef = useRef<HTMLDivElement | null>(null);
  const role = localStorage.getItem("role");
  const isAdmin = role === "admin";

  async function loadEvents(nextSelected = selectedId) {
    const res = await api<{ data: AnyRow[] }>("/dinner/events?page=1&limit=200&sort=-eventDate");
    setEvents(res.data || []);
    if (nextSelected) setSelectedId(nextSelected);
  }

  async function loadSelected() {
    if (!selectedId) {
      setSelected(null);
      setRegistrations([]);
      setCollectionSummary(null);
      return;
    }
    const [eventRes, regRes, reportRes] = await Promise.all([
      api<{ data: AnyRow }>(`/dinner/events/${selectedId}`),
      api<{ data: AnyRow[] }>(`/dinner/events/${selectedId}/registrations`),
      api<{ data: any }>(`/dinner/events/${selectedId}/report`)
    ]);
    setSelected(eventRes.data);
    setRegistrations(regRes.data || []);
    setReport(reportRes.data);
    if (activeTab === "settlement") {
      api<{ data: AnyRow }>(`/dinner/events/${selectedId}/settlement`).then((res) => setSettlement(res.data)).catch(() => undefined);
    }
    if (activeTab === "collections") {
      api<{ data: AnyRow }>(`/dinner/events/${selectedId}/collections`).then((res) => setCollectionSummary(res.data)).catch(() => undefined);
    }
  }

  useEffect(() => {
    loadEvents().catch(() => undefined);
  }, []);

  useEffect(() => {
    loadSelected().catch(() => undefined);
  }, [selectedId]);

  useEffect(() => {
    if (!isAdmin && activeTab === "settlement") {
      setActiveTab("registrations");
      return;
    }
    if (selectedId && activeTab === "settlement") {
      api<{ data: AnyRow }>(`/dinner/events/${selectedId}/settlement`).then((res) => setSettlement(res.data)).catch(() => undefined);
    }
    if (selectedId && activeTab === "collections") {
      api<{ data: AnyRow }>(`/dinner/events/${selectedId}/collections`).then((res) => setCollectionSummary(res.data)).catch(() => undefined);
    }
  }, [activeTab, selectedId, isAdmin]);

  useEffect(() => {
    if (activeTab !== "scanner") return;
    window.setTimeout(() => tabContentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }, [activeTab]);

  const filteredEvents = events.filter((event) => {
    const text = `${event.name || ""} ${event.status || ""} ${event.catererId?.name || ""} ${festivalLabel(event.festivalId || event.festival || {})}`.toLowerCase();
    const matchesSearch = !search || text.includes(search.toLowerCase());
    const status = String(event.status || "");
    const matchesFilter = filter === "All" || status === filter || (filter === "Past" && ["Completed", "Settled", "Cancelled"].includes(status)) || (filter === "Current" && ["Collection Open", "Active"].includes(status)) || (filter === "Future" && ["Draft", "Upcoming"].includes(status));
    return matchesSearch && matchesFilter;
  });
  const statusCounts = dinnerStatuses.reduce((acc, status) => ({ ...acc, [status]: events.filter((event) => event.status === status).length }), {} as Record<string, number>);

  async function duplicateEvent(event: AnyRow) {
    const res = await api<{ data: AnyRow }>(`/dinner/events/${rowId(event)}/duplicate`, { method: "POST" });
    await loadEvents();
    setNotice("Dinner event duplicated.");
  }

  async function setStatus(status: string) {
    if (!selected) return;
    if (["Completed", "Cancelled"].includes(status) && !confirm(`Mark this dinner event as ${status}?`)) return;
    await api(`/dinner/events/${rowId(selected)}/status`, { method: "POST", body: JSON.stringify({ status }) });
    await loadEvents(rowId(selected));
    await loadSelected();
    setNotice(`Event marked ${status}.`);
  }

  function openEvent(event: AnyRow) {
    setSelectedId(rowId(event));
    setDetailOpen(true);
    setActiveTab("registrations");
  }

  function closeEventDetail() {
    setDetailOpen(false);
    setSelectedId("");
    setSelected(null);
    setRegistrations([]);
    setReport(null);
    setSettlement(null);
    setCollectionSummary(null);
  }

  if (detailOpen) {
    const detailMetrics = selected?.summary || report?.metrics || {};
    const paidPlateCount = detailMetrics.paidPlates ?? registrations.filter((row) => ["Paid", "Complimentary"].includes(row.paymentStatus)).reduce((sum, row) => sum + Number(row.plateEntitlement ?? row.adults ?? 0), 0);
    const unpaidPlateCount = detailMetrics.unpaidPlates ?? registrations.filter((row) => !["Paid", "Complimentary"].includes(row.paymentStatus)).reduce((sum, row) => sum + Number(row.plateEntitlement ?? row.adults ?? 0), 0);
    return (
      <section className="space-y-4">
        <div className="flex flex-nowrap items-center gap-2">
          <Button className="min-w-0 flex-1 basis-0 px-2 text-xs sm:flex-none sm:basis-auto sm:px-3 sm:text-sm" variant="outline" onClick={closeEventDetail}>Back to Dinner</Button>
          {selected && isAdmin ? (
            <div className="flex min-w-0 flex-1 basis-0 items-center gap-2 sm:flex-none sm:basis-auto">
              <SelectBox className="min-w-0 flex-1 basis-0 text-xs sm:w-52 sm:basis-auto sm:text-sm" value={selected.status || ""} onChange={(event) => setStatus(event.target.value)}>
                {dinnerStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </SelectBox>
              <Button className="h-10 w-10 shrink-0 px-0 sm:w-auto sm:px-3" variant="outline" title="Edit event" onClick={() => { setEditingEvent(selected); setModal("event"); }}><Pencil className="h-4 w-4" /><span className="hidden sm:inline">Edit</span></Button>
            </div>
          ) : null}
        </div>
        {notice ? <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">{notice}</div> : null}
        {selected ? (
          <>
            <Card>
              <CardContent className="space-y-3 pt-4">
                <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-semibold">{selected.name}</h1>
                      <StatusBadge status={selected.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{festivalLabel(selected.festivalId || selected.festival)} • {formatDateDDMMYYYY(selected.eventDate)} {selected.eventTime || ""} • {selected.venue || "Venue pending"}</p>
                  </div>
                  <div className="min-w-0 text-sm text-muted-foreground">{selected.catererId?.name || selected.caterer?.name || "No caterer selected"}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-6">
                  <DinnerMetric compact icon={Home} label="Houses" value={detailMetrics.registeredHouses || 0} />
                  <DinnerMetric compact icon={UsersRound} label="Adults / 7+" value={detailMetrics.adultsRegistered || 0} />
                  <DinnerMetric compact icon={UsersRound} label="Children < 7" value={detailMetrics.childrenBelow7 || 0} />
                  <DinnerMetric compact icon={Utensils} label="Plates" value={detailMetrics.platesEntitled || 0} subValue={`(Paid ${paidPlateCount} / Unpaid ${unpaidPlateCount})`} className="bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100" />
                  <DinnerMetric compact icon={QrCode} label="Coupons" value={detailMetrics.couponsGenerated || 0} className="bg-cyan-50 text-cyan-950 dark:bg-cyan-950/30 dark:text-cyan-100" />
                  <DinnerMetric compact icon={ScanLine} label="Checked In" value={detailMetrics.platesUsed || 0} className="bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100" />
                </div>
                <div className="overflow-x-auto">
                  <div className="inline-flex w-max min-w-full gap-1 rounded-md border bg-muted/40 p-1">
                    {[
                      ["registrations", "Registration"],
                      ["plates", "Final Plates"],
                      ["scanner", "Gate Scanner"],
                      ["collections", "Collections"],
                      ["report", "Report"],
                      ...(isAdmin ? [["settlement", "Settlement"]] : [])
                    ].map(([key, title]) => (
                      <button key={key} type="button" className={cn("min-h-9 shrink-0 rounded px-3 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground", activeTab === key && "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground")} onClick={() => setActiveTab(key)}>{title}</button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            <div ref={tabContentRef} className="scroll-mt-4">
              {activeTab === "registrations" ? <DinnerRegistrationPanel event={selected} registrations={registrations} onRegister={(row) => { setWorkingRow(row); setModal("register"); }} onPreview={(row) => { setWorkingRow(row); setModal("coupon"); }} onRefresh={loadSelected} /> : null}
              {activeTab === "plates" ? <DinnerPlatePanel event={selected} metrics={detailMetrics} onRefresh={async () => { await loadEvents(rowId(selected)); await loadSelected(); }} /> : null}
              {activeTab === "scanner" ? <DinnerScannerPanel event={selected} onOpen={(row) => { setWorkingRow(row); setModal("checkin"); }} onRefresh={loadSelected} /> : null}
              {activeTab === "collections" ? <DinnerCollectionPanel summary={collectionSummary} registrations={registrations} onRefresh={async () => {
                const res = await api<{ data: AnyRow }>(`/dinner/events/${rowId(selected)}/collections`);
                setCollectionSummary(res.data);
              }} /> : null}
              {activeTab === "report" ? <DinnerReportPanel report={report} /> : null}
              {isAdmin && activeTab === "settlement" ? <DinnerSettlementPanel event={selected} settlement={settlement} setSettlement={setSettlement} onMarkPaid={() => setModal("settlementPaid")} onMarkUnpaid={async () => {
                if (!confirm("Mark this caterer settlement as unpaid? This will remove the linked dinner settlement expense.")) return;
                const res = await api<{ data: AnyRow }>(`/dinner/events/${rowId(selected)}/settlement/unpaid`, { method: "POST" });
                setSettlement(res.data);
                setNotice("Settlement marked unpaid.");
                await loadEvents(rowId(selected));
                await loadSelected();
              }} /> : null}
            </div>
          </>
        ) : <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Loading dinner event...</CardContent></Card>}
        {isAdmin && modal === "event" ? <DinnerEventModal event={editingEvent} onClose={() => setModal(null)} onSaved={async (id) => { setModal(null); await loadEvents(id); await loadSelected(); }} /> : null}
        {modal === "register" && selected ? <DinnerRegistrationModal event={selected} registration={workingRow} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await loadSelected(); }} /> : null}
        {modal === "coupon" && workingRow ? <DinnerCouponPreview registration={workingRow} onClose={() => setModal(null)} /> : null}
        {modal === "checkin" && workingRow ? <DinnerCheckInModal registration={workingRow} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await loadSelected(); }} /> : null}
        {isAdmin && modal === "settlementPaid" && selected ? <DinnerSettlementPaidModal event={selected} onClose={() => setModal(null)} onSaved={async () => { setModal(null); const res = await api<{ data: AnyRow }>(`/dinner/events/${rowId(selected)}/settlement`); setSettlement(res.data); await loadEvents(rowId(selected)); }} /> : null}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Dinner Management</h1>
        {isAdmin ? <Button className="w-full sm:w-auto" onClick={() => { setEditingEvent(null); setModal("event"); }}><Plus className="h-4 w-4" /> Create Dinner Event</Button> : null}
      </div>
      {notice ? <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">{notice}</div> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <DinnerMetric compact icon={ClipboardList} label="Draft" value={statusCounts.Draft || 0} />
        <DinnerMetric compact icon={CalendarDays} label="Upcoming" value={statusCounts.Upcoming || 0} />
        <DinnerMetric compact icon={Utensils} label="Active" value={statusCounts.Active || 0} />
        <DinnerMetric compact icon={CheckCircle2} label="Completed" value={statusCounts.Completed || 0} />
        <DinnerMetric compact icon={Trash2} label="Cancelled" value={statusCounts.Cancelled || 0} />
      </div>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="border-b"><CardTitle>Dinner Events</CardTitle></CardHeader>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <SelectBox className="sm:w-40" value={filter} onChange={(event) => setFilter(event.target.value)}>
              {["All", "Draft", "Upcoming", "Active", "Past", "Current", "Future", "Cancelled"].map((item) => <option key={item} value={item}>{item}</option>)}
            </SelectBox>
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search event" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead className="min-w-44">Event</TableHead><TableHead className="min-w-32">Event Date & Time</TableHead><TableHead className="min-w-16 text-center">Menu</TableHead><TableHead className="min-w-36">Caterer</TableHead><TableHead className="min-w-28">Pricing</TableHead><TableHead className="min-w-24">Collections</TableHead><TableHead className="min-w-32">Collection Deadline</TableHead><TableHead className="min-w-28">Status</TableHead>{isAdmin ? <TableHead className="min-w-20">Action</TableHead> : null}</TableRow></TableHeader>
              <TableBody>
                {filteredEvents.length ? filteredEvents.map((event) => (
                  <TableRow key={rowId(event)} className="cursor-pointer" onClick={() => openEvent(event)}>
                    <TableCell>
                      <div className="font-medium">{event.name}</div>
                      <div className="text-xs text-muted-foreground">{festivalLabel(event.festivalId || event.festival)}</div>
                      <div className="text-xs text-muted-foreground">{event.venue || "Venue pending"}</div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDateDDMMYYYY(event.eventDate)}{event.eventTime ? ` ${event.eventTime}` : ""}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="outline" size="icon" title="View menu" onClick={(click) => { click.stopPropagation(); setWorkingRow(event); setModal("menu"); }}><Menu className="h-4 w-4" /></Button>
                    </TableCell>
                    <TableCell>{event.catererId?.name || event.caterer?.name || "No caterer"}</TableCell>
                    <TableCell className="text-sm">{event.catererPricingType === "fixed" ? money(event.fixedContractAmount) : `${money(event.catererRatePerPlate)} / plate`}</TableCell>
                    <TableCell className="text-sm font-semibold">{event.summary?.collectionsMade || 0}</TableCell>
                    <TableCell className="text-sm">{formatDateDDMMYYYY(event.collectionDeadline)}</TableCell>
                    <TableCell><StatusBadge status={event.status} /></TableCell>
                    {isAdmin ? <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="icon" title="Edit" onClick={(click) => { click.stopPropagation(); setEditingEvent(event); setModal("event"); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" title="Duplicate" onClick={(click) => { click.stopPropagation(); duplicateEvent(event); }}><Copy className="h-4 w-4" /></Button>
                      </div>
                    </TableCell> : null}
                  </TableRow>
                )) : <TableRow><TableCell colSpan={isAdmin ? 9 : 8} className="text-center text-muted-foreground">No dinner events found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {isAdmin && modal === "event" ? <DinnerEventModal event={editingEvent} onClose={() => setModal(null)} onSaved={async (id) => { setModal(null); await loadEvents(id); setSelectedId(id); setDetailOpen(true); }} /> : null}
      {modal === "register" && selected ? <DinnerRegistrationModal event={selected} registration={workingRow} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await loadSelected(); }} /> : null}
      {modal === "coupon" && workingRow ? <DinnerCouponPreview registration={workingRow} onClose={() => setModal(null)} /> : null}
      {modal === "checkin" && workingRow ? <DinnerCheckInModal registration={workingRow} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await loadSelected(); }} /> : null}
      {isAdmin && modal === "settlementPaid" && selected ? <DinnerSettlementPaidModal event={selected} onClose={() => setModal(null)} onSaved={async () => { setModal(null); const res = await api<{ data: AnyRow }>(`/dinner/events/${rowId(selected)}/settlement`); setSettlement(res.data); await loadEvents(rowId(selected)); }} /> : null}
      {modal === "menu" && workingRow ? <DinnerMenuModal event={workingRow} onClose={() => setModal(null)} /> : null}
    </section>
  );
}

function DinnerMetric({ label, value, icon: Icon, compact, className, subValue, valueClassName }: { label: string; value: unknown; icon?: typeof Home; compact?: boolean; className?: string; subValue?: string; valueClassName?: string }) {
  return (
    <div className={cn("rounded-md border bg-card", compact ? "flex min-w-0 items-center gap-2 p-2" : "p-3", className)}>
      {Icon ? <Icon className={cn("shrink-0 text-primary", compact ? "h-4 w-4" : "h-5 w-5")} /> : null}
      <div className="min-w-0">
        <div className={cn("font-medium uppercase text-muted-foreground", compact ? "truncate text-[11px] leading-tight" : "text-xs")}>{label}</div>
        <div className={cn("flex flex-wrap items-baseline gap-1 break-words font-bold", compact ? "text-base leading-tight" : "mt-1 text-xl", valueClassName)}>
          <span>{typeof value === "number" ? <CountUpText value={value} /> : String(value || 0)}</span>
          {subValue ? <span className={cn("font-medium text-muted-foreground", compact ? "text-[10px] leading-tight" : "text-xs")}>{subValue}</span> : null}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || "Draft");
  const className = normalized === "Not Paid" || normalized.includes("Pending") || ["Draft", "Upcoming", "Collection Open"].includes(normalized)
    ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100"
    : ["Paid", "Complimentary", "Collected", "Active", "Completed", "Settled", "Generated", "Sent"].includes(normalized)
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100"
    : "bg-muted text-muted-foreground";
  return <span className={cn("inline-flex min-h-6 items-center rounded px-2 py-0.5 text-xs font-semibold", className)}>{normalized}</span>;
}

function DinnerMenuModal({ event, onClose }: { event: AnyRow; onClose: () => void }) {
  const menuLines = String(event.menu || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return (
    <Modal title="Dinner Menu" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-md border p-3">
          <p className="text-lg font-semibold">{event.name || "Dinner Event"}</p>
          <p className="text-sm text-muted-foreground">{formatDateDDMMYYYY(event.eventDate)}{event.eventTime ? ` ${event.eventTime}` : ""} • {event.venue || "Venue pending"}</p>
        </div>
        {menuLines.length ? (
          <div className="rounded-md border">
            {menuLines.map((item, index) => (
              <div key={`${item}-${index}`} className="flex items-start gap-3 border-b px-3 py-2 last:border-b-0">
                <Utensils className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 break-words text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">Menu is not added for this event.</div>
        )}
      </div>
    </Modal>
  );
}

function DinnerEventModal({ event, onClose, onSaved }: { event: AnyRow | null; onClose: () => void; onSaved: (id: string) => void }) {
  const [festivals, setFestivals] = useState<AnyRow[]>([]);
  const [caterers, setCaterers] = useState<AnyRow[]>([]);
  const [addCaterer, setAddCaterer] = useState(false);
  const [error, setError] = useState("");
  const [activeEventTab, setActiveEventTab] = useState("details");
  const [form, setForm] = useState<AnyRow>({
    festivalId: rowId(event?.festivalId || event?.festival || {}),
    catererId: rowId(event?.catererId || event?.caterer || {}),
    name: event?.name || "",
    eventDate: String(event?.eventDate || "").slice(0, 10),
    eventTime: event?.eventTime || "",
    venue: event?.venue || "",
    dinnerType: event?.dinnerType || "",
    menu: event?.menu || "",
    notes: event?.notes || "",
    status: event?.status || "Draft",
    catererPricingType: event?.catererPricingType || "per_plate",
    catererRatePerPlate: event?.catererRatePerPlate || "",
    expectedPlates: event?.expectedPlates || "",
    fixedContractAmount: event?.fixedContractAmount || "",
    advancePaid: event?.advancePaid || "",
    collectionStartDate: String(event?.collectionStartDate || "").slice(0, 10),
    collectionDeadline: String(event?.collectionDeadline || "").slice(0, 10),
    couponDeadline: String(event?.couponDeadline || "").slice(0, 10),
    showCouponNote: event?.showCouponNote ?? true,
    couponImportantNote: event?.couponImportantNote || "Children below 7 are complimentary and do not receive separate plates.",
    finalPlateSubmissionAt: String(event?.finalPlateSubmissionAt || "").slice(0, 16),
    contributionType: event?.contributionType || "payee_full",
    memberContributionRate: event?.memberContributionRate || "",
    payeePercent: event?.payeePercent ?? 100,
    mandalPercent: event?.mandalPercent ?? 0
  });

  useEffect(() => {
    Promise.all([
      api<{ data: AnyRow[] }>("/festivals?page=1&limit=300"),
      api<{ data: AnyRow[] }>("/dinner/caterers?page=1&limit=300")
    ]).then(([festivalRes, catererRes]) => {
      setFestivals(festivalRes.data || []);
      setCaterers(catererRes.data || []);
    }).catch(() => undefined);
  }, []);

  const festivalOptions = festivals.map((festival) => ({ value: rowId(festival), label: festivalLabel(festival), search: `${festival.name} ${festival.year}` }));
  const catererOptions = caterers.map((caterer) => ({ value: rowId(caterer), label: caterer.name, search: `${caterer.contactPerson || ""} ${caterer.primaryMobile || ""}` }));
  const adultsPreview = Number(form.expectedPlates || 1);
  const contributionBase = adultsPreview * Number(form.memberContributionRate || 0);
  const payeePreview = form.contributionType === "complimentary" ? 0 : form.contributionType === "split" ? contributionBase * Number(form.payeePercent || 0) / 100 : contributionBase;
  const mandalPreview = contributionBase - payeePreview;
  const eventTabs = [
    { key: "details", title: "Event Details" },
    { key: "caterer", title: "Caterer & Pricing" },
    { key: "deadlines", title: "Deadlines" },
    { key: "contribution", title: "Contribution" }
  ];
  const activeEventTabIndex = Math.max(0, eventTabs.findIndex((tab) => tab.key === activeEventTab));

  function setValue(key: string, value: string | boolean) {
    setForm((current: AnyRow) => {
      const next = { ...current, [key]: value };
      if (key === "contributionType" && value === "payee_full") {
        next.payeePercent = 100;
        next.mandalPercent = 0;
      }
      if (key === "contributionType" && value === "complimentary") {
        next.payeePercent = 0;
        next.mandalPercent = 100;
        next.paymentMethod = "";
        next.volunteerId = "";
        next.transactionReference = "";
      }
      if (key === "payeePercent") next.mandalPercent = Math.max(0, 100 - Number(value || 0));
      return next;
    });
  }

  async function submit(eventSubmit: FormEvent) {
    eventSubmit.preventDefault();
    setError("");
    if (!form.festivalId || !form.name || !form.eventDate) {
      setError("Festival, event name, and event date are required.");
      setActiveEventTab("details");
      return;
    }
    if (form.contributionType === "split" && Number(form.payeePercent || 0) + Number(form.mandalPercent || 0) !== 100) {
      setError("Payee and Yuvak Mandal split must total 100%.");
      setActiveEventTab("contribution");
      return;
    }
    try {
      const payload = {
        ...form,
        catererRatePerPlate: form.catererPricingType === "per_plate" ? form.catererRatePerPlate || 0 : 0,
        expectedPlates: form.catererPricingType === "per_plate" ? form.expectedPlates || 0 : 0,
        fixedContractAmount: form.catererPricingType === "fixed" ? form.fixedContractAmount || 0 : 0,
        advancePaid: form.advancePaid || 0,
        memberContributionRate: form.memberContributionRate || 0,
        payeePercent: form.payeePercent || 0,
        mandalPercent: form.mandalPercent || 0
      };
      const res = await api<{ data: AnyRow }>(event ? `/dinner/events/${rowId(event)}` : "/dinner/events", { method: event ? "PUT" : "POST", body: JSON.stringify(payload) });
      onSaved(rowId(res.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save dinner event");
    }
  }

  return (
    <Modal title={event ? "Edit Dinner Event" : "Create Dinner Event"} onClose={onClose} wide>
      <form className="space-y-4" onSubmit={submit}>
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full gap-1 rounded-md border bg-muted/40 p-1">
            {eventTabs.map((tab, index) => (
              <button
                className={cn("min-h-9 shrink-0 rounded px-3 text-sm font-medium hover:bg-background", activeEventTab === tab.key && "bg-background shadow-sm")}
                key={tab.key}
                onClick={() => setActiveEventTab(tab.key)}
                type="button"
              >
                {index + 1}. {tab.title}
              </button>
            ))}
          </div>
        </div>

        {activeEventTab === "details" ? (
          <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
            <h3 className="font-semibold md:col-span-2">Event Details</h3>
            <Field label="Festival / Year"><SearchableSelect value={String(form.festivalId || "")} onChange={(value) => setValue("festivalId", value)} options={festivalOptions} placeholder="Search festival" /></Field>
            <Field label="Event Name"><Input value={form.name} onChange={(event) => setValue("name", event.target.value)} /></Field>
            <Field label="Event Date"><Input type="date" value={form.eventDate} onChange={(event) => setValue("eventDate", event.target.value)} /></Field>
            <Field label="Event Time"><Input type="time" value={form.eventTime} onChange={(event) => setValue("eventTime", event.target.value)} /></Field>
            <Field label="Venue"><Input value={form.venue} onChange={(event) => setValue("venue", event.target.value)} /></Field>
            <Field label="Dinner Type"><Input value={form.dinnerType} onChange={(event) => setValue("dinnerType", event.target.value)} placeholder="Community dinner, Prasad, Garba dinner" /></Field>
            <Field label="Status"><SelectBox value={form.status} onChange={(event) => setValue("status", event.target.value)}>{dinnerStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</SelectBox></Field>
            <Field label="Notes"><Input value={form.notes} onChange={(event) => setValue("notes", event.target.value)} /></Field>
            <Field label="Menu"><textarea className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" value={form.menu} onChange={(event) => setValue("menu", event.target.value)} placeholder="Enter dinner menu, one item per line" /></Field>
          </div>
        ) : null}

        {activeEventTab === "caterer" ? (
          <div className="rounded-md border p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Caterer & Pricing</h3>
              <Button type="button" variant="outline" onClick={() => setAddCaterer(true)}><Plus className="h-4 w-4" /> Add New Caterer</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Caterer"><SearchableSelect value={String(form.catererId || "")} onChange={(value) => setValue("catererId", value)} options={catererOptions} placeholder="Search caterer" /></Field>
              <Field label="Pricing Model"><SelectBox value={form.catererPricingType} onChange={(event) => setValue("catererPricingType", event.target.value)}><option value="per_plate">Per Plate</option><option value="fixed">Fixed Amount</option></SelectBox></Field>
              {form.catererPricingType === "per_plate" ? (
                <>
                  <Field label="Rate Per Plate"><Input type="number" value={form.catererRatePerPlate} onChange={(event) => setValue("catererRatePerPlate", event.target.value)} /></Field>
                  <Field label="Expected Plates"><Input type="number" value={form.expectedPlates} onChange={(event) => setValue("expectedPlates", event.target.value)} /></Field>
                </>
              ) : <Field label="Fixed Contract Amount"><Input type="number" value={form.fixedContractAmount} onChange={(event) => setValue("fixedContractAmount", event.target.value)} /></Field>}
              <Field label="Advance Paid"><Input type="number" value={form.advancePaid} onChange={(event) => setValue("advancePaid", event.target.value)} /></Field>
            </div>
          </div>
        ) : null}

        {activeEventTab === "deadlines" ? (
          <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
            <h3 className="font-semibold md:col-span-2">Deadlines</h3>
            <Field label="Collection Start Date"><Input type="date" value={form.collectionStartDate} onChange={(event) => setValue("collectionStartDate", event.target.value)} /></Field>
            <Field label="Collection Deadline"><Input type="date" value={form.collectionDeadline} onChange={(event) => setValue("collectionDeadline", event.target.value)} /></Field>
            <Field label="Coupon Generation Deadline"><Input type="date" value={form.couponDeadline} onChange={(event) => setValue("couponDeadline", event.target.value)} /></Field>
            <Field label="Final Plate Submission Date / Time"><Input type="datetime-local" value={form.finalPlateSubmissionAt} onChange={(event) => setValue("finalPlateSubmissionAt", event.target.value)} /></Field>
            <Field label="Show Coupon Note"><input className="h-5 w-5 accent-primary" type="checkbox" checked={Boolean(form.showCouponNote)} onChange={(event) => setValue("showCouponNote", event.target.checked)} /></Field>
            {form.showCouponNote ? <Field label="Coupon Important Note"><Input value={form.couponImportantNote} onChange={(event) => setValue("couponImportantNote", event.target.value)} /></Field> : null}
          </div>
        ) : null}

        {activeEventTab === "contribution" ? (
          <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
            <h3 className="font-semibold md:col-span-2">Contribution Model</h3>
            <Field label="Contribution Type"><SelectBox value={form.contributionType} onChange={(event) => setValue("contributionType", event.target.value)}>{contributionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</SelectBox></Field>
            <Field label="Member Contribution Rate"><Input type="number" value={form.memberContributionRate} onChange={(event) => setValue("memberContributionRate", event.target.value)} /></Field>
            {form.contributionType === "split" ? <Field label="Payee %"><Input type="number" value={form.payeePercent} onChange={(event) => setValue("payeePercent", event.target.value)} /></Field> : null}
            {form.contributionType === "split" ? <Field label="Yuvak Mandal %"><Input type="number" value={form.mandalPercent} onChange={(event) => setValue("mandalPercent", event.target.value)} /></Field> : null}
            <div className="rounded-md bg-muted p-3 text-sm md:col-span-2">Preview for {adultsPreview} eligible attendee(s): Payee {money(payeePreview)} • Yuvak Mandal {money(mandalPreview)}</div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Button type="button" variant="outline" disabled={activeEventTabIndex <= 0} onClick={() => setActiveEventTab(eventTabs[activeEventTabIndex - 1].key)}>Back</Button>
            <Button type="button" variant="outline" disabled={activeEventTabIndex >= eventTabs.length - 1} onClick={() => setActiveEventTab(eventTabs[activeEventTabIndex + 1].key)}>Next</Button>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Button type="submit">Save Event</Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </form>
      {addCaterer ? <AddCatererModal onClose={() => setAddCaterer(false)} onCreated={(caterer) => { setCaterers((current) => [...current, caterer]); setValue("catererId", rowId(caterer)); setAddCaterer(false); }} /> : null}
    </Modal>
  );
}

function AddCatererModal({ onClose, onCreated }: { onClose: () => void; onCreated: (caterer: AnyRow) => void }) {
  const [form, setForm] = useState<AnyRow>({ name: "", contactPerson: "", primaryMobile: "", alternateMobile: "", email: "", address: "", notes: "" });
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const res = await api<{ data: AnyRow }>("/dinner/caterers", { method: "POST", body: JSON.stringify(form) });
      onCreated(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create caterer");
    }
  }
  return (
    <Modal title="Add New Caterer" onClose={onClose}>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        {[
          ["name", "Caterer Name *"],
          ["contactPerson", "Contact Person *"],
          ["primaryMobile", "Primary Mobile *"],
          ["alternateMobile", "Alternate Mobile"],
          ["email", "Email"],
          ["address", "Address"],
          ["notes", "Notes"]
        ].map(([key, labelText]) => <Field key={key} label={labelText}><Input value={form[key] || ""} onChange={(event) => setForm((current: AnyRow) => ({ ...current, [key]: event.target.value }))} /></Field>)}
        {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
        <div className="grid gap-2 md:col-span-2 sm:flex"><Button type="submit">Save Caterer</Button><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button></div>
      </form>
    </Modal>
  );
}

function DinnerRegistrationPanel({ event, registrations, onRegister, onPreview, onRefresh }: { event: AnyRow; registrations: AnyRow[]; onRegister: (row: AnyRow | null) => void; onPreview: (row: AnyRow) => void; onRefresh: () => void }) {
  const [housePickerOpen, setHousePickerOpen] = useState(false);
  const [paymentView, setPaymentView] = useState<"all" | "unpaid" | "checkedIn">("all");
  const [registrationSearch, setRegistrationSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [volunteerFilter, setVolunteerFilter] = useState("all");
  const isAdmin = localStorage.getItem("role") === "admin";
  const unpaidRegistrations = registrations.filter((row) => !["Paid", "Complimentary"].includes(row.paymentStatus));
  const checkedInRegistrations = registrations.filter((row) => Number(row.platesUsed || 0) > 0 || Number(row.adultsCheckedIn || 0) > 0 || Number(row.childrenCheckedIn || 0) > 0);
  const baseVisibleRegistrations = paymentView === "unpaid" ? unpaidRegistrations : paymentView === "checkedIn" ? checkedInRegistrations : registrations;
  const volunteerOptions = useMemo(() => {
    const byId = new Map<string, string>();
    registrations.forEach((row) => {
      const volunteer = row.volunteerId || row.volunteer || {};
      const id = rowId(volunteer);
      if (id) byId.set(id, volunteer.name || "Unknown");
    });
    return Array.from(byId.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [registrations]);
  const visibleRegistrations = baseVisibleRegistrations.filter((row) => {
    const house = row.houseId || row.house || {};
    const volunteer = row.volunteerId || row.volunteer || {};
    const searchText = `${house.houseNumber || ""} ${house.ownerName || ""}`.toLowerCase();
    const matchesSearch = !registrationSearch.trim() || searchText.includes(registrationSearch.trim().toLowerCase());
    const isPaid = ["Paid", "Complimentary"].includes(row.paymentStatus);
    const matchesPayment = paymentFilter === "all" || (paymentFilter === "paid" && isPaid) || (paymentFilter === "unpaid" && !isPaid);
    const matchesVolunteer = volunteerFilter === "all" || rowId(volunteer) === volunteerFilter;
    return matchesSearch && matchesPayment && matchesVolunteer;
  });
  const showMandalColumns = event.contributionType !== "payee_full";
  const registrationColumns = ["houseId", "plateEntitlement", "payeeAmount", "volunteerId", "existingMemberCount", "adults", "childrenBelow7", "totalAttending", "platesUsed", ...(showMandalColumns ? ["contributionType", "mandalAmount"] : []), "couponStatus", "deliveryStatus"];
  const moneyColumns = ["payeeAmount", ...(showMandalColumns ? ["mandalAmount"] : [])];

  async function removeRegistration(row: AnyRow) {
    const house = row.houseId || row.house || {};
    const name = `${house.houseNumber || "this house"}${house.ownerName ? ` - ${house.ownerName}` : ""}`;
    if (!confirm(`Delete dinner registration for ${name}? This removes the collection/payment details and QR coupon for this dinner event only.`)) return;
    await api(`/dinner/registrations/${rowId(row)}`, { method: "DELETE" });
    await onRefresh();
  }

  async function generateCoupon(row: AnyRow) {
    await api(`/dinner/registrations/${rowId(row)}/coupon`, { method: "POST" });
    await onRefresh();
  }

  async function sendCoupon(row: AnyRow) {
    await api(`/dinner/registrations/${rowId(row)}/coupon/send`, {
      method: "POST",
      body: JSON.stringify({ deliveryChannel: "WhatsApp", sentTo: row.houseId?.phone || row.house?.phone })
    });
    await onRefresh();
  }

  return (
    <Card>
      <CardHeader className="grid gap-3 border-b sm:flex sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Registered Houses</CardTitle>
        <div className="grid gap-2 sm:grid-flow-col sm:auto-cols-max">
          <Button className="w-full sm:w-auto" variant="outline" onClick={onRefresh}><RefreshCcw className="h-4 w-4" /> Refresh</Button>
          <Button className="w-full sm:w-auto" onClick={() => setHousePickerOpen(true)}><Plus className="h-4 w-4" /> Add Registration</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="inline-flex rounded-md border bg-muted/40 p-1">
            <button type="button" className={cn("rounded px-3 py-1.5 text-sm font-medium", paymentView === "all" && "bg-background shadow-sm")} onClick={() => setPaymentView("all")}>All ({registrations.length})</button>
            <button type="button" className={cn("rounded px-3 py-1.5 text-sm font-medium", paymentView === "unpaid" && "bg-background shadow-sm")} onClick={() => setPaymentView("unpaid")}>Not Paid ({unpaidRegistrations.length})</button>
            <button type="button" className={cn("rounded px-3 py-1.5 text-sm font-medium", paymentView === "checkedIn" && "bg-background shadow-sm")} onClick={() => setPaymentView("checkedIn")}>Checked In ({checkedInRegistrations.length})</button>
          </div>
          {paymentView === "unpaid" ? <p className="text-sm text-muted-foreground">Registered houses pending full collection.</p> : null}
          {paymentView === "checkedIn" ? <p className="text-sm text-muted-foreground">Registered houses with gate check-in history.</p> : null}
        </div>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_220px]">
          <div className="relative min-w-0">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search house number or name" value={registrationSearch} onChange={(event) => setRegistrationSearch(event.target.value)} />
          </div>
          <SelectBox value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </SelectBox>
          <SelectBox value={volunteerFilter} onChange={(event) => setVolunteerFilter(event.target.value)}>
            <option value="all">All Volunteers</option>
            {volunteerOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </SelectBox>
        </div>
        <DataTable
          rows={visibleRegistrations}
          columns={registrationColumns}
          moneyColumns={moneyColumns}
          renderHeader={(column) => ({
            existingMemberCount: "Total Member",
            plateEntitlement: "Plates",
            payeeAmount: "Amount",
            volunteerId: "Collected By",
            adults: "Adults > 7",
            childrenBelow7: "Kids < 7",
            totalAttending: "Total Attending",
            platesUsed: "Checked In",
            deliveryStatus: "QR Delivered"
          }[column])}
          columnClassName={(column) => ({
            houseId: "min-w-28",
            plateEntitlement: "min-w-16 text-center",
            payeeAmount: "min-w-24",
            volunteerId: "min-w-28",
            existingMemberCount: "min-w-24 text-center",
            adults: "min-w-20 text-center",
            childrenBelow7: "min-w-20 text-center",
            totalAttending: "min-w-24 text-center",
            platesUsed: "min-w-20 text-center",
            contributionType: "min-w-28",
            mandalAmount: "min-w-28",
            couponStatus: "min-w-28",
            deliveryStatus: "min-w-28"
          }[column] || "")}
          actionColumnClassName="max-md:w-[122px] max-md:min-w-[122px] md:w-[122px] md:min-w-[122px]"
          renderCell={(row, column) => {
            if (column === "houseId") return <span className="font-bold">{displayCell(row, column)}</span>;
            if (column === "plateEntitlement") return <span className="font-bold text-destructive">{row.plateEntitlement}</span>;
            if (column === "payeeAmount") return <span className="inline-flex flex-wrap items-center gap-1.5"><span className="font-bold">{money(row.payeeAmount)}</span><StatusBadge status={["Paid", "Complimentary"].includes(row.paymentStatus) ? row.paymentStatus : "Not Paid"} /></span>;
            if (column === "volunteerId") return row.volunteerId?.name || row.volunteer?.name || "-";
            if (column === "platesUsed") return <span className={cn("font-semibold", Number(row.platesUsed || 0) > 0 && "text-emerald-700 dark:text-emerald-300")}>{row.platesUsed || 0}</span>;
            if (["paymentStatus", "couponStatus", "deliveryStatus"].includes(column)) return <StatusBadge status={row[column]} />;
            return undefined;
          }}
          actions={(row) => (
            <div className="flex gap-0.5">
              <Button className="h-7 min-h-7 w-7 sm:h-7 sm:min-h-7 sm:w-7" variant="outline" size="icon" title="Edit registration" onClick={() => onRegister(row)}><Pencil className="h-3.5 w-3.5" /></Button>
              {row.couponStatus === "Not Generated" ? (
                <Button className="h-7 min-h-7 w-7 sm:h-7 sm:min-h-7 sm:w-7" variant="outline" size="icon" title="Generate QR coupon" disabled={!["Paid", "Complimentary"].includes(row.paymentStatus)} onClick={() => generateCoupon(row)}><QrCode className="h-3.5 w-3.5" /></Button>
              ) : (
                <Button className="h-7 min-h-7 w-7 sm:h-7 sm:min-h-7 sm:w-7" variant="outline" size="icon" title="Preview QR coupon" onClick={() => onPreview(row)}><QrCode className="h-3.5 w-3.5" /></Button>
              )}
              <Button className="h-7 min-h-7 w-7 sm:h-7 sm:min-h-7 sm:w-7" variant="outline" size="icon" title="Mark coupon sent" disabled={row.couponStatus === "Not Generated"} onClick={() => sendCoupon(row)}><Send className="h-3.5 w-3.5" /></Button>
              {isAdmin ? <Button className="h-7 min-h-7 w-7 sm:h-7 sm:min-h-7 sm:w-7" variant="ghost" size="icon" title="Delete registration, collection, and QR" onClick={() => removeRegistration(row)}><Trash2 className="h-3.5 w-3.5" /></Button> : null}
            </div>
          )}
        />
        {housePickerOpen ? (
          <DinnerHousePickerModal
            registrations={registrations}
            onClose={() => setHousePickerOpen(false)}
            onSelect={(row) => {
              setHousePickerOpen(false);
              onRegister(row);
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function DinnerHousePickerModal({ registrations, onClose, onSelect }: { registrations: AnyRow[]; onClose: () => void; onSelect: (row: AnyRow) => void }) {
  const [search, setSearch] = useState("");
  const [houses, setHouses] = useState<AnyRow[]>([]);
  const [housePage, setHousePage] = useState(1);
  const [housePageSize, setHousePageSize] = useState(10);
  const [housePagination, setHousePagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 1 });

  async function loadHouses() {
    const res = await api<{ data: AnyRow[]; pagination?: Pagination }>(`/house${toQuery({ page: housePage, limit: housePageSize, search })}`);
    setHouses(res.data || []);
    setHousePagination(res.pagination || { total: res.data?.length || 0, page: housePage, limit: housePageSize, totalPages: 1 });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadHouses().catch(() => {
        setHouses([]);
        setHousePagination({ total: 0, page: 1, limit: housePageSize, totalPages: 1 });
      });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [housePage, housePageSize, search]);

  useEffect(() => {
    setHousePage(1);
  }, [search, housePageSize]);

  function pickHouse(house: AnyRow) {
    const existing = registrations.find((row) => rowId(row.houseId || row.house || {}) === rowId(house));
    onSelect(existing || { house });
  }

  return (
    <Modal title="Add House Registration" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input autoFocus className="pl-8" placeholder="Search by House Number, Mobile Number, or Name" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <DataTable
          rows={houses}
          columns={["houseNumber", "ownerName", "phone"]}
          actions={(house) => {
            const existing = registrations.find((row) => rowId(row.houseId || row.house || {}) === rowId(house));
            return <Button variant="outline" onClick={() => pickHouse(house)}>{existing ? "Edit" : "Register"}</Button>;
          }}
        />
        <PaginationControls
          pagination={housePagination}
          pageSize={housePageSize}
          onPageChange={setHousePage}
          onPageSizeChange={setHousePageSize}
        />
      </div>
    </Modal>
  );
}

function DinnerRegistrationModal({ event, registration, onClose, onSaved }: { event: AnyRow; registration: AnyRow | null; onClose: () => void; onSaved: () => void }) {
  const house = registration?.house || registration?.houseId || {};
  const role = localStorage.getItem("role");
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}") as AnyRow;
    } catch {
      return {};
    }
  })();
  const isVolunteerLogin = role === "volunteer";
  const currentVolunteerId = isVolunteerLogin ? String(currentUser.id || "") : "";
  function calculatedReceivedAmount(source: AnyRow) {
    const sourceAdults = Number(source.adults || 0);
    const sourceRate = Number(source.memberContributionRate || 0);
    const sourceBase = sourceAdults * sourceRate;
    if (source.contributionType === "complimentary") return "0";
    if (source.contributionType === "split") return String(sourceBase * Number(source.payeePercent || 0) / 100);
    return String(sourceBase);
  }
  const initialForm = {
    houseId: rowId(house),
    existingMemberCount: registration?.existingMemberCount || "",
    adults: registration?.adults || 0,
    childrenBelow7: registration?.childrenBelow7 || 0,
    contributionType: registration?.contributionType || event.contributionType || "payee_full",
    memberContributionRate: registration?.memberContributionRate ?? event.memberContributionRate ?? 0,
    payeePercent: registration?.payeePercent ?? event.payeePercent ?? 100,
    mandalPercent: registration?.mandalPercent ?? event.mandalPercent ?? 0,
    volunteerId: currentVolunteerId || rowId(registration?.volunteerId || registration?.volunteer || {}),
    paymentMethod: registration?.paymentMethod || "",
    transactionReference: registration?.transactionReference || "",
    notes: registration?.notes || ""
  };
  const [form, setForm] = useState<AnyRow>({
    ...initialForm,
    amountReceived: registration ? registration.amountReceived || "" : calculatedReceivedAmount(initialForm),
  });
  const [error, setError] = useState("");
  const [volunteers, setVolunteers] = useState<AnyRow[]>([]);
  const volunteerOptions = [
    ...(currentVolunteerId && !volunteers.some((volunteer) => rowId(volunteer) === currentVolunteerId) ? [{ value: currentVolunteerId, label: currentUser.name || "Current Volunteer", search: currentUser.phone || "" }] : []),
    ...volunteers.map((volunteer) => ({ value: rowId(volunteer), label: volunteer.name, search: volunteer.phone }))
  ];
  const adults = Number(form.adults || 0);
  const children = Number(form.childrenBelow7 || 0);
  const base = adults * Number(form.memberContributionRate || 0);
  const payeeAmount = form.contributionType === "complimentary" ? 0 : form.contributionType === "split" ? base * Number(form.payeePercent || 0) / 100 : base;
  const mandalAmount = base - payeeAmount;
  const balance = Math.max(0, payeeAmount - Number(form.amountReceived || 0));
  const checkedInAdults = Number(registration?.adultsCheckedIn || 0);
  const checkedInChildren = Number(registration?.childrenCheckedIn || 0);
  const checkedInPlates = Number(registration?.platesUsed || 0);
  const hasCheckIn = checkedInAdults > 0 || checkedInChildren > 0 || checkedInPlates > 0;
  const collectorLocked = isVolunteerLogin || form.contributionType === "complimentary";
  useEffect(() => {
    api<{ data: AnyRow[] }>("/volunteers?page=1&limit=300").then((res) => setVolunteers(res.data || [])).catch(() => setVolunteers([]));
  }, []);
  function setValue(key: string, value: string) {
    setForm((current: AnyRow) => {
      const next = { ...current, [key]: value };
      if (key === "contributionType" && value === "complimentary") {
        next.payeePercent = 0;
        next.mandalPercent = 100;
        next.volunteerId = currentVolunteerId || "";
      }
      if (key === "contributionType" && value === "payee_full") {
        next.payeePercent = 100;
        next.mandalPercent = 0;
      }
      if (key === "payeePercent") next.mandalPercent = Math.max(0, 100 - Number(value || 0));
      if (["adults", "memberContributionRate", "contributionType", "payeePercent"].includes(key)) {
        next.amountReceived = calculatedReceivedAmount(next);
      }
      return next;
    });
  }
  async function submit(eventSubmit: FormEvent) {
    eventSubmit.preventDefault();
    setError("");
    if (form.paymentMethod && !form.volunteerId) {
      setError("Collected By is required when payment method is selected.");
      return;
    }
    try {
      await api(`/dinner/events/${rowId(event)}/registrations`, { method: "POST", body: JSON.stringify(form) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save registration");
    }
  }
  async function markNotPaid() {
    if (!registration || !["Paid", "Partial"].includes(registration.paymentStatus)) return;
    const name = `${house.houseNumber || "this house"}${house.ownerName ? ` - ${house.ownerName}` : ""}`;
    if (!confirm(`Mark ${name} as not paid? This will clear the received amount and remove the QR coupon.`)) return;
    setError("");
    try {
      await api(`/dinner/registrations/${rowId(registration)}/payment/unpaid`, { method: "POST" });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark not paid");
    }
  }
  async function revertCheckIn() {
    if (!registration || !hasCheckIn) return;
    const name = `${house.houseNumber || "this house"}${house.ownerName ? ` - ${house.ownerName}` : ""}`;
    if (!confirm(`Revert check-in for ${name}? This will clear successful gate entry counts for this dinner event.`)) return;
    setError("");
    try {
      await api(`/dinner/registrations/${rowId(registration)}/checkins`, { method: "DELETE" });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revert check-in");
    }
  }
  return (
    <Modal title="Collect Payment & Attendee Details" onClose={onClose} wide>
      <form className="space-y-4" onSubmit={submit}>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p><strong>{house.houseNumber}</strong> — {house.ownerName}</p>
          <p className="text-muted-foreground">Mobile: {house.phone || "-"} • Existing registered members: {form.existingMemberCount || "-"}</p>
          {registration ? <p className="mt-1 text-muted-foreground">Checked in: Adults {checkedInAdults}, Kids {checkedInChildren}, Plates {checkedInPlates}</p> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Existing Registered Member Count"><ResponsiveNumberInput value={form.existingMemberCount} onChange={(value) => setValue("existingMemberCount", value)} /></Field>
          <Field label="Adults / Age 7+"><ResponsiveNumberInput value={form.adults} onChange={(value) => setValue("adults", value)} /></Field>
          <Field label="Children Below 7"><ResponsiveNumberInput value={form.childrenBelow7} onChange={(value) => setValue("childrenBelow7", value)} /></Field>
          <div className="rounded-md border p-3 text-sm">Total attending: <strong>{adults + children}</strong><br />Plate entitlement: <strong>{adults}</strong><br />Total amount: <strong className="text-destructive">{money(payeeAmount)}</strong><p className="mt-2 text-muted-foreground">Children below 7 are complimentary and are not allotted separate plates.</p></div>
          <Field label="Contribution Type"><SelectBox value={form.contributionType} onChange={(event) => setValue("contributionType", event.target.value)}>{contributionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</SelectBox></Field>
          <Field label="Member Contribution Rate"><Input type="number" value={form.memberContributionRate} onChange={(event) => setValue("memberContributionRate", event.target.value)} /></Field>
          {form.contributionType === "split" ? <Field label="Payee %"><Input type="number" value={form.payeePercent} onChange={(event) => setValue("payeePercent", event.target.value)} /></Field> : null}
          {form.contributionType === "split" ? <Field label="Yuvak Mandal %"><Input type="number" value={form.mandalPercent} onChange={(event) => setValue("mandalPercent", event.target.value)} /></Field> : null}
          <Field label="Amount Received"><Input type="number" disabled={form.contributionType === "complimentary"} value={form.amountReceived} onChange={(event) => setValue("amountReceived", event.target.value)} /></Field>
          <Field label="Payment Method"><SelectBox disabled={form.contributionType === "complimentary"} value={form.paymentMethod} onChange={(event) => setValue("paymentMethod", event.target.value)}><option value="">Select</option><option>Cash</option><option>GPay</option></SelectBox></Field>
          <Field label="Collected By"><SearchableSelect disabled={collectorLocked} value={String(form.volunteerId || "")} onChange={(value) => setValue("volunteerId", value)} options={volunteerOptions} placeholder="Search volunteer" /></Field>
          <Field label="Transaction Reference"><Input value={form.transactionReference} onChange={(event) => setValue("transactionReference", event.target.value)} /></Field>
          <Field label="Notes"><Input value={form.notes} onChange={(event) => setValue("notes", event.target.value)} /></Field>
        </div>
        <div className="rounded-md bg-muted p-3 text-sm">Payee amount: <strong>{money(payeeAmount)}</strong>{form.contributionType !== "payee_full" ? <> • Yuvak Mandal share: <strong>{money(mandalAmount)}</strong></> : null} • Balance due: <strong>{money(balance)}</strong></div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Button type="submit">Save Registration</Button>
          {registration && ["Paid", "Partial"].includes(registration.paymentStatus) ? <Button type="button" variant="outline" onClick={markNotPaid}>Mark Not Paid</Button> : null}
          {hasCheckIn ? <Button type="button" variant="outline" onClick={revertCheckIn}>Revert Check-in</Button> : null}
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

function DinnerCouponPanel({ registrations, onPreview, onRefresh }: { registrations: AnyRow[]; onPreview: (row: AnyRow) => void; onRefresh: () => void }) {
  async function generate(row: AnyRow) {
    await api(`/dinner/registrations/${rowId(row)}/coupon`, { method: "POST" });
    await onRefresh();
  }
  async function send(row: AnyRow) {
    await api(`/dinner/registrations/${rowId(row)}/coupon/send`, { method: "POST", body: JSON.stringify({ deliveryChannel: "WhatsApp", sentTo: row.houseId?.phone || row.house?.phone }) });
    await onRefresh();
  }
  return (
    <Card>
      <CardHeader className="border-b"><CardTitle>Coupon Management</CardTitle></CardHeader>
      <CardContent className="pt-4">
        <DataTable
          rows={registrations}
          columns={["houseId", "adults", "childrenBelow7", "plateEntitlement", "paymentStatus", "couponStatus", "deliveryStatus"]}
          renderCell={(row, column) => ["paymentStatus", "couponStatus", "deliveryStatus"].includes(column) ? <StatusBadge status={row[column]} /> : undefined}
          actions={(row) => (
            <div className="flex gap-1">
              <Button variant="outline" size="icon" title="Generate QR" disabled={!["Paid", "Complimentary"].includes(row.paymentStatus)} onClick={() => generate(row)}><QrCode className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" title="Preview" onClick={() => onPreview(row)}><Search className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" title="Mark Sent" disabled={row.couponStatus === "Not Generated"} onClick={() => send(row)}><Send className="h-4 w-4" /></Button>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}

function DinnerCouponPreview({ registration, onClose }: { registration: AnyRow; onClose: () => void }) {
  const qrText = registration.coupon?.qrPayload || registration.coupon?.token || "Generate coupon to create secure QR token";
  const [qrImage, setQrImage] = useState("");
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [sharePhone, setSharePhone] = useState("");
  const [sharing, setSharing] = useState(false);
  const couponRef = useRef<HTMLDivElement | null>(null);
  const couponExportRef = useRef<HTMLDivElement | null>(null);
  const event = registration.eventId || registration.event || {};
  const house = registration.houseId || registration.house || {};
  const eventName = event.name || "Dinner Event";
  const eventDate = event.eventDate || event.date;
  const eventTime = event.eventTime || "";
  const venue = event.venue || "Venue pending";
  const adults = Number(registration.adults || 0);
  const children = Number(registration.childrenBelow7 || 0);
  const totalAttending = Number(registration.totalAttending || adults + children);
  const plates = Number(registration.plateEntitlement || adults);
  const paymentStatus = registration.paymentStatus || "Paid";
  const defaultCouponNote = "Children below 7 are complimentary and do not receive separate plates.";
  const couponImportantNote = String(event.couponImportantNote || defaultCouponNote).trim();
  const showCouponNote = event.showCouponNote !== false && Boolean(couponImportantNote);
  const couponCode = useMemo(() => {
    if (registration.coupon?.couponCode) return registration.coupon.couponCode;
    const initials = eventName.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 4).toUpperCase() || "DIN";
    const houseCode = String(house.houseNumber || "HOUSE").replace(/[^a-z0-9]/gi, "").toUpperCase();
    const dateCode = String(eventDate || "").replace(/\D/g, "").slice(2, 8) || "DATE";
    const tokenCode = String(qrText || "").replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase() || "QR";
    return `${initials}-${houseCode}-${dateCode}-${tokenCode}`;
  }, [eventName, eventDate, house.houseNumber, qrText]);

  useEffect(() => {
    QRCode.toDataURL(qrText, { width: 320, margin: 1, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#ffffff" } })
      .then(setQrImage)
      .catch(() => setQrImage(""));
  }, [qrText]);

  async function renderCouponBlob() {
    const couponNode = couponExportRef.current || couponRef.current;
    if (!couponNode) return null;
    const canvas = await html2canvas(couponNode, {
      backgroundColor: "#ffffff",
      scale: Math.max(2, window.devicePixelRatio || 1),
      useCORS: true,
    });
    return new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
  }

  function saveBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadCoupon() {
    const blob = await renderCouponBlob();
    if (!blob) return;
    saveBlob(blob, `${couponCode}.png`);
  }

  function openWhatsAppConfirm() {
    setSharePhone(String(house.phone || "").replace(/\D/g, ""));
    setWhatsAppOpen(true);
  }

  async function shareWhatsApp(phoneValue = sharePhone) {
    const phone = String(phoneValue || "").replace(/\D/g, "");
    const whatsAppPhone = phone ? phone.startsWith("91") ? phone : `91${phone}` : "";
    const text = [
      `${eventName} dinner coupon`,
      `House: ${house.houseNumber || "-"}`,
      `Name: ${house.ownerName || "-"}`,
      `Adults / 7+: ${adults}`,
      `Kids < 7: ${children}`,
      `Plates: ${plates}`,
      `Coupon Code: ${couponCode}`,
      "",
      "Show this QR coupon at the dinner entry gate for check-in.",
      ...(showCouponNote ? ["", couponImportantNote] : []),
    ].join("\n");
    setSharing(true);
    const blob = await renderCouponBlob();
    const fileName = `${couponCode}.png`;
    if (blob && navigator.share) {
      const file = new File([blob], fileName, { type: "image/png" });
      const shareData = {
        title: `${eventName} Dinner Coupon`,
        text,
        files: [file],
      } as ShareData & { files: File[] };
      const canShareFile = typeof navigator.canShare !== "function" || navigator.canShare(shareData);
      if (canShareFile) {
        try {
          await navigator.share(shareData);
          setSharing(false);
          setWhatsAppOpen(false);
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            setSharing(false);
            return;
          }
        }
      }
    }
    if (blob) saveBlob(blob, fileName);
    const params = new URLSearchParams({ text });
    window.open(`https://wa.me/${whatsAppPhone}?${params.toString()}`, "_blank");
    setSharing(false);
    setWhatsAppOpen(false);
  }

  return (
    <Modal title="Coupon Preview" onClose={onClose} wide>
      <div className="space-y-3">
        <div ref={couponRef} className="mx-auto max-w-[760px] overflow-hidden rounded-md border border-emerald-100 bg-white text-slate-950 shadow-sm">
          <div className="border-l-4 border-emerald-600 p-3">
            <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-3 border-b pb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <Utensils className="h-6 w-6" />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="break-words text-xl font-bold leading-tight">{eventName}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDateDDMMYYYY(eventDate)}</span>
                  {eventTime ? <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {eventTime} Onwards</span> : null}
                </div>
                <div className="inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 truncate">{venue}</span>
                </div>
              </div>
              <span className="inline-flex w-max items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold uppercase text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> {paymentStatus}
              </span>
            </div>

            <div className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                <Home className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold leading-tight">House: {house.houseNumber || "-"}</p>
                <p className="text-sm leading-tight text-slate-600">{house.ownerName || "-"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-blue-100 bg-blue-50/40 p-2">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-blue-700">
                  <UsersRound className="h-4 w-4" /> Attendee Details
                </div>
                <div className="overflow-hidden rounded-md border bg-white">
                  <CouponCountRow icon={<UsersRound className="h-4 w-4" />} iconClassName="bg-blue-50 text-blue-700" label="Adults / 7+" subLabel="Eligible for plates" value={adults} valueClassName="text-blue-700" />
                  <CouponCountRow icon={<Baby className="h-4 w-4" />} iconClassName="bg-amber-50 text-amber-700" label="Children < 7" subLabel="Complimentary" value={children} valueClassName="text-amber-600" />
                  <CouponCountRow icon={<UsersRound className="h-4 w-4" />} iconClassName="bg-emerald-50 text-emerald-700" label="Total Attending" subLabel="Adults + Children" value={totalAttending} valueClassName="text-emerald-700" last />
                </div>
              </div>
              <div className="rounded-md border border-emerald-100 bg-emerald-50/40 p-2">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-emerald-700">
                  <Utensils className="h-4 w-4" /> Plates
                </div>
                <div className="grid h-[158px] place-items-center rounded-md border bg-white p-3 text-center">
                  <div>
                    <div className="text-5xl font-bold leading-none text-emerald-700">{plates}</div>
                    <div className="mt-1 text-lg font-bold uppercase text-emerald-700">Plates</div>
                    <div className="mt-1 text-xs text-slate-500">(For Adults / 7+)</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-[150px_minmax(0,1fr)] items-center gap-3 rounded-md border p-3">
              <div className="grid place-items-center">
                <CouponQrWithLogo qrImage={qrImage} sizeClassName="h-36 w-36" badgeClassName="h-7 w-7" logoClassName="max-h-5 max-w-5" />
              </div>
              <div className="space-y-2">
                <p className="text-base font-bold">Coupon Code</p>
                <p className="inline-block max-w-full break-all rounded-md bg-emerald-50 px-3 py-1.5 font-mono text-base font-bold text-emerald-800">{couponCode}</p>
                <div className="border-t border-dashed" />
                <p className="text-xs text-slate-600">Show this QR at the dinner entry gate for check-in.</p>
              </div>
            </div>

            {showCouponNote ? <div className="mt-3 flex gap-2 rounded-md border border-amber-100 bg-amber-50 p-2.5 text-amber-950">
              <Info className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-bold leading-tight">Important Note</p>
                <p className="text-xs leading-snug">{couponImportantNote}</p>
              </div>
            </div> : null}
          </div>
        </div>
        <div className="fixed left-[-10000px] top-0 w-[720px] bg-white">
          <div ref={couponExportRef} className="w-[720px] rounded border border-slate-900 bg-white p-7 text-black">
            <div className="border-b border-slate-900 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold leading-tight">{eventName}</h2>
                  <p className="mt-3 text-base leading-tight">{formatDateDDMMYYYY(eventDate)} <span className="px-2">|</span> {eventTime ? `${eventTime} Onwards` : "Time pending"}</p>
                  <p className="mt-2 text-base leading-tight">Venue: {venue}</p>
                </div>
                <div className="flex h-7 items-center rounded border border-slate-900 px-4 text-sm font-bold uppercase leading-none">{paymentStatus}</div>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-8 py-5">
              <div className="space-y-4">
                <div>
                  <p className="text-sm uppercase leading-tight">House</p>
                  <p className="mt-2 text-3xl font-bold leading-none">{house.houseNumber || "-"}</p>
                  <p className="mt-2 text-base leading-tight">{house.ownerName || "-"}</p>
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold uppercase leading-tight">Attendee Details</p>
                  <div className="grid grid-cols-3 items-stretch overflow-hidden border border-slate-900 text-center">
                    <CouponExportStat label="Adults / 7+" value={adults} />
                    <CouponExportStat label="Children < 7" value={children} />
                    <CouponExportStat label="Total" value={totalAttending} />
                  </div>
                </div>
                <div>
                  <p className="text-sm uppercase leading-tight">Plates</p>
                  <p className="mt-2 text-3xl font-bold leading-none">{plates} <span className="text-base font-normal">for Adults / 7+</span></p>
                </div>
              </div>

              <div className="text-center">
                <CouponQrWithLogo qrImage={qrImage} sizeClassName="h-40 w-40" badgeClassName="h-8 w-8" logoClassName="max-h-6 max-w-6" />
                <p className="mt-4 text-sm font-bold uppercase leading-tight">Coupon Code</p>
                <p className="mt-2 flex min-h-8 items-center justify-center break-all px-2 font-mono text-sm font-bold leading-none">{couponCode}</p>
              </div>
            </div>

            <div className="pt-5 text-sm">
              {showCouponNote ? (
                <p className="leading-snug"><strong>Important Note:</strong> {couponImportantNote}</p>
              ) : null}
              <div className={cn("mt-5 border-t border-slate-900 pt-4 text-center text-xs font-bold italic leading-snug text-slate-600", !showCouponNote && "mt-0")}>Show this QR at the dinner entry gate for check-in.</div>
              <div className="mt-2 text-center text-xs">Thank you for your cooperation.</div>
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="outline" onClick={downloadCoupon}><Download className="h-4 w-4" /> Download</Button>
          <Button variant="outline" onClick={openWhatsAppConfirm}><WhatsAppIcon /> Share on WhatsApp</Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
      {whatsAppOpen ? (
        <Modal title="Send Coupon on WhatsApp" onClose={() => !sharing && setWhatsAppOpen(false)}>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p><strong>{house.houseNumber || "-"}</strong> — {house.ownerName || "-"}</p>
              <p className="text-muted-foreground">{eventName} • {couponCode}</p>
            </div>
            <Field label="Mobile Number">
              <Input value={sharePhone} onChange={(event) => setSharePhone(event.target.value)} placeholder="Enter WhatsApp mobile number" />
            </Field>
            <p className="text-sm text-muted-foreground">On mobile, choose WhatsApp from the share sheet to send the coupon image. If image sharing is not supported, the coupon image will download and WhatsApp will open with coupon details.</p>
            <div className="grid gap-2 sm:flex">
              <Button disabled={sharing} onClick={() => shareWhatsApp()}><WhatsAppIcon /> {sharing ? "Preparing..." : "Send Coupon Image"}</Button>
              <Button variant="ghost" disabled={sharing} onClick={() => setWhatsAppOpen(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </Modal>
  );
}

function CouponCountRow({ icon, iconClassName, label, subLabel, value, valueClassName, last }: { icon: React.ReactNode; iconClassName: string; label: string; subLabel: string; value: number; valueClassName: string; last?: boolean }) {
  return (
    <div className={cn("grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-2 px-2 py-2", !last && "border-b")}>
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", iconClassName)}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight">{label}</p>
        <p className="truncate text-[11px] leading-tight text-slate-500">{subLabel}</p>
      </div>
      <div className={cn("text-right text-2xl font-bold leading-none", valueClassName)}>{value}</div>
    </div>
  );
}

function CouponQrWithLogo({ qrImage, sizeClassName, badgeClassName, logoClassName }: { qrImage: string; sizeClassName: string; badgeClassName: string; logoClassName: string }) {
  return (
    <div className={cn("relative mx-auto grid place-items-center", sizeClassName)}>
      {qrImage ? <img alt="Dinner coupon QR" className="h-full w-full object-contain" src={qrImage} /> : <QrCode className="h-4/5 w-4/5" />}
      <div className={cn("absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md bg-white p-1 shadow-sm", badgeClassName)}>
        <img alt="Yuvak Mandal logo" className={cn("object-contain", logoClassName)} src={mandalLogo} />
      </div>
    </div>
  );
}

function DinnerPlatePanel({ event, metrics, onRefresh }: { event: AnyRow; metrics: AnyRow; onRefresh: () => void }) {
  const [finalCount, setFinalCount] = useState(event.finalPlateCount || metrics.platesEntitled || 0);
  const isAdmin = localStorage.getItem("role") === "admin";
  const estimated = event.catererPricingType === "fixed" ? Number(event.fixedContractAmount || 0) : Number(finalCount || 0) * Number(event.catererRatePerPlate || 0);
  async function save(shared = false, confirmed = false) {
    await api(`/dinner/events/${rowId(event)}/plate-confirmation`, { method: "POST", body: JSON.stringify({ finalPlateCount: finalCount, shared, confirmed }) });
    await onRefresh();
  }
  return (
    <Card>
      <CardHeader className="border-b"><CardTitle>Final Plate Confirmation to Caterer</CardTitle></CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <DinnerMetric label="Registered Houses" value={metrics.registeredHouses || 0} />
          <DinnerMetric label="Adults / 7+" value={metrics.adultsRegistered || 0} />
          <DinnerMetric label="Children Below 7" value={metrics.childrenBelow7 || 0} />
          <DinnerMetric label="Total Attending" value={metrics.totalAttending || 0} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Final Plate Commitment"><Input type="number" value={finalCount} onChange={(event) => setFinalCount(Number(event.target.value || 0))} /></Field>
          <div className="rounded-md border p-3 text-sm">Caterer rate: <strong>{event.catererPricingType === "fixed" ? money(event.fixedContractAmount) : `${money(event.catererRatePerPlate)} / plate`}</strong><br />Estimated caterer amount: <strong>{money(estimated)}</strong></div>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap"><Button onClick={() => save(true, false)}><Send className="h-4 w-4" /> Share Final Plate Count</Button>{isAdmin ? <Button variant="outline" onClick={() => save(true, true)}><CheckCircle2 className="h-4 w-4" /> Mark Caterer Confirmed</Button> : null}</div>
        <p className="text-sm text-muted-foreground">Final Plate Commitment = Total Eligible Adults / Age 7+. Children below 7 are not included in plate commitment.</p>
      </CardContent>
    </Card>
  );
}

function DinnerScannerPanel({ event, onOpen, onRefresh }: { event: AnyRow; onOpen: (row: AnyRow) => void; onRefresh: () => void }) {
  const [token, setToken] = useState("");
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<AnyRow[]>([]);
  const [error, setError] = useState("");
  const [cameraRunning, setCameraRunning] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("");
  const scannerRef = useRef<any>(null);
  const readerId = useMemo(() => `dinner-qr-reader-${rowId(event) || "event"}`, [event]);

  async function validateToken(value = token) {
    const nextToken = value.trim();
    if (!nextToken) return;
    setError("");
    setToken(nextToken);
    try {
      const res = await api<{ data: AnyRow }>(`/dinner/coupons/validate${toQuery({ token: nextToken })}`);
      await stopCamera();
      onOpen({ ...res.data, entryMethod: "QR" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to validate QR");
    }
  }

  async function stopCamera() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setCameraRunning(false);
    setCameraStatus("");
    if (!scanner) return;
    try {
      if (scanner.getState?.() === 2) await scanner.stop();
      scanner.clear?.();
    } catch {
      scanner.clear?.();
    }
  }

  async function startCamera() {
    setError("");
    setCameraStatus("Starting camera...");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await stopCamera();
      const scanner = new Html5Qrcode(readerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        (decodedText: string) => {
          setCameraStatus("QR found. Validating...");
          validateToken(decodedText);
        },
        () => undefined
      );
      setCameraRunning(true);
      setCameraStatus("Camera ready. Point it at the dinner coupon QR.");
    } catch (err) {
      setCameraRunning(false);
      setCameraStatus("");
      setError(err instanceof Error ? err.message : "Unable to start camera. Check browser camera permission.");
    }
  }

  useEffect(() => () => {
    stopCamera();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!search.trim()) {
        setMatches([]);
        return;
      }
      api<{ data: AnyRow[] }>(`/dinner/events/${rowId(event)}/registrations${toQuery({ search })}`).then((res) => setMatches(res.data || [])).catch(() => setMatches([]));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [event, search]);
  return (
    <Card>
      <CardHeader className="border-b"><CardTitle>Gate Scanner</CardTitle></CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border p-3">
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><ScanLine className="h-5 w-5" /> Scan QR</h3>
            <div className="overflow-hidden rounded-md border bg-black">
              <div id={readerId} className="min-h-64 w-full [&_video]:min-h-64 [&_video]:w-full [&_video]:object-cover" />
            </div>
            {cameraStatus ? <p className="mt-2 text-sm text-muted-foreground">{cameraStatus}</p> : null}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button type="button" onClick={startCamera} disabled={cameraRunning}><ScanLine className="h-4 w-4" /> Start Camera</Button>
              <Button type="button" variant="outline" onClick={stopCamera} disabled={!cameraRunning}>Stop</Button>
            </div>
            <div className="my-3 border-t" />
            <Input className="min-h-12 text-base" placeholder="Paste QR token or coupon code" value={token} onChange={(event) => setToken(event.target.value)} />
            <Button className="mt-3 w-full" onClick={() => validateToken()} disabled={!token.trim()}><QrCode className="h-4 w-4" /> Validate QR</Button>
          </div>
          <div className="rounded-md border p-3">
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><Search className="h-5 w-5" /> Search House</h3>
            <Input className="min-h-12 text-base" placeholder="House number, name, or mobile" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="mt-3 max-h-56 overflow-auto rounded-md border">
              {matches.length ? matches.map((row) => <button className="block w-full border-b p-3 text-left last:border-b-0 hover:bg-muted" type="button" key={rowId(row)} onClick={() => onOpen({ ...row, entryMethod: "House Search" })}><strong>{row.houseId?.houseNumber}</strong> <span className="text-muted-foreground">{row.houseId?.ownerName}</span></button>) : <div className="p-3 text-sm text-muted-foreground">No matching house registration found.</div>}
            </div>
          </div>
        </div>
        {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <Button variant="outline" onClick={onRefresh}><RefreshCcw className="h-4 w-4" /> Refresh Dashboard</Button>
      </CardContent>
    </Card>
  );
}

function CheckInMiniStat({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: number; className?: string }) {
  return (
    <div className="min-w-[118px] flex-1 rounded-md bg-background/60 p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground sm:text-sm">
        <span className={cn("shrink-0", className)}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-xl font-bold leading-none sm:text-2xl">{value}</div>
    </div>
  );
}

function CouponExportStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex h-[62px] flex-col items-center justify-center border-r border-slate-900 px-2 py-1 last:border-r-0">
      <p className="text-sm leading-tight">{label}</p>
      <p className="mt-0.5 text-[28px] font-bold leading-[1.15]">{value}</p>
    </div>
  );
}

function CheckInStepperCard({ label, subLabel, value, max, icon, tone, onChange }: { label: string; subLabel: string; value: number; max: number; icon: React.ReactNode; tone: "blue" | "amber" | "emerald"; onChange: (value: number) => void }) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50/50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200",
    amber: "border-amber-200 bg-amber-50/50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200",
    emerald: "border-emerald-200 bg-emerald-50/50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200",
  }[tone];
  return (
    <div className={cn("rounded-md border p-2 sm:p-4", toneClass)}>
      <div className="mb-2 text-center sm:mb-4">
        <div className="flex items-center justify-center gap-2 text-sm font-bold text-foreground sm:text-base">
          <span className={tone === "blue" ? "text-blue-600" : tone === "amber" ? "text-amber-600" : "text-emerald-700"}>{icon}</span>
          <span>{label}</span>
        </div>
        <div className="mt-1 hidden text-xs text-muted-foreground sm:block">{subLabel}</div>
      </div>
      <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2 sm:grid-cols-[56px_minmax(0,1fr)_56px] sm:gap-3">
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 bg-background/70 sm:h-12 sm:w-12" onClick={() => onChange(Math.max(0, value - 1))}><Minus className="h-5 w-5" /></Button>
        <div className="text-center text-3xl font-bold leading-none text-foreground sm:text-5xl">{value}</div>
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 bg-background/70 sm:h-12 sm:w-12" onClick={() => onChange(Math.min(max, value + 1))}><Plus className="h-5 w-5" /></Button>
      </div>
      <div className="mt-2 text-center text-xs font-semibold sm:mt-4 sm:text-sm">Remaining: {max}</div>
    </div>
  );
}

function DinnerCheckInModal({ registration, onClose, onSaved }: { registration: AnyRow; onClose: () => void; onSaved: () => void }) {
  const [adults, setAdults] = useState(Math.min(1, Number(registration.remainingAdults || 0)));
  const [children, setChildren] = useState(0);
  const [plates, setPlates] = useState(Math.min(adults, Number(registration.remainingPlates || 0)));
  const [error, setError] = useState("");
  const registeredAdults = Number(registration.adults || 0);
  const registeredChildren = Number(registration.childrenBelow7 || 0);
  const registeredTotal = Number(registration.totalAttending || registeredAdults + registeredChildren);
  const plateEntitlement = Number(registration.plateEntitlement || registeredAdults);
  const checkedAdults = Number(registration.adultsCheckedIn || 0);
  const checkedChildren = Number(registration.childrenCheckedIn || 0);
  const checkedPlates = Number(registration.platesUsed || 0);
  const remainingAdults = Number(registration.remainingAdults || 0);
  const remainingChildren = Number(registration.remainingChildren || 0);
  const remainingPlates = Number(registration.remainingPlates || 0);
  const afterAdults = checkedAdults + adults;
  const afterChildren = checkedChildren + children;
  const afterPlates = checkedPlates + plates;
  useEffect(() => {
    setPlates(Math.min(adults, remainingPlates));
  }, [adults, remainingPlates]);
  function setAdultEntry(value: number) {
    setAdults(Math.min(value, remainingAdults, remainingPlates));
  }
  function setPlateEntry(value: number) {
    setAdults(Math.min(value, remainingAdults, remainingPlates));
  }
  async function submit() {
    setError("");
    try {
      await api(`/dinner/registrations/${rowId(registration)}/checkins`, { method: "POST", body: JSON.stringify({ adultsEntered: adults, childrenEntered: children, platesConsumed: plates, entryMethod: registration.entryMethod || "House Search" }) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in blocked");
    }
  }
  return (
    <Modal title="Gate Check-in" onClose={onClose} wide>
      <div className="space-y-2 sm:space-y-4">
        <div className="rounded-md border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-900 dark:bg-emerald-950/20 sm:p-4">
          <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[76px_minmax(0,1fr)_auto]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-100 sm:h-16 sm:w-16">
              <Home className="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="break-words text-2xl font-bold leading-tight sm:text-3xl">{registration.houseId?.houseNumber || "-"}</h3>
                <StatusBadge status={registration.paymentStatus || "Pending"} />
                <StatusBadge status="Registered" />
              </div>
              <p className="mt-1 break-words text-base text-foreground sm:text-lg">{registration.houseId?.ownerName || "-"}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto border-t pt-4 lg:grid lg:grid-cols-4 lg:overflow-visible">
            <CheckInMiniStat icon={<UsersRound className="h-5 w-5" />} className="text-blue-600" label="Adults / 7+" value={registeredAdults} />
            <CheckInMiniStat icon={<Baby className="h-5 w-5" />} className="text-amber-600" label="Children < 7" value={registeredChildren} />
            <CheckInMiniStat icon={<UsersRound className="h-5 w-5" />} className="text-emerald-600" label="Total Attending" value={registeredTotal} />
            <CheckInMiniStat icon={<Utensils className="h-5 w-5" />} className="text-emerald-700" label="Plate Entitlement" value={plateEntitlement} />
          </div>
        </div>

        <div className="grid gap-2 rounded-md border bg-muted/30 p-2 sm:p-4 md:grid-cols-2 md:items-center">
          <div className="min-w-0">
            <h3 className="mb-2 text-center text-base font-bold text-foreground">Already Checked-in</h3>
            <div className="flex justify-center gap-3 overflow-x-auto whitespace-nowrap text-sm">
              <span className="inline-flex items-center gap-1"><UsersRound className="h-4 w-4 text-blue-600" /><strong className="text-blue-600">{checkedAdults}</strong> Adults</span>
              <span className="inline-flex items-center gap-1"><Baby className="h-4 w-4 text-amber-600" /><strong className="text-amber-600">{checkedChildren}</strong> Children</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><strong className="text-emerald-700">{checkedPlates}</strong> Plates Used</span>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md bg-emerald-50 p-2 text-center text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 sm:p-3">
            <div className="mb-1 text-base font-bold text-foreground">Remaining</div>
            <div className="whitespace-nowrap">{remainingAdults} Adults <span className="px-1">-</span> {remainingChildren} Children <span className="px-1">-</span> {remainingPlates} Plates</div>
          </div>
        </div>

        {registration.paymentStatus !== "Paid" && registration.paymentStatus !== "Complimentary" ? <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Payment Pending. Entry Restricted. Amount due: {money(registration.balanceDue)}</div> : null}

        <div className="rounded-md border p-2 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
            <h3 className="flex items-center gap-2 text-base font-bold sm:text-xl"><LogIn className="h-5 w-5 text-emerald-600" /> Who is entering now?</h3>
            <span className="hidden items-center gap-1 text-sm text-primary sm:inline-flex"><Info className="h-4 w-4" /> Check-in</span>
          </div>
          <div className="grid gap-2 lg:grid-cols-3">
            <CheckInStepperCard label="Adults / 7+" subLabel="Eligible for plates" value={adults} max={remainingAdults} icon={<UsersRound className="h-6 w-6" />} tone="blue" onChange={setAdultEntry} />
            <CheckInStepperCard label="Children < 7" subLabel="Complimentary" value={children} max={remainingChildren} icon={<Baby className="h-6 w-6" />} tone="amber" onChange={(value) => setChildren(Math.min(value, remainingChildren))} />
            <CheckInStepperCard label="Plates to consume" subLabel="For Adults / 7+" value={plates} max={remainingPlates} icon={<Utensils className="h-6 w-6" />} tone="emerald" onChange={setPlateEntry} />
          </div>
          <div className="mt-2 hidden gap-3 rounded-md border border-amber-100 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100 sm:flex">
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
            <p>Children below 7 are complimentary and do not receive separate plates.</p>
          </div>
        </div>
        {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-2">
          <Button className="min-h-11 bg-emerald-600 text-base hover:bg-emerald-700 sm:min-h-12" onClick={submit}><CheckCircle2 className="h-5 w-5" /> Check In</Button>
          <Button className="min-h-10 sm:min-h-11" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function DinnerCollectionPanel({ summary, registrations, onRefresh }: { summary: any; registrations: AnyRow[]; onRefresh: () => void | Promise<void> }) {
  const isAdmin = localStorage.getItem("role") === "admin";
  const fallback = useMemo(() => {
    const rowsByVolunteer = new Map<string, AnyRow>();
    registrations.forEach((row) => {
      const amount = Number(row.amountReceived || 0);
      if (amount <= 0) return;
      const volunteer = row.volunteerId || row.volunteer || {};
      const key = rowId(volunteer) || "unassigned";
      const current = rowsByVolunteer.get(key) || {
        volunteerName: volunteer.name || "Unassigned",
        houseCount: 0,
        cashAmount: 0,
        gpayAmount: 0,
        totalAmount: 0,
        handoverStatus: "Pending",
      };
      if (row.paymentMethod === "Cash") current.cashAmount += amount;
      else current.gpayAmount += amount;
      current.totalAmount += amount;
      current.houseCount += 1;
      rowsByVolunteer.set(key, current);
    });
    const rows = Array.from(rowsByVolunteer.values()).sort((a, b) => Number(a.handoverStatus === "Collected") - Number(b.handoverStatus === "Collected") || String(a.volunteerName).localeCompare(String(b.volunteerName)));
    return {
      rows,
      totals: {
        cashAmount: rows.reduce((sum, row) => sum + Number(row.cashAmount || 0), 0),
        gpayAmount: rows.reduce((sum, row) => sum + Number(row.gpayAmount || 0), 0),
        totalAmount: rows.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0),
        houseCount: rows.reduce((sum, row) => sum + Number(row.houseCount || 0), 0),
      },
    };
  }, [registrations]);
  const data = summary || fallback;
  const totals = data.totals || fallback.totals;
  const rows = [...(data.rows || fallback.rows)].sort((a, b) => Number(a.handoverStatus === "Collected") - Number(b.handoverStatus === "Collected") || String(a.volunteerName).localeCompare(String(b.volunteerName)));
  async function updateHandover(row: AnyRow, status: "Pending" | "Collected") {
    const eventId = rowId(data.event || summary?.event || {});
    const volunteerId = rowId(row.volunteerId || row.volunteer || {});
    if (!eventId || !volunteerId) return;
    await api(`/dinner/events/${eventId}/collections/${volunteerId}/handover`, { method: "POST", body: JSON.stringify({ status }) });
    await onRefresh();
  }
  return (
    <Card>
      <CardHeader className="grid gap-3 border-b sm:flex sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Volunteer Collections</CardTitle>
        <Button className="w-full sm:w-auto" variant="outline" onClick={onRefresh}><RefreshCcw className="h-4 w-4" /> Refresh</Button>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <DinnerMetric compact icon={Home} label="Houses" value={totals.houseCount || 0} />
          <DinnerMetric compact icon={WalletCards} label="Cash" value={money(totals.cashAmount)} />
          <DinnerMetric compact icon={WalletCards} label="GPay" value={money(totals.gpayAmount)} />
          <DinnerMetric compact icon={ReceiptIndianRupee} label="Total" value={money(totals.totalAmount)} />
        </div>
        <DataTable
          rows={rows}
          columns={["volunteerName", "houseCount", "totalAmount", "cashAmount", "gpayAmount", "handoverStatus"]}
          moneyColumns={["cashAmount", "gpayAmount", "totalAmount"]}
          rowClassName={(row) => row.handoverStatus !== "Collected" ? "bg-amber-50/70 dark:bg-amber-950/20" : ""}
          actionColumnClassName="max-md:w-12 max-md:min-w-12 md:w-28 md:min-w-28"
          renderHeader={(column) => ({
            volunteerName: "Volunteer",
            houseCount: "Houses",
            totalAmount: "Total",
            cashAmount: "Cash",
            gpayAmount: "GPay",
            handoverStatus: "Status",
          }[column])}
          renderCell={(row, column) => {
            if (column === "volunteerName") return <span className="font-bold">{row.volunteerName || "Unassigned"}</span>;
            if (column === "totalAmount") return <span className="font-bold">{money(row.totalAmount)}</span>;
            if (column === "handoverStatus") return <StatusBadge status={row.handoverStatus === "Collected" ? "Collected" : "Pending"} />;
            return undefined;
          }}
          actions={isAdmin ? (row) => {
            const volunteerId = rowId(row.volunteerId || row.volunteer || {});
            return row.handoverStatus === "Collected" ? (
              <Button className="h-7 min-h-7 w-7 p-0 md:h-8 md:w-auto md:px-3" variant="outline" disabled={!volunteerId} title="Undo collection received" onClick={() => updateHandover(row, "Pending")}><RefreshCcw className="h-3.5 w-3.5" /><span className="hidden md:inline">Undo</span></Button>
            ) : (
              <Button className="h-7 min-h-7 w-7 whitespace-nowrap p-0 md:h-8 md:w-auto md:px-3" disabled={!volunteerId} title="Mark collection received" onClick={() => updateHandover(row, "Collected")}><CheckCircle2 className="h-3.5 w-3.5" /><span className="hidden md:inline">Received</span></Button>
            );
          } : undefined}
        />
      </CardContent>
    </Card>
  );
}

function DinnerReportPanel({ report }: { report: any }) {
  const metrics = report?.metrics || {};
  const rows = report?.rows || [];
  return (
    <Card>
      <CardHeader className="border-b"><CardTitle>Event Report</CardTitle></CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {["registeredHouses", "couponsGenerated", "adultsRegistered", "childrenBelow7", "platesEntitled", "platesUsed", "payeeCollection", "yuvakMandalContribution", "restrictedAttempts", "houseSearchCheckins"].map((key) => <DinnerMetric key={key} label={label(key)} value={key.toLowerCase().includes("collection") || key.toLowerCase().includes("contribution") ? money(metrics[key]) : metrics[key] || 0} />)}
        </div>
        <p className="rounded-md bg-muted p-3 text-sm">Children below 7 are included in attendance counts but are not counted as separate plates.</p>
        <DataTable rows={rows} columns={["houseId", "adults", "childrenBelow7", "totalAttending", "plateEntitlement", "adultsCheckedIn", "childrenCheckedIn", "platesUsed", "contributionType", "payeeAmount", "mandalAmount", "couponStatus", "paymentStatus"]} moneyColumns={["payeeAmount", "mandalAmount"]} />
      </CardContent>
    </Card>
  );
}

function DinnerSettlementPanel({ event, settlement, setSettlement, onMarkPaid, onMarkUnpaid }: { event: AnyRow; settlement: AnyRow | null; setSettlement: (row: AnyRow) => void; onMarkPaid: () => void; onMarkUnpaid: () => void }) {
  const [adjustment, setAdjustment] = useState<AnyRow>({ adjustmentType: "Other", description: "", amount: "", direction: "increase" });
  async function addAdjustment(eventSubmit: FormEvent) {
    eventSubmit.preventDefault();
    const adjustmentId = rowId(adjustment);
    const res = await api<{ data: AnyRow }>(adjustmentId ? `/dinner/events/${rowId(event)}/settlement/adjustments/${adjustmentId}` : `/dinner/events/${rowId(event)}/settlement/adjustments`, { method: adjustmentId ? "PUT" : "POST", body: JSON.stringify(adjustment) });
    setSettlement(res.data);
    setAdjustment({ adjustmentType: "Other", description: "", amount: "", direction: "increase" });
  }
  function editAdjustment(row: AnyRow) {
    setAdjustment({
      ...row,
      adjustmentType: row.adjustmentType || "Other",
      description: row.description || "",
      amount: row.amount || "",
      direction: row.direction || "increase",
    });
  }
  async function download() {
    const blob = await apiBlob(`/dinner/events/${rowId(event)}/settlement/download`);
    downloadBlob(blob, `dinner_settlement_${rowId(event)}.pdf`);
  }
  if (!settlement) return <Card><CardContent className="p-4 text-sm text-muted-foreground">Loading settlement...</CardContent></Card>;
  const adjustmentTotal = (settlement.adjustments || []).reduce((sum: number, row: AnyRow) => sum + (Number(row.amount || 0) * (row.direction === "deduction" ? -1 : 1)), 0);
  return (
    <Card>
      <CardHeader className="border-b"><CardTitle>Caterer Settlement</CardTitle></CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <DinnerMetric label="Final Plate Count" value={settlement.finalPlateCount || 0} />
          <DinnerMetric label="Base Amount" value={money(settlement.baseAmount)} />
          <DinnerMetric label="Advance Paid" value={money(settlement.advancePaid)} />
          <DinnerMetric label="Final Payable to Caterer" value={money(settlement.finalPayable)} valueClassName="text-destructive" />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <DinnerMetric label="Coupons Collected" value={money(settlement.collectionTotal)} />
          <DinnerMetric label="Add to Festival Fund" value={money(settlement.festivalFundSurplus)} valueClassName="text-emerald-700 dark:text-emerald-300" />
          <DinnerMetric label="Pay from Mandal" value={money(settlement.festivalFundShortfall)} valueClassName="text-destructive" />
        </div>
        <div className="rounded-md border p-3 text-sm">
          <p><strong>{event.catererId?.name || event.caterer?.name || "Caterer"}</strong></p>
          <p className="text-muted-foreground">Pricing: {event.catererPricingType === "fixed" ? `Fixed ${money(event.fixedContractAmount)}` : `${settlement.finalPlateCount} x ${money(event.catererRatePerPlate)}`}</p>
          <p className="text-muted-foreground">Base: {money(settlement.baseAmount)} • Adjustments: {money(adjustmentTotal)} • Gross settlement: {money(settlement.grossAmount)} • Advance: {money(settlement.advancePaid)} • Final: <strong className="text-destructive">{money(settlement.finalPayable)}</strong> • Collections: {money(settlement.collectionTotal)} • Status: {settlement.status}</p>
        </div>
        <DataTable rows={settlement.adjustments || []} columns={["adjustmentType", "description", "direction", "amount"]} moneyColumns={["amount"]} actionColumnClassName="max-md:w-12 max-md:min-w-12 md:w-20 md:min-w-20" actions={(row) => <Button className="h-7 min-h-7 w-7 p-0" variant="outline" title="Edit adjustment" onClick={() => editAdjustment(row)}><Pencil className="h-3.5 w-3.5" /></Button>} />
        <form className="grid gap-2 rounded-md border p-3 md:grid-cols-4" onSubmit={addAdjustment}>
          <Field label="Adjustment Type"><Input value={adjustment.adjustmentType} onChange={(event) => setAdjustment((current: AnyRow) => ({ ...current, adjustmentType: event.target.value }))} /></Field>
          <Field label="Description"><Input value={adjustment.description} onChange={(event) => setAdjustment((current: AnyRow) => ({ ...current, description: event.target.value }))} /></Field>
          <Field label="Amount"><Input type="number" value={adjustment.amount} onChange={(event) => setAdjustment((current: AnyRow) => ({ ...current, amount: event.target.value }))} /></Field>
          <Field label="Increase / Deduction"><SelectBox value={adjustment.direction} onChange={(event) => setAdjustment((current: AnyRow) => ({ ...current, direction: event.target.value }))}><option value="increase">Increase</option><option value="deduction">Deduction</option></SelectBox></Field>
          <div className="grid gap-2 md:col-span-4 sm:flex">
            <Button type="submit">{rowId(adjustment) ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {rowId(adjustment) ? "Update Adjustment" : "Add Adjustment"}</Button>
            {rowId(adjustment) ? <Button type="button" variant="ghost" onClick={() => setAdjustment({ adjustmentType: "Other", description: "", amount: "", direction: "increase" })}>Cancel Edit</Button> : null}
          </div>
        </form>
        <div className="grid gap-2 sm:flex">
          {settlement.status !== "Paid" ? <Button onClick={onMarkPaid}><ReceiptIndianRupee className="h-4 w-4" /> Mark as Paid</Button> : null}
          {settlement.status === "Paid" ? <Button variant="outline" onClick={onMarkUnpaid}><RefreshCcw className="h-4 w-4" /> Mark as Unpaid</Button> : null}
          <Button variant="outline" onClick={download}><Download className="h-4 w-4" /> Download Settlement Summary</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DinnerSettlementPaidModal({ event, onClose, onSaved }: { event: AnyRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AnyRow>({ paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: "Cash", referenceNumber: "", notes: "" });
  async function submit(eventSubmit: FormEvent) {
    eventSubmit.preventDefault();
    await api(`/dinner/events/${rowId(event)}/settlement/paid`, { method: "POST", body: JSON.stringify(form) });
    onSaved();
  }
  return (
    <Modal title="Mark Caterer Settlement Paid" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <Field label="Payment Date"><Input type="date" value={form.paymentDate} onChange={(event) => setForm((current: AnyRow) => ({ ...current, paymentDate: event.target.value }))} /></Field>
        <Field label="Payment Method"><SelectBox value={form.paymentMethod} onChange={(event) => setForm((current: AnyRow) => ({ ...current, paymentMethod: event.target.value }))}><option>Cash</option><option>GPay</option><option>Both</option></SelectBox></Field>
        <Field label="Reference Number"><Input value={form.referenceNumber} onChange={(event) => setForm((current: AnyRow) => ({ ...current, referenceNumber: event.target.value }))} /></Field>
        <Field label="Notes"><Input value={form.notes} onChange={(event) => setForm((current: AnyRow) => ({ ...current, notes: event.target.value }))} /></Field>
        <div className="grid gap-2 sm:flex"><Button type="submit">Mark Paid</Button><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button></div>
      </form>
    </Modal>
  );
}

function incomeLabel(type: string) {
  if (type.toLowerCase() === "aarti") return "Dharmik Falo (Aarti)";
  if (type.toLowerCase() === "balance") return "Previous Balance";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function festivalTotal(expenses: AnyRow) {
  return Object.values(expenses || {}).reduce((sum: number, category: any) => sum + Number(category.total || 0), 0);
}

function label(key: string) {
  const aliases: Record<string, string> = {
    houseId: "House",
    volunteerId: "Volunteer",
    festivalId: "Festival",
    __delete: "Delete"
  };
  if (aliases[key]) return aliases[key];
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem("token")));
  const [active, setActive] = useState<ResourceKey>(getInitialActivePage);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const role = localStorage.getItem("role");
  const menu = [{ key: "dashboard" as ResourceKey, title: "Dashboard", icon: BarChart3 }, { key: "funds" as ResourceKey, title: "Funds", icon: WalletCards }, { key: "dinner" as ResourceKey, title: "Dinner Management", icon: Utensils }, ...resources, { key: "reports" as ResourceKey, title: "Report", icon: FileText }];
  const publicMenu = menu.filter((item) => item.key === "dashboard" || item.key === "reports");
  const privateMenu = role === "non-admin" ? menu.filter((item) => item.key === "dashboard") : menu;
  const visibleMenu = authenticated ? privateMenu : publicMenu;
  const visibleKeys = visibleMenu.map((item) => item.key);
  const safeActive = visibleKeys.includes(active) ? active : "dashboard";
  const activeResource = useMemo(() => authenticated ? resources.find((resource) => resource.key === safeActive) : undefined, [authenticated, safeActive]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (visibleKeys.includes(active)) {
      localStorage.setItem(activePageStorageKey, active);
    }
  }, [active, visibleKeys.join("|")]);

  useEffect(() => {
    if (!visibleKeys.includes(active)) {
      setActive("dashboard");
      setMobileMenuOpen(false);
    }
  }, [active, visibleKeys.join("|")]);

  useEffect(() => {
    function handleAuthExpired() {
      setAuthenticated(false);
      setActive("dashboard");
      localStorage.removeItem(activePageStorageKey);
      setLoginOpen(false);
      setMobileMenuOpen(false);
    }

    window.addEventListener("auth-expired", handleAuthExpired);
    return () => window.removeEventListener("auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 360);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const currentLogo = theme === "dark" ? logoWhite : logoBlank;

  function logout() {
    localStorage.clear();
    localStorage.removeItem(activePageStorageKey);
    setAuthenticated(false);
    setActive("dashboard");
    setLoginOpen(false);
    setMobileMenuOpen(false);
  }

  function navigate(key: ResourceKey) {
    setActive(visibleKeys.includes(key) ? key : "dashboard");
    setMobileMenuOpen(false);
  }

  function handleLogin() {
    setAuthenticated(true);
    setLoginOpen(false);
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 overflow-y-auto bg-[#343a40] text-white lg:block">
        <div className="flex h-24 items-center justify-center border-b border-white/10 px-4"><img src={logoWhite} alt="Festival Expense Logo" className="max-h-20 object-contain" /></div>
        <nav className="p-2">{visibleMenu.map((item) => <NavButton key={item.key} icon={item.icon} active={active === item.key} onClick={() => navigate(item.key)} dark>{item.title}</NavButton>)}</nav>
      </aside>
      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-10 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
          <div className="flex min-h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button className="lg:hidden" variant="ghost" size="icon" onClick={() => setMobileMenuOpen((value) => !value)} title={mobileMenuOpen ? "Hide menu" : "Show menu"}>
                <Menu className="h-5 w-5" />
              </Button>
              <button
                className="inline-flex h-11 items-center rounded-md px-1 hover:bg-muted lg:hidden"
                onClick={() => navigate("dashboard")}
                title="Dashboard"
                type="button"
              >
                <img src={currentLogo} alt="Festival Expense Logo" className="h-10 w-auto object-contain" />
              </button>
              <span className="hidden text-sm text-muted-foreground lg:inline">Festival Expense Tracker</span>
              <nav className="hidden items-center gap-5 text-lg text-muted-foreground md:flex lg:ml-4">
                {visibleMenu.filter((item) => item.key === "dashboard" || item.key === "funds" || item.key === "dinner" || item.key === "reports").map((item) => (
                  <button className={cn("hover:text-foreground", safeActive === item.key && "text-foreground")} key={item.key} onClick={() => navigate(item.key)} type="button">{item.title}</button>
                ))}
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <a href="https://kplab.dev" target="_blank" rel="noreferrer" className="inline-flex items-center rounded-md px-1 py-1 hover:bg-muted sm:px-2" title="KP Labs">
                <img src={kpLabsLogo} alt="KP Labs" className="h-8 w-auto object-contain dark:invert sm:h-9" />
              </a>
              {authenticated ? (
                <Button variant="ghost" onClick={logout}><LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span></Button>
              ) : (
                <Button variant="ghost" onClick={() => setLoginOpen(true)}><LogIn className="h-4 w-4" /> <span className="hidden sm:inline">Login</span></Button>
              )}
            </div>
          </div>
          {mobileMenuOpen ? (
            <nav className="grid gap-1 border-t py-2 lg:hidden">
              {visibleMenu.map((item) => <NavButton key={item.key} icon={item.icon} active={active === item.key} onClick={() => navigate(item.key)}>{item.title}</NavButton>)}
            </nav>
          ) : null}
        </header>
        <main className="min-w-0 p-3 pb-20 sm:p-4 sm:pb-20">
          {!authenticated && safeActive === "dashboard" ? <PublicDashboard /> : null}
          {!authenticated && safeActive === "reports" ? <Reports publicMode /> : null}
          {authenticated && safeActive === "dashboard" ? <Dashboard setActive={setActive} /> : null}
          {authenticated && safeActive === "funds" ? <FundPage /> : null}
          {authenticated && safeActive === "dinner" ? <DinnerPage /> : null}
          {authenticated && safeActive === "reports" ? <Reports /> : null}
          {authenticated && activeResource ? <ResourcePage config={activeResource} /> : null}
        </main>
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-3 py-2 text-center text-xs text-muted-foreground backdrop-blur sm:px-4 md:py-3 md:text-sm lg:left-64">
          Made with <span className="text-red-600">♥</span> in India &nbsp;|&nbsp;
          Powered by <a className="font-medium text-primary hover:underline" href="https://kplab.dev" target="_blank" rel="noreferrer">kplab.dev</a>
        </footer>
      </div>
      {showScrollTop ? (
        <Button
          className="fixed bottom-14 right-4 z-40 rounded-full shadow-lg md:hidden"
          size="icon"
          title="Go to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      ) : null}
      {loginOpen ? (
        <Modal title="Login" onClose={() => setLoginOpen(false)}>
          <div className="flex justify-center">
            <Login compact onLogin={handleLogin} logoSrc={currentLogo} />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function NavButton({ active, icon: Icon, children, onClick, dark = false }: { active: boolean; icon: typeof Home; children: string; onClick: () => void; dark?: boolean }) {
  return (
    <button
      className={cn(
        "mb-1 flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm",
        dark ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-foreground hover:bg-muted",
        active && "bg-primary text-white hover:bg-primary hover:text-white"
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" />{children}
    </button>
  );
}
