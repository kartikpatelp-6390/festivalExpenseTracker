import {
  BarChart3,
  Boxes,
  Calculator,
  CalendarDays,
  ClipboardList,
  Download,
  FileText,
  Home,
  LogOut,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  Minus,
  Menu,
  Moon,
  Sun,
  Trash2,
  UsersRound,
  WalletCards
} from "lucide-react";
import type React from "react";
import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, apiBlob, toQuery } from "@/lib/api";
import { cn } from "@/lib/utils";

type ResourceKey = "dashboard" | "funds" | "reports" | "festivals" | "house" | "volunteers" | "estimates" | "expenses" | "inventory" | "todos";
type AnyRow = Record<string, any>;
type Pagination = { total: number; page: number; limit: number; totalPages: number };
type FieldType = "text" | "number" | "date" | "password" | "checkbox" | "select";
type Field = { key: string; label: string; type?: FieldType; options?: string[] };
type ResourceConfig = {
  key: ResourceKey;
  title: string;
  path: string;
  icon: typeof Home;
  columns: string[];
  fields: Field[];
  searchFields?: string[];
};

const years = Array.from({ length: 14 }, (_, index) => 2024 + index);
const currentYear = new Date().getFullYear();
const logoBlank = "/assets/festival_logo_blank.png";
const logoWhite = "/assets/festival_logo_white.png";
const gpayQr = "/assets/GooglePay_QR.PNG";
const kpLabsLogo = "/assets/kplabs.svg";

function getInitialTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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
      { key: "festivalId", label: "Festival ID", type: "number" },
      { key: "category", label: "Category" },
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
      { key: "festivalId", label: "Festival ID", type: "number" },
      { key: "category", label: "Category" },
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
      { key: "category", label: "Category" },
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

function display(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value == null) return "";
  if (typeof value === "object") {
    const row = value as AnyRow;
    return row.name || row.ownerName || row.houseNumber || row._id || row.id || "";
  }
  return String(value);
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
    return festival?.name || "";
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
  return <select {...props} className={cn("h-9 rounded-md border bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", props.className)} />;
}

type SearchableOption = { value: string; label: string; search?: string };

function SearchableSelect({ value, options, placeholder = "Search", disabled, onChange }: { value: string; options: SearchableOption[]; placeholder?: string; disabled?: boolean; onChange: (value: string) => void }) {
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selected?.label || "");
  }, [selected?.label]);

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
          if (!next) onChange("");
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

