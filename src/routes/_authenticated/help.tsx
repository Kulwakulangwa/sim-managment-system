import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BookOpen, ShoppingCart, Boxes, Wrench, CreditCard, Trash2, KeyRound, Upload, ShieldAlert, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/help")({
  component: HelpPage,
});

type Article = { id: string; title: string; icon: React.ComponentType<{ className?: string }>; body: string[] };

const ARTICLES: Article[] = [
  {
    id: "sales", title: "How to record a sale", icon: ShoppingCart,
    body: [
      "Open Sales → New sale (POS).",
      "Choose a product from your inventory. Stock decreases automatically once the sale is saved.",
      "Optionally pick a customer, set discount, warranty, and payment type (cash or installment).",
      "Click Complete sale. A receipt PDF opens for printing.",
      "If you made a mistake, open Trash later to restore any cancelled sale — nothing is deleted permanently by staff.",
    ],
  },
  {
    id: "inventory", title: "How to add or edit products", icon: Boxes,
    body: [
      "Go to Inventory → Add item. Fill in brand, model, IMEI (for phones), buy price, sell price and quantity.",
      "IMEI numbers must be unique per shop. Duplicates are blocked automatically to prevent double-selling.",
      "Set a low-stock threshold to get alerts on the dashboard when stock gets low.",
      "Edits, price changes and stock adjustments appear in Activity log for full traceability.",
    ],
  },
  {
    id: "repairs", title: "How to manage repairs", icon: Wrench,
    body: [
      "Open Repairs → New repair. Attach a customer, describe the device and issue, and set a repair cost.",
      "Update status as work progresses: Received → In progress → Completed.",
      "Every status change is timestamped in Activity log so you can prove what happened and when.",
    ],
  },
  {
    id: "installments", title: "How installments work", icon: CreditCard,
    body: [
      "When completing a sale, pick payment type = Installment and set months + down payment.",
      "The plan appears under Installments. Record each monthly payment there.",
      "Balance is calculated automatically — you cannot record a payment larger than what remains.",
    ],
  },
  {
    id: "trash", title: "Restore deleted items yourself", icon: Trash2,
    body: [
      "Deleted products, sales, customers, repairs and expenses go to Trash — nothing is lost immediately.",
      "Open Trash from the sidebar. Find the record and click Restore. It reappears everywhere it was before.",
      "Only Super Admin can permanently delete a record. Ask them if you need to free up space.",
    ],
  },
  {
    id: "password", title: "Reset your password", icon: KeyRound,
    body: [
      "On the sign-in page, click Forgot password. Enter your email and check your inbox for the reset link.",
      "Shop admins can also reset a staff password from the Staff page — no need to contact platform support.",
    ],
  },
  {
    id: "imports", title: "Import products or customers safely", icon: Upload,
    body: [
      "Downloads and uploads always go through validation first: you'll see valid, invalid and duplicate rows before anything is written.",
      "Invalid rows are never imported — fix them in your spreadsheet and re-upload.",
    ],
  },
  {
    id: "errors", title: "What to do when you see an error", icon: ShieldAlert,
    body: [
      "Every error is captured automatically. You don't need to email screenshots.",
      "Click Try again on the error screen. If it repeats, contact your Shop Admin. Super Admin can view the exact error under Errors.",
    ],
  },
  {
    id: "roles", title: "Roles & permissions", icon: Users,
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
    return a.title.toLowerCase().includes(s) || a.body.some((line) => line.toLowerCase().includes(s));
  });

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Help center</h1>
          <p className="text-sm text-muted-foreground">Self-service guides for common tasks. Search below or browse.</p>
        </div>
      </div>
      <Input placeholder="Search articles…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((a) => {
          const Icon = a.icon;
          return (
            <Card key={a.id}>
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <Icon className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold">{a.title}</h2>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
                  {a.body.map((line, i) => <li key={i}>{line}</li>)}
                </ol>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No articles match your search.</p>}
      </div>
    </div>
  );
}
