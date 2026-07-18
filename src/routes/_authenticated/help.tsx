import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  BookOpen,
  ShoppingCart,
  Boxes,
  Wrench,
  CreditCard,
  Trash2,
  KeyRound,
  Upload,
  ShieldAlert,
  Users,
  Search,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/help")({
  component: HelpPage,
});

type Article = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  body: string[];
};

const ARTICLES: Article[] = [
  {
    id: "sales",
    title: "How to record a sale",
    icon: ShoppingCart,
    body: [
      "Open Sales → New sale (POS).",
      "Choose a product from your inventory. Stock decreases automatically once the sale is saved.",
      "Optionally pick a customer, set discount, warranty, and payment type (cash or installment).",
      "Click Complete sale. A receipt PDF opens for printing.",
      "If you made a mistake, open Trash later to restore any cancelled sale — nothing is deleted permanently by staff.",
    ],
  },
  {
    id: "inventory",
    title: "How to add or edit products",
    icon: Boxes,
    body: [
      "Go to Inventory → Add item. Fill in brand, model, IMEI (for phones), buy price, sell price and quantity.",
      "IMEI numbers must be unique per shop. Duplicates are blocked automatically to prevent double-selling.",
      "Set a low-stock threshold to get alerts on the dashboard when stock gets low.",
      "Edits, price changes and stock adjustments appear in Activity log for full traceability.",
    ],
  },
  {
    id: "repairs",
    title: "How to manage repairs",
    icon: Wrench,
    body: [
      "Open Repairs → New repair. Attach a customer, describe the device and issue, and set a repair cost.",
      "Update status as work progresses: Received → In progress → Completed.",
      "Every status change is timestamped in Activity log so you can prove what happened and when.",
    ],
  },
  {
    id: "installments",
    title: "How installments work",
    icon: CreditCard,
    body: [
      "When completing a sale, pick payment type = Installment and set months + down payment.",
      "The plan appears under Installments. Record each monthly payment there.",
      "Balance is calculated automatically — you cannot record a payment larger than what remains.",
    ],
  },
  {
    id: "trash",
    title: "Restore deleted items yourself",
    icon: Trash2,
    body: [
      "Deleted products, sales, customers, repairs and expenses go to Trash — nothing is lost immediately.",
      "Open Trash from the sidebar. Find the record and click Restore. It reappears everywhere it was before.",
      "Only Super Admin can permanently delete a record. Ask them if you need to free up space.",
    ],
  },
  {
    id: "password",
    title: "Reset your password",
    icon: KeyRound,
    body: [
      "On the sign-in page, click Forgot password. Enter your email and check your inbox for the reset link.",
      "Shop admins can also reset a staff password from the Staff page — no need to contact platform support.",
    ],
  },
  {
    id: "imports",
    title: "Import products or customers safely",
    icon: Upload,
    body: [
      "Downloads and uploads always go through validation first: you'll see valid, invalid and duplicate rows before anything is written.",
      "Invalid rows are never imported — fix them in your spreadsheet and re-upload.",
    ],
  },
  {
    id: "errors",
    title: "What to do when you see an error",
    icon: ShieldAlert,
    body: [
      "Every error is captured automatically. You don't need to email screenshots.",
      "Click Try again on the error screen. If it repeats, contact your Shop Admin. Super Admin can view the exact error under Errors.",
    ],
  },
  {
    id: "roles",
    title: "Roles & permissions",
    icon: Users,
    body: [
      "Super Admin: full platform access, all shops.",
      "Shop Admin: full control over one shop (inventory, sales, staff, reports, trash, audit log).",
      "Cashier: point-of-sale and sales history.",
      "Salesperson: sales and customer records.",
      "Technician: repairs only.",
    ],
  },
];

function HelpPage() {
  const [q, setQ] = useState("");
  const filtered = ARTICLES.filter((a) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      a.title.toLowerCase().includes(s) ||
      a.body.some((line) => line.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <BookOpen className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Help center</h1>
              <p className="text-sm text-white/70">
                Self-service guides for common tasks. Search below or browse.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="text-sm">{ARTICLES.length} articles</span>
          </div>
        </div>
        {/* Search bar inside header (optional, but we keep it below) */}
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search articles…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 bg-white dark:bg-slate-800 border-0 shadow-sm focus:ring-2 focus:ring-[#C45BA0]/30"
        />
      </div>

      {/* Articles grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            No articles match your search.
          </div>
        )}
        {filtered.map((a) => {
          const Icon = a.icon;
          return (
            <Card
              key={a.id}
              className="border-0 bg-white/80 shadow-sm backdrop-blur-sm dark:bg-slate-900/80 transition hover:shadow-md hover:-translate-y-0.5 duration-200"
            >
              <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
                <div className="rounded-lg bg-gradient-to-br from-[#C45BA0]/20 to-[#8B3A8F]/10 p-2.5 ring-1 ring-[#C45BA0]/20">
                  <Icon className="h-5 w-5 text-[#C45BA0]" />
                </div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-white">
                  {a.title}
                </h2>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">
                  {a.body.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
