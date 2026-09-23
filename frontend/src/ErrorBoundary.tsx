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
        <div style={{ padding: '40px', background: '#ffffff', color: '#0f172a', minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#0f172a' }}>Something went wrong.</h1>
          <p style={{ color: '#475569', marginBottom: '16px' }}>We encountered an unexpected error. Please try reloading the page.</p>
          {this.state.error && (
            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', fontSize: '12px', maxWidth: '700px', overflowX: 'auto', marginBottom: '24px', textAlign: 'left', fontFamily: 'monospace' }}>
              <strong>Error Details:</strong> {String(this.state.error?.message || this.state.error)}
            </div>
          )}
          <button 
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
