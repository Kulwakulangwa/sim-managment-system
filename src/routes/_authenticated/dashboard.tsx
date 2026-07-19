import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/hooks/use-role";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { theme } = useTheme();
  const { data: myRole, error: roleError, isLoading: roleLoading } = useMyRole();

  console.log("[Dashboard DEBUG] myRole:", myRole);
  console.log("[Dashboard DEBUG] roleError:", roleError);
  console.log("[Dashboard DEBUG] roleLoading:", roleLoading);

  // Simple test query
  const { data: testData, error: testError, isLoading: testLoading } = useQuery({
    queryKey: ["test-query"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shops").select("count").limit(1);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className={cn(
      "p-6 min-h-screen",
      theme === "dark" ? "bg-[#0f0a12] text-white" : "bg-[#F7F5FA] text-slate-800"
    )}>
      <h1 className="text-2xl font-bold">Dashboard (Debug)</h1>
      <div className="mt-4 space-y-2">
        <p><strong>Role:</strong> {myRole?.role || "none"}</p>
        <p><strong>IsSuper:</strong> {myRole?.isSuperAdmin ? "true" : "false"}</p>
        <p><strong>Role Error:</strong> {roleError?.message || "none"}</p>
        <p><strong>Test Query Loading:</strong> {testLoading ? "Loading..." : "Done"}</p>
        <p><strong>Test Query Data:</strong> {testData ? JSON.stringify(testData) : "none"}</p>
        <p><strong>Test Query Error:</strong> {testError?.message || "none"}</p>
      </div>
    </div>
  );
}
