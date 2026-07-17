import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  Smartphone,
  Boxes,
  Wrench,
  ShieldCheck,
  CreditCard,
  BarChart3,
  Fingerprint,
  Check,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <HeroPanel />

      <div className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-end gap-2 mb-4 text-xs">
            <button onClick={() => setLang("en")} className={lang === "en" ? "font-semibold underline" : "text-muted-foreground"}>EN</button>
            <span className="text-muted-foreground">·</span>
            <button onClick={() => setLang("sw")} className={lang === "sw" ? "font-semibold underline" : "text-muted-foreground"}>SW</button>
          </div>
          <Card className="border-border shadow-sm">
            <CardHeader className="space-y-1">
              <h2 className="text-2xl font-bold">{t("signIn")}</h2>
              <p className="text-sm text-muted-foreground">{t("tagline")}</p>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submit}>
                <div>
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? t("loading") : t("signIn")}
                </Button>
                <div className="text-center">
                  <Link to="/auth/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                    {t("forgotPassword")}
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HeroPanel() {
  const features = [
    "Inventory Management",
    "IMEI Tracking",
    "Repair Management",
    "Warranty Tracking",
    "Installment Sales",
    "Business Reports",
  ];
  const stats = [
    { value: "10,000+", label: "Devices Managed" },
    { value: "500+", label: "Repairs Processed" },
    { value: "99.9%", label: "Data Accuracy" },
  ];
  return (
    <div
      className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10 text-white"
      style={{ background: "linear-gradient(160deg, #021B1B 0%, #003B3B 100%)" }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle, #22d3ee 0%, transparent 70%)" }}
      />
      {/* Grid noise */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 backdrop-blur-md ring-1 ring-white/20">
          <Smartphone className="h-5 w-5 text-emerald-300" />
        </div>
        <div>
          <p className="text-base font-semibold tracking-tight">Duka Phone</p>
          <p className="text-[11px] text-white/60">Phone Shop Management</p>
        </div>
      </div>

      {/* Middle: Copy + Visual */}
      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[1.05fr_1fr] gap-10 items-center py-8">
        <div className="space-y-6 max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-emerald-200 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            Trusted by Phone Shops
          </span>
          <h1 className="text-4xl xl:text-[2.6rem] leading-[1.1] font-semibold tracking-tight">
            Manage Your Entire{" "}
            <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              Phone Business
            </span>{" "}
            From One Place
          </h1>
          <p className="text-sm leading-relaxed text-white/70">
            Track inventory, IMEI numbers, repairs, sales, warranties and customer records with confidence.
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-1">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-white/85">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-400/15 ring-1 ring-emerald-400/30">
                  <Check className="h-3 w-3 text-emerald-300" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Visual composition */}
        <PhoneComposition />
      </div>

      {/* Stats */}
      <div className="relative z-10 space-y-4">
        <div className="grid grid-cols-3 gap-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-inset ring-white/10 backdrop-blur-md">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-xl xl:text-2xl font-semibold tracking-tight bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                {s.value}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-white/50">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-white/40">© {new Date().getFullYear()} Duka Phone — Business software for phone shops.</p>
      </div>
    </div>
  );
}

function PhoneComposition() {
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-md">
      {/* Floating card: Today's Sales */}
      <FloatingCard className="left-0 top-4 animate-[float_7s_ease-in-out_infinite]">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-400/20">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/50">Today's Sales</p>
            <p className="text-sm font-semibold text-white">TZS 2,480,000</p>
          </div>
        </div>
      </FloatingCard>

      {/* Floating card: Inventory */}
      <FloatingCard className="right-2 top-0 animate-[float_9s_ease-in-out_infinite_-2s]">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-400/20">
            <Boxes className="h-3.5 w-3.5 text-cyan-300" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/50">Inventory</p>
            <p className="text-sm font-semibold text-white">1,284 units</p>
          </div>
        </div>
      </FloatingCard>

      {/* Phones */}
      <div className="absolute inset-0 flex items-center justify-center">
        <PhoneShape className="translate-x-[-58px] translate-y-4 rotate-[-10deg] scale-90 opacity-90" tint="from-slate-800 to-slate-900" screenTint="from-emerald-500/25 to-cyan-500/10" />
        <PhoneShape className="z-10" tint="from-zinc-900 to-black" screenTint="from-emerald-400/30 to-cyan-500/20" showDashboard />
        <PhoneShape className="translate-x-[58px] translate-y-6 rotate-[10deg] scale-90 opacity-90" tint="from-neutral-800 to-neutral-950" screenTint="from-cyan-500/20 to-emerald-500/10" />
      </div>

      {/* Floating card: Repairs */}
      <FloatingCard className="left-1 bottom-16 animate-[float_8s_ease-in-out_infinite_-1s]">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-400/20">
            <Wrench className="h-3.5 w-3.5 text-amber-300" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/50">Repairs</p>
            <p className="text-sm font-semibold text-white">14 open</p>
          </div>
        </div>
      </FloatingCard>

      {/* Floating card: Customers */}
      <FloatingCard className="right-0 bottom-4 animate-[float_10s_ease-in-out_infinite_-3s]">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-fuchsia-400/20">
            <Users className="h-3.5 w-3.5 text-fuchsia-300" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/50">Customers</p>
            <p className="text-sm font-semibold text-white">3,921</p>
          </div>
        </div>
      </FloatingCard>

      {/* Floating chip: IMEI */}
      <FloatingCard className="left-1/2 -translate-x-1/2 -bottom-2 animate-[float_11s_ease-in-out_infinite_-4s]">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-3.5 w-3.5 text-emerald-300" />
          <p className="text-[11px] font-medium text-white/90">IMEI 354983•••</p>
          <span className="rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">Verified</span>
        </div>
      </FloatingCard>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(var(--tx, 0)); }
          50% { transform: translateY(-10px) translateX(var(--tx, 0)); }
        }
      `}</style>
    </div>
  );
}

function FloatingCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`absolute rounded-xl bg-white/[0.06] px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-white/15 backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

