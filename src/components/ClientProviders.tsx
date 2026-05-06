'use client';

import { AuthProvider } from '@/lib/auth-context';
import { DialogProvider } from '@/lib/dialog-context';
import AnnouncementSystem from './AnnouncementSystem';
import { Suspense } from 'react';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <DialogProvider>
      <AuthProvider>
        <Suspense fallback={null}>
          <AnnouncementSystem />
        </Suspense>
        {children}
      </AuthProvider>
    </DialogProvider>
  );
}
