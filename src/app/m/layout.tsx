import type { Metadata } from 'next';
import MobileBottomNav from '@/components/mobile/BottomNav';
import MobileTopBar from '@/components/mobile/TopBar';

export const metadata: Metadata = {
  title: 'Good Game — Mobile',
  description: 'Automated MLBB Escrow & Battle Management',
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Ambient background — fixed, sits behind everything */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: 'var(--bg-primary)',
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: 300,
          height: 300,
          background: 'radial-gradient(circle, rgba(124,58,237,0.12), transparent 70%)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '15%',
          left: '-10%',
          width: 250,
          height: 250,
          background: 'radial-gradient(circle, rgba(6,182,212,0.08), transparent 70%)',
          borderRadius: '50%',
        }} />
      </div>

      {/* Mobile shell: full viewport height, flex column, no overflow */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: 480,
        margin: '0 auto',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* ① Top bar — locked, never scrolls */}
        <MobileTopBar />

        {/* ② Scrollable content — only this area scrolls */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          WebkitOverflowScrolling: 'touch' as any,
          position: 'relative',
        }}>
          {children}
          {/* Explicit spacer to ensure content scrolls above the bottom nav */}
          <div id="mobile-bottom-spacer" style={{ height: 100, flexShrink: 0 }} />
        </main>

        {/* ③ Bottom nav — position:fixed, always visible */}
        <MobileBottomNav />
      </div>
    </>
  );
}