function PhoneShape({
  className = "",
  tint,
  screenTint,
  showDashboard = false,
}: {
  className?: string;
  tint: string;
  screenTint: string;
  showDashboard?: boolean;
}) {
  return (
    <div
      className={`relative h-[320px] w-[160px] rounded-[2rem] bg-gradient-to-b ${tint} p-[6px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/10 ${className}`}
    >
      <div className={`relative h-full w-full overflow-hidden rounded-[1.6rem] bg-gradient-to-br ${screenTint} bg-[#0a1f1f]`}>
        {/* Notch */}
        <div className="absolute left-1/2 top-1.5 h-4 w-16 -translate-x-1/2 rounded-full bg-black/80" />
        {showDashboard && (
          <div className="absolute inset-0 flex flex-col gap-2 p-3 pt-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[8px] uppercase tracking-wider text-white/50">Revenue</p>
                <p className="text-[13px] font-semibold text-white">TZS 12.4M</p>
              </div>
              <span className="rounded-md bg-emerald-400/20 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-300">
                +18%
              </span>
            </div>
            {/* Mini chart */}
            <div className="mt-1 flex h-14 items-end gap-1">
              {[40, 65, 45, 78, 60, 88, 72, 95].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-gradient-to-t from-emerald-500/70 to-cyan-400/70"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            {/* Rows */}
            <div className="mt-1 space-y-1.5">
              <MiniRow icon={<Boxes className="h-2.5 w-2.5" />} label="Stock" value="1,284" />
              <MiniRow icon={<Wrench className="h-2.5 w-2.5" />} label="Repairs" value="14" />
              <MiniRow icon={<ShieldCheck className="h-2.5 w-2.5" />} label="Warranty" value="326" />
              <MiniRow icon={<CreditCard className="h-2.5 w-2.5" />} label="Installments" value="47" />
              <MiniRow icon={<BarChart3 className="h-2.5 w-2.5" />} label="Reports" value="Live" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-white/[0.06] px-1.5 py-1 ring-1 ring-inset ring-white/10">
      <div className="flex items-center gap-1.5 text-[9px] text-white/70">
        <span className="text-emerald-300">{icon}</span>
        {label}
      </div>
      <span className="text-[9px] font-semibold text-white">{value}</span>
    </div>
  );
}