function Login({ onLogin, logoSrc }: { onLogin: () => void; logoSrc: string }) {
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-center">
          <img src={logoSrc} alt="Festival Expense Logo" className="max-h-24 object-contain" />
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
    </main>
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

  useEffect(() => {
    const params = toQuery({ festivalYear: year, page: 1, limit: 250 });
    Promise.all([
      api<{ data: AnyRow[] }>(`/funds${params}`),
      api<{ data: AnyRow[] }>(`/expenses${params}`),
      api<{ data: AnyRow[] }>(`/estimates${params}`),
      api<{ data: AnyRow[] }>("/house?page=1&limit=500"),
      api<{ data: AnyRow[] }>("/volunteers?page=1&limit=250"),
      api<{ data: AnyRow[] }>("/todos?page=1&limit=5&sort=-createdAt")
    ]).then(([fundRes, expenseRes, estimateRes, houseRes, volunteerRes, todoRes]) => {
      setFunds(fundRes.data || []);
      setExpenses(expenseRes.data || []);
      setEstimates(estimateRes.data || []);
      setHouses(houseRes.data || []);
      setVolunteers(volunteerRes.data || []);
      setTodos(todoRes.data || []);
    }).catch(() => undefined);
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <strong className="text-xl">{money(balance)}</strong>
          <div className="h-3 min-w-48 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-[repeating-linear-gradient(45deg,#1aa7b8_0,#1aa7b8_8px,#38bfd0_8px,#38bfd0_16px)]" style={{ width: `${progress}%` }} />
          </div>
          <strong className="text-lg">{progress.toFixed(2)}%</strong>
          <strong className="text-xl text-primary">{money(fundTotal)}</strong>
        </div>
        <SelectBox value={year} onChange={(event) => setYear(event.target.value)}>
          <option value="">All</option>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </SelectBox>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardBlock
          className="bg-[#28a745]"
          title="Balance"
          value={balance}
          lines={[`Cash: ${money(paymentTotal(funds, "Cash") - paymentTotal(expenses, "Cash"))} | GPay: ${money(paymentTotal(funds, "GPay") - paymentTotal(expenses, "GPay"))}`]}
        />
        <DashboardBlock
          className="bg-[#17a2b8]"
          title="Total Fund"
          value={fundTotal}
          lines={[`Cash: ${money(paymentTotal(funds, "Cash"))} | GPay: ${money(paymentTotal(funds, "GPay"))}`]}
          onMore={() => setActive("funds")}
        />
        <DashboardBlock
          className="bg-[#dc3545]"
          title="Total Expense"
          value={expenseTotal}
          lines={[`Cash: ${money(paymentTotal(expenses, "Cash"))} | GPay: ${money(paymentTotal(expenses, "GPay"))}`, `Settled: ${money(settledTotal)} | Unsettled: ${money(unsettledTotal)}`]}
          onMore={() => setActive("expenses")}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <CountBlock className="bg-[#ffc107] text-[#1f2937]" title="Houses" value={houses.length} onMore={() => setActive("house")} />
          <CountBlock className="bg-[#007bff]" title="Volunteers" value={volunteers.length} onMore={() => setActive("volunteers")} />
          <CountBlock className="bg-[#6f42c1]" title="Estimate" value={money(estimateTotal)} onMore={() => setActive("estimates")} />
          <CountBlock className="bg-[#6c757d]" title="Todos" value={todos.length} onMore={() => setActive("todos")} />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <RecentPanel title="Recent Funds" rows={funds.slice(0, 5)} columns={["type", "name", "amount", "paymentMethod"]} moneyColumns={["amount"]} addLabel="Add New Fund" viewLabel="View All Funds" onAdd={() => setActive("funds")} onView={() => setActive("funds")} />
        <RecentPanel title="Recent Expenses" rows={expenses.slice(0, 5)} columns={["category", "amount", "volunteerId"]} moneyColumns={["amount"]} addLabel="Add New Expense" viewLabel="View All Expense" onAdd={() => setActive("expenses")} onView={() => setActive("expenses")} highlight />
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
    </section>
  );
}

function DashboardBlock({ className, title, value, lines, onMore }: { className: string; title: string; value: number; lines: string[]; onMore?: () => void }) {
  return (
    <div className={cn("overflow-hidden rounded-md text-white shadow-sm", className)}>
      <div className="space-y-5 p-5">
        <p className="text-5xl font-semibold">{money(value)}</p>
        <div>
          <p className="text-xl font-medium">{title}</p>
          <div className="mt-6 space-y-1 text-lg font-semibold">{lines.map((line) => <p key={line}>{line}</p>)}</div>
        </div>
      </div>
      {onMore ? <button className="w-full bg-black/10 px-3 py-2 text-lg font-semibold hover:bg-black/20" type="button" onClick={onMore}>More info</button> : <div className="h-11 bg-black/5" />}
    </div>
  );
}

function CountBlock({ className, title, value, onMore }: { className: string; title: string; value: string | number; onMore: () => void }) {
  return (
    <div className={cn("overflow-hidden rounded-md text-white shadow-sm", className)}>
      <div className="p-5">
        <p className="text-5xl font-semibold">{value}</p>
        <p className="mt-5 text-xl">{title}</p>
      </div>
      <button className="w-full bg-black/10 px-3 py-2 text-lg font-semibold hover:bg-black/20" type="button" onClick={onMore}>More info</button>
    </div>
  );
}

function RecentPanel({ title, rows, columns, moneyColumns, addLabel, viewLabel, onAdd, onView, renderCell, highlight }: { title: string; rows: AnyRow[]; columns: string[]; moneyColumns: string[]; addLabel: string; viewLabel: string; onAdd: () => void; onView: () => void; renderCell?: (row: AnyRow, column: string) => React.ReactNode | undefined; highlight?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between border-b">
        <CardTitle>{title}</CardTitle>
        <div className="flex gap-4 text-xl text-muted-foreground"><span>-</span><span>x</span></div>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable rows={rows} columns={columns} moneyColumns={moneyColumns} renderCell={renderCell} rowClassName={highlight ? "bg-emerald-100 text-emerald-950 hover:bg-emerald-100 dark:bg-emerald-100 dark:text-emerald-950 dark:hover:bg-emerald-100" : undefined} />
        <div className="flex justify-between gap-2 border-t p-4">
          <Button onClick={onAdd}><Plus className="h-4 w-4" /> {addLabel}</Button>
          <Button variant="outline" onClick={onView}>{viewLabel}</Button>
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

  const columns = ["type", "name", "houseId", "amount", "volunteerId", "paymentMethod", "reference"];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Fund List</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openSummary}><UsersRound className="h-4 w-4" /> Volunteer Summary</Button>
          <Button variant="outline" onClick={openUnpaid}><Home className="h-4 w-4" /> Unpaid List</Button>
          <Button onClick={() => { setEditing(null); setDraftFund(null); setModal("form"); }}><Plus className="h-4 w-4" /> Add Fund</Button>
        </div>
      </div>
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setSort("-createdAt")}><RefreshCcw className="h-4 w-4" /> Reset Sort</Button>
            <SelectBox value={year} onChange={(event) => setYear(event.target.value)}><option value="">All</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</SelectBox>
            <SelectBox value={volunteerId} onChange={(event) => setVolunteerId(event.target.value)}>
              <option value="">All Volunteers</option>
              {volunteers.map((volunteer) => <option key={rowId(volunteer)} value={rowId(volunteer)}>{volunteer.name}</option>)}
            </SelectBox>
            <Input className="w-36" placeholder="Search amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <div className="relative w-44">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Input className="w-40" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <Input className="w-40" type="date" value={endDate} min={startDate} disabled={!startDate} onChange={(event) => setEndDate(event.target.value)} />
            <Button variant="outline" onClick={() => { setStartDate(""); setEndDate(""); }}>Clear Dates</Button>
          </div>
          <DataTable
            rows={rows}
            columns={columns}
            moneyColumns={["amount"]}
            sortableColumns={["amount"]}
            onSort={(column) => setSort(sort === column ? `-${column}` : column)}
            actions={(row) => (
              <div className="flex gap-1">
                <Button variant="outline" size="icon" title="Receipt" onClick={() => downloadReceipt(rowId(row))}><ReceiptText className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" title="WhatsApp" onClick={() => openWhatsApp(row)}><WhatsAppIcon /></Button>
                <Button variant="outline" size="icon" title="Edit" onClick={() => { setEditing(row); setModal("form"); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(rowId(row))}><Trash2 className="h-4 w-4" /></Button>
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

  function setValue(key: string, value: string) {
    const next = { ...form, [key]: value };
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
  }

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
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit">Save</Button>
          <Button type="button" variant="secondary" onClick={(event) => submit(event as unknown as FormEvent, "download")}><Download className="h-4 w-4" /> Save & Download</Button>
          <Button type="button" variant="outline" onClick={(event) => submit(event as unknown as FormEvent, "new")}>Save & New</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
      {form.paymentMethod === "GPay" ? (
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-3 rounded-md border bg-card p-2 text-left shadow-sm hover:bg-muted"
          onClick={() => setQrOpen(true)}
        >
          <img src={gpayQr} alt="Google Pay QR" className="h-20 w-20 rounded border bg-white object-contain p-1" />
          <span className="text-sm font-medium">Open QR</span>
        </button>
      ) : null}
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

function Reports() {
  const [year, setYear] = useState(String(currentYear));
  const [reportData, setReportData] = useState<any>({ income: 0, expenses: {}, totalExpense: 0, balance: 0 });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api<{ data: any }>(`/reports/yearly-report${toQuery({ year })}`).then((res) => setReportData(res.data || {})).catch(() => undefined);
  }, [year]);

  async function downloadReport() {
    setDownloading(true);
    try {
      const blob = await apiBlob(`/reports/download-report${toQuery({ year })}`);
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
        <CardContent className="flex flex-wrap items-end justify-between gap-3 pt-4">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Filter Year">
              <SelectBox className="w-32" value={year} onChange={(event) => setYear(event.target.value)}>
                <option value="">All</option>
                {years.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectBox>
            </Field>
          </div>
          <Button onClick={downloadReport} disabled={downloading}>
            <Download className="h-4 w-4" /> {downloading ? "Exporting..." : "Export PDF"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto p-5">
          <Table>
            <TableHeader>
              <TableRow className="border-[#343a40] bg-[#212529] hover:bg-[#212529]">
                <TableHead className="h-11 text-center text-base font-bold text-white">Title</TableHead>
                <TableHead className="h-11 text-center text-base font-bold text-white">Income</TableHead>
                <TableHead className="h-11 text-center text-base font-bold text-white">Expense</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="h-10">
                <TableCell className="py-2 text-base font-bold">Total Income</TableCell>
                <TableCell className="py-2 text-right text-base font-bold">{money(reportData.income)}</TableCell>
                <TableCell />
              </TableRow>
              {incomeKeys.map((key) => (
                <TableRow className="h-10" key={key}>
                  <TableCell className="py-2 pr-4 text-right text-base italic">{incomeLabel(key)}</TableCell>
                  <TableCell className="py-2 text-right text-base">{money(reportData.incomeGroup[key].total)}</TableCell>
                  <TableCell />
                </TableRow>
              ))}
              {festivalKeys.map((festival) => (
                <Fragment key={festival}>
                  <TableRow className="h-10 bg-[#b8dcff] hover:bg-[#b8dcff]">
                    <TableCell className="py-2 text-base font-bold text-black" colSpan={3}>{festival}</TableCell>
                  </TableRow>
                  {Object.keys(reportData.expenses[festival] || {}).map((category) => (
                    <Fragment key={`${festival}-${category}`}>
                      <TableRow className="h-10 bg-[#e4ebf2] hover:bg-[#e4ebf2] dark:bg-[#263443] dark:hover:bg-[#263443]">
                        <TableCell className="py-2 pr-6 text-right text-base italic text-slate-950 dark:text-slate-100">{category}</TableCell>
                        <TableCell />
                        <TableCell className="py-2 pr-4 text-right text-base font-bold text-slate-950 dark:text-slate-100">{money(reportData.expenses[festival][category].total)}</TableCell>
                      </TableRow>
                      {(reportData.expenses[festival][category].items || []).map((item: AnyRow, index: number) => (
                        <TableRow className="h-10" key={`${festival}-${category}-${index}`}>
                          <TableCell className="py-2 pr-4 text-right text-base">{item.title || item.description || "-"}</TableCell>
                          <TableCell />
                          <TableCell className="py-2 text-right text-base">{money(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                  <TableRow className="h-10">
                    <TableCell className="py-2 pr-4 text-right text-base font-bold">Subtotal - {festival}</TableCell>
                    <TableCell />
                    <TableCell className="py-2 text-right text-base font-bold">{money(festivalTotal(reportData.expenses[festival]))}</TableCell>
                  </TableRow>
                  <TableRow className="h-3"><TableCell className="py-1" colSpan={3} /></TableRow>
                </Fragment>
              ))}
              <TableRow className="h-10">
                <TableCell className="py-2 text-base font-bold">Total</TableCell>
                <TableCell className="py-2 text-right text-base font-bold">{money(reportData.income)}</TableCell>
                <TableCell className="py-2 text-right text-base font-bold">{money(reportData.totalExpense)}</TableCell>
              </TableRow>
              <TableRow className="h-10">
                <TableCell className="py-2 text-base font-bold">Balance</TableCell>
                <TableCell />
                <TableCell className={cn("py-2 text-right text-base font-bold", Number(reportData.balance || 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>{money(reportData.balance)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
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

  function edit(row: AnyRow) {
    const next: AnyRow = {};
    config.fields.forEach((field) => {
      const value = row[field.key];
      if (field.key === "volunteerId") {
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

  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div id="resource-form" className={cn("xl:hidden", showForm ? "block" : "hidden")}>
        <ResourceFormCard config={config} editingId={editingId} form={form} relationOptions={{ volunteerId: volunteers.map((volunteer) => ({ value: rowId(volunteer), label: volunteer.name || "", search: `${volunteer.phone || ""} ${volunteer.name || ""}` })) }} setForm={setForm} onSave={save} onClear={() => { setForm({}); setEditingId(null); setShowForm(false); }} />
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{config.title} List</h1>
          <Button onClick={openForm}><Plus className="h-4 w-4" /> {`Add ${config.title}`}</Button>
        </div>
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 pt-4">
            {config.key === "festivals" || config.key === "estimates" || config.key === "expenses" ? <SelectBox value={year} onChange={(event) => { setYear(event.target.value); if (event.target.value) setFestivalId(""); }}><option value="">All</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</SelectBox> : null}
            {config.key === "estimates" || config.key === "expenses" ? <SelectBox value={festivalId} onChange={(event) => { setFestivalId(event.target.value); if (event.target.value) setYear(""); }}><option value="">All Festivals</option>{festivals.map((festival) => <option key={rowId(festival)} value={rowId(festival)}>{festival.name} ({festival.year})</option>)}</SelectBox> : null}
            {config.key === "expenses" ? <SelectBox value={volunteerId} onChange={(event) => setVolunteerId(event.target.value)}><option value="">All Volunteers</option>{volunteers.map((volunteer) => <option key={rowId(volunteer)} value={rowId(volunteer)}>{volunteer.name}</option>)}</SelectBox> : null}
            {config.key === "estimates" || config.key === "expenses" ? <Input className="w-36" placeholder="Search amount" value={amount} onChange={(event) => setAmount(event.target.value)} /> : null}
            {config.key === "todos" ? <SelectBox value={todoStatus} onChange={(event) => setTodoStatus(event.target.value)}><option value="">All</option><option value="false">Pending</option><option value="true">Completed</option></SelectBox> : null}
            {config.key === "todos" ? <SelectBox value={todoSort} onChange={(event) => setTodoSort(event.target.value)}><option value="desc">Latest First</option><option value="asc">Oldest First</option></SelectBox> : null}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </CardContent>
        </Card>
        <Card><CardContent className="p-0">
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
      <div className="hidden xl:block" id="resource-form-desktop">
        <ResourceFormCard config={config} editingId={editingId} form={form} relationOptions={{ volunteerId: volunteers.map((volunteer) => ({ value: rowId(volunteer), label: volunteer.name || "", search: `${volunteer.phone || ""} ${volunteer.name || ""}` })) }} setForm={setForm} onSave={save} onClear={() => { setForm({}); setEditingId(null); }} />
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
        <div className="flex justify-end gap-2">
          <Button disabled={loading} variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={loading} onClick={onConfirm}>{loading ? "Updating..." : action.charAt(0).toUpperCase() + action.slice(1)}</Button>
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
        <form className="space-y-3" onSubmit={onSave}>
          {config.fields.map((field) => <FieldEditor key={field.key} field={field} options={relationOptions[field.key]} value={form[field.key]} onChange={(value) => setForm((current: AnyRow) => ({ ...current, [field.key]: value }))} />)}
          <div className="flex gap-2"><Button type="submit">{editingId ? "Update" : "Create"}</Button><Button type="button" variant="outline" onClick={onClear}>Clear</Button></div>
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
          {rows.map((volunteer) => {
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
                      <DataTable rows={list} columns={["festivalId", "category", "amount", "paymentMethod", "date"]} moneyColumns={["amount"]} />
                      <div className="border-t bg-background px-4 py-2 text-sm font-semibold">
                        Total: {money(total)} <span className="ml-2 text-muted-foreground">(Cash: {money(cash)}, GPay: {money(gpay)})</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function FieldEditor({ field, value, options, onChange }: { field: Field; value: any; options?: SearchableOption[]; onChange: (value: any) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{field.label}</span>
      {options ? <SearchableSelect value={String(value ?? "")} onChange={onChange} options={options} placeholder={`Search ${field.label.toLowerCase()}`} /> :
        field.type === "checkbox" ? <input className="h-5 w-5 accent-primary" type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /> :
        field.type === "select" ? <SelectBox value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}><option value="">Select</option>{(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</SelectBox> :
          <Input type={field.type || "text"} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function DataTable({ rows, columns, actions, renderCell, moneyColumns = [], sortableColumns = [], onSort, rowClassName }: { rows: AnyRow[]; columns: string[]; actions?: (row: AnyRow) => React.ReactNode; renderCell?: (row: AnyRow, column: string) => React.ReactNode | undefined; moneyColumns?: string[]; sortableColumns?: string[]; onSort?: (column: string) => void; rowClassName?: string }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>{columns.map((column) => <TableHead key={column} onClick={() => sortableColumns.includes(column) && onSort?.(column)} className={cn(sortableColumns.includes(column) && "cursor-pointer text-primary")}>{label(column)}</TableHead>)}{actions ? <TableHead>Action</TableHead> : null}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? rows.map((row) => <TableRow key={rowId(row)} className={rowClassName}>{columns.map((column) => <TableCell key={column}>{renderCell?.(row, column) ?? (moneyColumns.includes(column) ? money(row[column]) : displayCell(row, column))}</TableCell>)}{actions ? <TableCell>{actions(row)}</TableCell> : null}</TableRow>) : <TableRow><TableCell colSpan={columns.length + (actions ? 1 : 0)} className="text-center text-muted-foreground">No records found</TableCell></TableRow>}
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Show</span>
        <SelectBox value={String(pageSize)} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
        </SelectBox>
        <span className="text-muted-foreground">records per page</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{start}-{end} of {pagination.total || 0}</span>
        <Button variant="outline" className="h-8 px-2" disabled={page <= 1} onClick={() => onPageChange(1)}>First</Button>
        <Button variant="outline" className="h-8 px-2" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</Button>
        <span className="px-2 font-medium">Page {page} / {totalPages}</span>
        <Button variant="outline" className="h-8 px-2" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
        <Button variant="outline" className="h-8 px-2" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>Last</Button>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={cn("max-h-[90vh] w-full overflow-auto rounded-lg bg-background shadow-xl", wide ? "max-w-4xl" : "max-w-2xl")}>
        <div className="flex items-center justify-between border-b p-4"><h2 className="font-semibold">{title}</h2><Button variant="ghost" onClick={onClose}>Close</Button></div>
        <div className="p-4">{children}</div>
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
        <div className="max-h-[650px] overflow-auto rounded-md border">
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
          <button className="flex w-full items-center justify-between rounded-md border p-3 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60" disabled={Boolean(sendingPhone)} key={phone} onClick={() => sendReceipt(phone)} type="button">
            <span>{phone}</span>
            {sendingPhone === phone ? <RefreshCcw className="h-5 w-5 animate-spin text-emerald-700" /> : <WhatsAppIcon />}
          </button>
        )) : <p className="text-sm text-muted-foreground">No phone number found for this fund.</p>}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
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
    festivalId: "Festival"
  };
  if (aliases[key]) return aliases[key];
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem("token")));
  const [active, setActive] = useState<ResourceKey>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const role = localStorage.getItem("role");
  const activeResource = useMemo(() => resources.find((resource) => resource.key === active), [active]);
  const menu = [{ key: "dashboard" as ResourceKey, title: "Dashboard", icon: BarChart3 }, { key: "funds" as ResourceKey, title: "Funds", icon: WalletCards }, ...resources, { key: "reports" as ResourceKey, title: "Report", icon: FileText }];
  const visibleMenu = role === "non-admin" ? menu.filter((item) => item.key === "dashboard") : menu;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    function handleAuthExpired() {
      setAuthenticated(false);
      setActive("dashboard");
      setMobileMenuOpen(false);
    }

    window.addEventListener("auth-expired", handleAuthExpired);
    return () => window.removeEventListener("auth-expired", handleAuthExpired);
  }, []);

  const currentLogo = theme === "dark" ? logoWhite : logoBlank;

  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} logoSrc={currentLogo} />;

  function logout() {
    localStorage.clear();
    setAuthenticated(false);
  }

  function navigate(key: ResourceKey) {
    setActive(key);
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-[#343a40] text-white lg:block">
        <div className="flex h-24 items-center justify-center border-b border-white/10 px-4"><img src={logoWhite} alt="Festival Expense Logo" className="max-h-20 object-contain" /></div>
        <nav className="p-2">{visibleMenu.map((item) => <NavButton key={item.key} icon={item.icon} active={active === item.key} onClick={() => navigate(item.key)} dark>{item.title}</NavButton>)}</nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b bg-background/95 px-4 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button className="lg:hidden" variant="ghost" size="icon" onClick={() => setMobileMenuOpen((value) => !value)} title={mobileMenuOpen ? "Hide menu" : "Show menu"}>
                <Menu className="h-5 w-5" />
              </Button>
              <img src={currentLogo} alt="Festival Expense Logo" className="h-10 w-auto object-contain lg:hidden" />
              <span className="hidden text-sm text-muted-foreground lg:inline">Festival Expense Tracker</span>
              <nav className="hidden items-center gap-5 text-lg text-muted-foreground md:flex lg:ml-4">
                <button className={cn("hover:text-foreground", active === "dashboard" && "text-foreground")} onClick={() => navigate("dashboard")} type="button">Dashboard</button>
                <button className={cn("hover:text-foreground", active === "funds" && "text-foreground")} onClick={() => navigate("funds")} type="button">Fund</button>
                <button className={cn("hover:text-foreground", active === "reports" && "text-foreground")} onClick={() => navigate("reports")} type="button">Report</button>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <a href="https://kplabs.dev" target="_blank" rel="noreferrer" className="inline-flex items-center rounded-md px-2 py-1 hover:bg-muted" title="KP Labs">
                <img src={kpLabsLogo} alt="KP Labs" className="h-9 w-auto object-contain" />
              </a>
              <Button variant="ghost" onClick={logout}><LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span></Button>
            </div>
          </div>
          {mobileMenuOpen ? (
            <nav className="grid gap-1 border-t py-2 lg:hidden">
              {visibleMenu.map((item) => <NavButton key={item.key} icon={item.icon} active={active === item.key} onClick={() => navigate(item.key)}>{item.title}</NavButton>)}
            </nav>
          ) : null}
        </header>
        <main className="p-4">
          {active === "dashboard" ? <Dashboard setActive={setActive} /> : active === "funds" ? <FundPage /> : active === "reports" ? <Reports /> : activeResource ? <ResourcePage config={activeResource} /> : null}
        </main>
      </div>
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
