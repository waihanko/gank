'use client';

import { useEffect, useRef } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapHeight?: string; // e.g. '70vh', '90vh'
}

export default function BottomSheet({ open, onClose, title, children, snapHeight = '80vh' }: BottomSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-end',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxHeight: snapHeight,
          background: 'var(--bg-secondary)',
          borderRadius: '24px 24px 0 0',
          border: '1px solid rgba(124,58,237,0.2)',
          borderBottom: 'none',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.15)',
          }} />
        </div>

        {/* Header */}
        {title && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 20px 16px',
            borderBottom: '1px solid var(--border-secondary)',
          }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                borderRadius: '50%',
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 16,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
