'use client';

import { AuthProvider } from '@/lib/auth-context';
import { DialogProvider } from '@/lib/dialog-context';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <DialogProvider>
      <AuthProvider>{children}</AuthProvider>
    </DialogProvider>
  );
}
