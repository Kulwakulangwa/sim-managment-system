import { useState } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { Link2, Linkedin, Share2, Download } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/auth')({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // ─── Access control check ──────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userRole, error: roleError } = await supabase
        .from("user_roles")
        .select("role, shop_id, expires_at")
        .eq("user_id", user.id)
        .single();

      console.log("[Login] userRole:", userRole);
      console.log("[Login] roleError:", roleError);

      // Super admin always allowed
      if (userRole?.role === "super_admin") {
        console.log("[Login] Super admin – skipping checks");
      } else {
        let blocked = false;
        let blockMessage = "";

        if (userRole?.role === "shop_admin") {
          // Shop admin: check own expiry
          const expired = !userRole?.expires_at || new Date(userRole.expires_at) < new Date();
          if (expired) {
            blocked = true;
            blockMessage = "Your account has expired. Please contact your administrator.";
          }
        } else {
          // Staff (cashier, salesperson, technician): check their shop_admin
          if (userRole?.shop_id) {
            const { data: shopAdmin, error: saError } = await supabase
              .from("user_roles")
              .select("expires_at")
              .eq("shop_id", userRole.shop_id)
              .eq("role", "shop_admin")
              .single();

            console.log("[Login] Shop admin for staff:", shopAdmin, saError);
            const shopAdminExpired = !shopAdmin?.expires_at || new Date(shopAdmin.expires_at) < new Date();
            if (shopAdminExpired) {
              blocked = true;
              blockMessage = "Your shop's admin account has been suspended. Please contact your administrator.";
            }
          }
        }

        if (blocked) {
          await supabase.auth.signOut();
          setError(blockMessage);
          setLoading(false);
          return;
        }
      }
    }

    navigate({ to: '/dashboard' });
  };

  const bgImage =
    import.meta.env.VITE_BG_IMAGE_URL ||
    'https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=800&auto=format&fit=crop';

  return (
    <div className={cn(
      "flex min-h-screen flex-col md:flex-row",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      {/* LEFT PANEL – Background image + brand */}
      <div className="relative hidden flex-1 flex-col items-center justify-between text-white md:flex lg:flex-[1.15]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${bgImage}')` }}
        />
        <div className="absolute inset-0 bg-[#0B1221]/60" />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4">
          {/* Pink "D" logo */}
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-500/30">
            <span className="font-serif text-4xl font-medium text-white">D</span>
          </div>
          <div className="text-center">
            <div className="text-2xl font-medium tracking-wide">Duka Phone</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/60">
              business software for phone shops
            </div>
          </div>
        </div>

        <div className="relative z-10 flex w-full items-center justify-between border-t border-white/10 px-8 py-4">
          <span className="text-xs text-white/50">© royotechtz</span>
          <div className="flex items-center gap-3">
            <button className="text-white/40 transition hover:text-white/80"><Link2 className="h-4 w-4" /></button>
            <button className="text-white/40 transition hover:text-white/80"><Linkedin className="h-4 w-4" /></button>
            <button className="text-white/40 transition hover:text-white/80"><Share2 className="h-4 w-4" /></button>
            <button className="text-white/40 transition hover:text-white/80"><Download className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL – Sign in form with dark mode */}
      <div className={cn(
        "flex flex-1 flex-col px-6 py-8 md:px-12 md:py-12",
        theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
      )}>
        <div className="ml-auto font-mono text-xs text-[#8b93a3] dark:text-slate-500">
          <span className={cn(
            "font-medium",
            theme === "dark" ? "text-white" : "text-[#0B1221]"
          )}>EN</span> · SW
        </div>

        <div className="mx-auto mt-8 w-full max-w-sm flex-1 md:mt-20">
          <h2 className={cn(
            "font-serif text-2xl font-medium md:text-3xl",
            theme === "dark" ? "text-white" : "text-[#0B1221]"
          )}>Sign in</h2>
          <p className="mt-1 text-sm text-[#6b7280] dark:text-slate-400">Phone Shop Management</p>

          <form onSubmit={handleSignIn} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className={cn(
                "block text-xs font-medium",
                theme === "dark" ? "text-slate-300" : "text-[#0B1221]"
              )}>Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(
                  "mt-1.5 h-11 w-full rounded-lg border px-3 text-sm outline-none transition",
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:border-pink-500 focus:shadow-[0_0_0_3px_rgba(236,72,153,0.15)]"
                    : "border-[#dfe2e8] bg-white text-[#0B1221] focus:border-pink-500 focus:shadow-[0_0_0_3px_rgba(236,72,153,0.15)]"
                )}
                placeholder="name@yourshop.co.tz"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className={cn(
                "block text-xs font-medium",
                theme === "dark" ? "text-slate-300" : "text-[#0B1221]"
              )}>Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  "mt-1.5 h-11 w-full rounded-lg border px-3 text-sm outline-none transition",
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:border-pink-500 focus:shadow-[0_0_0_3px_rgba(236,72,153,0.15)]"
                    : "border-[#dfe2e8] bg-white text-[#0B1221] focus:border-pink-500 focus:shadow-[0_0_0_3px_rgba(236,72,153,0.15)]"
                )}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 text-sm font-medium text-white shadow-lg shadow-pink-500/30 transition hover:shadow-pink-500/50 hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <Link
            to="/auth/forgot-password"
            className="mt-4 block text-center text-sm text-[#6b7280] hover:text-[#0B1221] dark:text-slate-400 dark:hover:text-white"
          >
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
