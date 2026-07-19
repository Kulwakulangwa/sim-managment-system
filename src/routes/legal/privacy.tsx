import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/legal/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const { theme } = useTheme();
  return (
    <div className={cn(
      "min-h-screen p-8",
      theme === "dark" ? "bg-[#0f0a12] text-white" : "bg-[#F7F5FA] text-slate-800"
    )}>
      <div className="max-w-3xl mx-auto prose dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p><strong>Last updated:</strong> {new Date().toLocaleDateString()}</p>
        <p>Duka Phone respects your privacy. This policy explains how we collect, use, and protect your personal data.</p>

        <h2>1. Information We Collect</h2>
        <ul>
          <li>Account details (name, email, phone).</li>
          <li>Business data (products, sales, customers, repairs).</li>
          <li>Payment information (processed by third-party payment providers, not stored by us).</li>
        </ul>

        <h2>2. How We Use Your Data</h2>
        <ul>
          <li>To provide and improve the service.</li>
          <li>To send administrative emails (e.g., expiry reminders, invoices).</li>
          <li>To comply with legal obligations.</li>
        </ul>

        <h2>3. Data Sharing</h2>
        <p>We do not sell your data. We may share data with service providers (e.g., payment processors) only to the extent necessary to provide the service.</p>

        <h2>4. Data Security</h2>
        <p>We implement industry-standard security measures to protect your data, but no system is completely secure.</p>

        <h2>5. Your Rights</h2>
        <p>You have the right to access, correct, or delete your data. Contact us to exercise these rights.</p>

        <h2>6. Cookies</h2>
        <p>We use essential cookies for authentication and session management.</p>

        <h2>7. Changes</h2>
        <p>We may update this policy occasionally. We will notify you of significant changes.</p>

        <h2>8. Contact</h2>
        <p>Email: privacy@dukaphone.com</p>
      </div>
    </div>
  );
}
