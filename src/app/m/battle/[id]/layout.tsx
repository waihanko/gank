import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Battle Room — Good Game',
};

export default function BattleRoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'relative', zIndex: 1,
      maxWidth: 480, margin: '0 auto',
      height: '100dvh',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-primary)',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}
