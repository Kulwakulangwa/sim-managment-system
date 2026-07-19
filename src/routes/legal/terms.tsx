import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/legal/terms")({
  component: TermsPage,
});

function TermsPage() {
  const { theme } = useTheme();
  return (
    <div className={cn(
      "min-h-screen p-8",
      theme === "dark" ? "bg-[#0f0a12] text-white" : "bg-[#F7F5FA] text-slate-800"
    )}>
      <div className="max-w-3xl mx-auto prose dark:prose-invert">
        <h1>Terms of Service</h1>
        <p><strong>Last updated:</strong> {new Date().toLocaleDateString()}</p>
        <p>Welcome to Duka Phone! By using our service, you agree to the following terms.</p>

        <h2>1. Acceptance of Terms</h2>
        <p>By creating an account and using Duka Phone, you agree to be bound by these Terms of Service.</p>

        <h2>2. Description of Service</h2>
        <p>Duka Phone provides a phone shop management platform that includes inventory, sales, repairs, and reporting tools.</p>

        <h2>3. Account and Subscription</h2>
        <p>You are granted a limited license to use the service for the duration of your subscription. Subscriptions are billed annually and automatically expire unless renewed.</p>

        <h2>4. User Responsibilities</h2>
        <p>You are responsible for all activity under your account and for keeping your login credentials secure.</p>

        <h2>5. Payments and Refunds</h2>
        <p>All payments are non-refundable. We do not offer refunds for unused subscription periods.</p>

        <h2>6. Termination</h2>
        <p>We reserve the right to suspend or terminate your account if you violate these terms or if your subscription expires.</p>

        <h2>7. Disclaimer of Warranties</h2>
        <p>The service is provided "as is" without warranties of any kind.</p>

        <h2>8. Limitation of Liability</h2>
        <p>We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>

        <h2>9. Governing Law</h2>
        <p>These terms are governed by the laws of Tanzania.</p>

        <h2>10. Contact</h2>
        <p>For questions, email us at support@dukaphone.com.</p>
      </div>
    </div>
  );
}
