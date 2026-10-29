import React from 'react';

export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 sm:p-12 bg-white dark:bg-navy-950 text-slate-900 dark:text-slate-100 min-h-[80vh] flex flex-col items-center justify-center text-center transition-colors">
          <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Something went wrong.</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">We encountered an unexpected error. Please try reloading the page.</p>
          {this.state.error && (
            <div className="p-3.5 sm:p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 rounded-xl text-xs max-w-2xl overflow-x-auto mb-6 text-left font-mono w-full shadow-xs">
              <strong>Error Details:</strong> {String(this.state.error?.message || this.state.error)}
            </div>
          )}
          <button 
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
