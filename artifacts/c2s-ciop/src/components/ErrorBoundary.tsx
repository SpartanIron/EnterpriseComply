import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary.
 *
 * Without this, a single render-time exception unmounts the entire SPA and
 * leaves a blank white page with no route back except a manual reload. That is
 * exactly what happened on the Users & Roles screen, where an undefined member
 * initial reached .toUpperCase(). Enterprise evaluators read a white screen as
 * "the product crashed", so failures must stay contained and recoverable.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Console keeps the stack available for support. This is also the hook to
    // wire a real error-tracking service (Sentry or equivalent) into.
    console.error(
      "[EnterpriseComply] Unhandled UI error:",
      error,
      info.componentStack,
    );
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            This screen failed to render. Your data has not been changed and the
            rest of the application is unaffected.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Try again
            </button>
            <a
              href="/dashboard"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
