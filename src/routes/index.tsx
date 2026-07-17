// src/routes/index.tsx
import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
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

    navigate({ to: '/dashboard' });
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* LEFT PANEL – Dark with brand, hero, IMEI, stats */}
      <div className="relative flex flex-1 flex-col bg-[#0B1221] px-8 py-12 text-[#F5F7FA] md:px-16 md:py-14 lg:flex-[1.15]">
        {/* Background image overlay – replace with a real image if you have one */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B1221]/50 via-[#0B1221]/70 to-[#0B1221]" />
          <div className="h-full w-full bg-[url('https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=800&auto=format&fit=crop')] bg-cover bg-center" />
        </div>

        <div className="relative z-10 flex flex-1 flex-col">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00C9A7] font-mono text-sm font-medium text-[#0B1221]">
              D
            </div>
            <div>
              <div className="text-sm font-medium tracking-wide">Duka Phone</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                business software for phone shops
              </div>
            </div>
          </div>

          {/* Hero */}
          <div className="mt-12 max-w-sm md:mt-16">
            <h1 className="font-serif text-3xl font-light leading-tight md:text-4xl lg:text-5xl">
              Every phone,<br />every repair,<br />
              <em className="not-italic font-medium text-[#00C9A7]">fully accounted for.</em>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/55 md:text-base">
              Inventory, IMEI verification, repairs, warranties and debtors — run your shop from records you can trust.
            </p>
          </div>

          {/* IMEI Card */}
          <div className="mt-auto pt-12">
            <div className="inline-flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <div className="h-2 w-2 rounded-full bg-[#00C9A7] shadow-[0_0_0_0_rgba(0,201,167,0.5)] animate-pulse" />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">IMEI checked just now</div>
                <div className="mt-1 flex items-center gap-2 font-mono text-sm">
                  354983 021847
                  <span className="rounded bg-[#00C9A7] px-2 py-0.5 text-[10px] font-medium text-[#0B1221]">
                    Verified
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-8 flex gap-8 border-t border-white/10 pt-6">
            <div>
              <div className="font-mono text-lg font-medium">10,000+</div>
              <div className="text-xs uppercase tracking-wider text-white/40">devices managed</div>
            </div>
            <div>
              <div className="font-mono text-lg font-medium">500+</div>
              <div className="text-xs uppercase tracking-wider text-white/40">repairs processed</div>
            </div>
            <div>
              <div className="font-mono text-lg font-medium">99.9%</div>
              <div className="text-xs uppercase tracking-wider text-white/40">data accuracy</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL – Sign in form */}
      <div className="flex flex-1 flex-col bg-[#F5F7FA] px-6 py-8 md:px-12 md:py-12">
        <div className="ml-auto font-mono text-xs text-[#8b93a3]">
          <span className="font-medium text-[#0B1221]">EN</span> · SW
        </div>

        <div className="mx-auto mt-8 w-full max-w-sm flex-1 md:mt-16">
          <h2 className="font-serif text-2xl font-medium text-[#0B1221] md:text-3xl">Sign in</h2>
          <p className="mt-1 text-sm text-[#6b7280]">Phone Shop Management</p>

          <form onSubmit={handleSignIn} className="mt-6 space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-[#0B1221]">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe2e8] bg-white px-3 text-sm text-[#0B1221] outline-none transition focus:border-[#00C9A7] focus:shadow-[0_0_0_3px_rgba(0,201,167,0.15)]"
                placeholder="name@yourshop.co.tz"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-[#0B1221]">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe2e8] bg-white px-3 text-sm text-[#0B1221] outline-none transition focus:border-[#00C9A7] focus:shadow-[0_0_0_3px_rgba(0,201,167,0.15)]"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-lg bg-[#0B1221] text-sm font-medium text-[#F5F7FA] transition hover:bg-[#16202f] disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <a href="#" className="mt-4 block text-center text-sm text-[#6b7280] hover:text-[#0B1221]">
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  );
}
