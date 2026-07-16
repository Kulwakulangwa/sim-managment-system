import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Smartphone } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
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
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        toast.success(t("signUp") + " ✓");
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-10">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold">{t("appName")}</p>
            <p className="text-xs text-sidebar-foreground/70">{t("tagline")}</p>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-3xl font-bold leading-tight">
            {lang === "sw"
              ? "Endesha duka lako la simu kwa urahisi."
              : "Run your phone shop with confidence."}
          </h1>
          <p className="text-sidebar-foreground/70 text-sm leading-relaxed">
            {lang === "sw"
              ? "Ghala, mauzo, matengenezo, dhamana, malipo ya awamu, matumizi na ripoti — vyote sehemu moja."
              : "Inventory, sales, repairs, warranties, installments, expenses and reports — all in one place."}
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">© {new Date().getFullYear()} Duka Phone</p>
      </div>

      <div className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-end gap-2 mb-4 text-xs">
            <button onClick={() => setLang("en")} className={lang === "en" ? "font-semibold underline" : "text-muted-foreground"}>EN</button>
            <span className="text-muted-foreground">·</span>
            <button onClick={() => setLang("sw")} className={lang === "sw" ? "font-semibold underline" : "text-muted-foreground"}>SW</button>
          </div>
          <Card className="border-border shadow-sm">
            <CardHeader className="space-y-1">
              <h2 className="text-2xl font-bold">{mode === "in" ? t("signIn") : t("signUp")}</h2>
              <p className="text-sm text-muted-foreground">
                {mode === "up" ? t("firstUserOwner") : t("tagline")}
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submit}>
                {mode === "up" && (
                  <>
                    <div>
                      <Label htmlFor="fullName">{t("fullName")}</Label>
                      <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="phone">{t("phone")}</Label>
                      <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255…" />
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? t("loading") : mode === "in" ? t("signIn") : t("signUp")}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                {mode === "in" ? (
                  <>
                    {t("dontHaveAccount")}{" "}
                    <button className="text-primary font-medium" onClick={() => setMode("up")}>{t("signUp")}</button>
                  </>
                ) : (
                  <>
                    {t("haveAccount")}{" "}
                    <button className="text-primary font-medium" onClick={() => setMode("in")}>{t("signIn")}</button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
