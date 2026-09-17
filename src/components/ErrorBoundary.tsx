import React, { type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI — if not provided, a default error card is shown. */
  fallback?: ReactNode;
  /** Optional label for logging/debugging which boundary caught the error. */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Reusable React Error Boundary.
 *
 * Catches rendering errors in its child tree and displays a fallback UI
 * instead of letting the error crash the entire page.
 *
 * Usage:
 *   <ErrorBoundary label="Leaderboard Stats">
 *     <StatsSection />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ""}]`,
      error,
      errorInfo,
    );
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
          <h3 className="text-sm font-bold text-foreground">
            Something went wrong
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={this.handleReset}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary hover:text-primary transition-all cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" /> Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
