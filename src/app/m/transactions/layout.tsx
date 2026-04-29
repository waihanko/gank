import type { Metadata } from 'next';
import MobileBottomNav from '@/components/mobile/BottomNav';

export const metadata: Metadata = {
  title: 'Transaction History — Good Game',
};

/**
 * Transactions gets its own layout so it can render its own custom toolbar
 * instead of the shared MobileTopBar. BottomNav is still included.
 */
export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Ambient background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'var(--bg-primary)', pointerEvents: 'none',
      }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(124,58,237,0.12), transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '15%', left: '-10%', width: 250, height: 250, background: 'radial-gradient(circle, rgba(6,182,212,0.08), transparent 70%)', borderRadius: '50%' }} />
      </div>

      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 480, margin: '0 auto',
        height: '100dvh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* ① Page content (includes its own toolbar) — scrollable */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
          WebkitOverflowScrolling: 'touch' as any,
        }}>
          {children}
        </main>

        {/* ② Bottom nav */}
        <MobileBottomNav />
      </div>
    </>
  );
}
