import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/auth/reset-password")({
  ssr: false,
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase places the recovery session in URL hash; the client picks it up automatically.
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setReady(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate({ to: "/auth", replace: true }), 1800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="text-sm text-muted-foreground">Choose a strong password of at least 8 characters.</p>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              <p className="text-sm">Password updated. Redirecting to sign in…</p>
            </div>
          ) : !ready ? (
            <p className="text-sm text-muted-foreground">
              Open this page from the reset link in your email. If the link expired, request a new one from the sign-in page.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="pw">New password</Label>
                <Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pw2">Confirm password</Label>
                <Input id="pw2" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Saving…" : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
