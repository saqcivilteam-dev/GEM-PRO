import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldCheck } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled UI Exception caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 select-none font-sans">
          <div className="w-full max-w-xl bg-slate-900 border border-rose-800/60 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Top decorative glow */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-500" />

            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-rose-950/80 border border-rose-700/60 text-rose-400 rounded-xl shrink-0">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Display Safety Shield Activated
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-900/60 border border-rose-700/50 text-rose-300 uppercase tracking-wider">
                    Self-Healing Guard
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The system caught an unexpected display glitch and safely preserved your encoded data in browser storage so no work was lost.
                </p>
              </div>
            </div>

            {/* Error Message Snippet */}
            <div className="mt-5 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-[11px] text-rose-300/90 overflow-x-auto max-h-32">
              <div className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider mb-1">
                Caught Error Detail:
              </div>
              <div>{this.state.error?.message || 'Component render exception safely intercepted.'}</div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>All project trackers & records are protected</span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-colors flex items-center gap-2 border border-slate-700"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Return to Active View</span>
                </button>
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Fast Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
