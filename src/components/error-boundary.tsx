import { Component, type ReactNode } from "react";
import { logError } from "@/lib/error-logger";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    logError("frontend", error.message, {
      stack: error.stack,
      context: { componentStack: info.componentStack ?? undefined, boundary: "react_error_boundary" },
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-lg border border-border bg-card p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="mt-2 text-sm text-muted-foreground break-words">{this.state.error.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            This error was logged automatically. You can safely try again.
          </p>
          <div className="mt-4 flex gap-2 justify-center">
            <Button onClick={this.reset}>Try again</Button>
            <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>Go home</Button>
          </div>
        </div>
      </div>
    );
  }
}
