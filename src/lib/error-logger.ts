import { supabase } from "@/integrations/supabase/client";

type Source = "frontend" | "backend" | "db" | "import" | "auth";

let installed = false;

export async function logError(
  source: Source,
  message: string,
  opts?: { stack?: string; url?: string; context?: Record<string, unknown> },
) {
  try {
    const { data } = await supabase.auth.getUser();
    await supabase.from("error_logs").insert({
      source,
      message: message.slice(0, 2000),
      stack: opts?.stack?.slice(0, 8000) ?? null,
      url: opts?.url ?? (typeof window !== "undefined" ? window.location.href : null),
      context: (opts?.context as never) ?? null,
      user_id: data.user?.id ?? null,
    });
  } catch {
    // swallow - never let logging break the app
  }
}

export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    logError("frontend", e.message || "window.error", {
      stack: e.error?.stack,
      url: e.filename,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    logError("frontend", typeof r === "string" ? r : r?.message ?? "unhandledrejection", {
      stack: r?.stack,
    });
  });
}
