import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          retry: this.handleRetry,
        });
      }

      return (
        <div
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            minHeight: '280px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 24px',
            textAlign: 'center',
            background: 'var(--bg-primary)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <AlertTriangle size={28} color="#ef4444" />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 8px 0' }}>
            {this.props.title || 'Something went wrong'}
          </h3>

          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.88rem',
              maxWidth: '420px',
              margin: '0 0 20px 0',
              lineHeight: 1.5,
            }}
          >
            {this.state.error?.message || 'An unexpected interface issue occurred. You can retry safely.'}
          </p>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={this.handleRetry}
              className="btn-primary"
              style={{ fontSize: '0.88rem', padding: '10px 18px' }}
            >
              <RefreshCw size={16} /> Try Again
            </button>
            {this.props.onHome && (
              <button
                type="button"
                onClick={this.props.onHome}
                className="btn-secondary"
                style={{ fontSize: '0.88rem', padding: '10px 18px' }}
              >
                <Home size={16} /> Back to Home
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
