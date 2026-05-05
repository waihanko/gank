'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get('message') || 'An unexpected connection error occurred while communicating with the central server.';

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '80vh',
      textAlign: 'center',
      padding: '0 24px'
    }}>
      <div className="glass-card animate-glow-pulse" style={{ 
        padding: '48px 32px', 
        maxWidth: 500, 
        border: '1px solid rgba(239, 68, 68, 0.2)',
        background: 'rgba(10, 10, 15, 0.8)'
      }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🛰️</div>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, marginBottom: 16 }}>Connection Interrupted</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
          {message}
        </p>
        
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          <button 
            className="btn-primary" 
            onClick={() => window.location.reload()}
            style={{ padding: '12px 32px' }}
          >
            Retry Connection
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => router.push('/admin')}
            style={{ padding: '12px 32px' }}
          >
            Dashboard
          </button>
        </div>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
            Technical Details: SEC_CONN_FAILURE
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminErrorPage() {
  return (
    <Suspense fallback={<div className="page-container">Loading error handler...</div>}>
      <ErrorContent />
    </Suspense>
  );
}
