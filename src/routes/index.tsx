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
      {/* LEFT PANEL – Minimal with background image */}
      <div className="relative hidden flex-1 flex-col items-center justify-center text-[#F5F7FA] md:flex lg:flex-[1.15]">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=800&auto=format&fit=crop')",
          }}
        />
        {/* Overlay for readability */}
        <div className="absolute inset-0 bg-[#0B1221]/70" />

        {/* Brand – centered */}
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#00C9A7] shadow-lg shadow-[#00C9A7]/30">
            <span className="font-serif text-4xl font-medium text-[#0B1221]">D</span>
          </div>
          <div className="text-center">
            <div className="text-2xl font-medium tracking-wide">Duka Phone</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/60">
              business software for phone shops
            </div>
          </div>
        </div>

        {/* Decorative subtle glow */}
        <div className="absolute bottom-8 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-[#00C9A7]/30" />
      </div>

      {/* RIGHT PANEL – Sign in form */}
      <div className="flex flex-1 flex-col bg-[#F5F7FA] px-6 py-8 md:px-12 md:py-12">
        <div className="ml-auto font-mono text-xs text-[#8b93a3]">
          <span className="font-medium text-[#0B1221]">EN</span> · SW
        </div>

        <div className="mx-auto mt-8 w-full max-w-sm flex-1 md:mt-20">
          <h2 className="font-serif text-2xl font-medium text-[#0B1221] md:text-3xl">Sign in</h2>
          <p className="mt-1 text-sm text-[#6b7280]">Phone Shop Management</p>

          <form onSubmit={handleSignIn} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-[#0B1221]">
                Email
              </label>
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
              <label htmlFor="password" className="block text-xs font-medium text-[#0B1221]">
                Password
              </label>
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
