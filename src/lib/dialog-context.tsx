'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface DialogContextType {
  showAlert: (message: string) => void;
  showConfirm: (message: string, onConfirm: () => void) => void;
}

const DialogContext = createContext<DialogContextType>({
  showAlert: () => {},
  showConfirm: () => {},
});

export function DialogProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [confirmState, setConfirmState] = useState<{ show: boolean; message: string; onConfirm: () => void }>({ show: false, message: '', onConfirm: () => {} });

  return (
    <DialogContext.Provider value={{
      showAlert: (msg) => setAlertState({ show: true, message: msg }),
      showConfirm: (msg, onConfirm) => setConfirmState({ show: true, message: msg, onConfirm })
    }}>
      {children}
      
      {/* Alert Modal */}
      {alertState.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 24, backdropFilter: 'blur(10px)'
        }}>
          <div className="glass-card animate-scale-up" style={{ padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 16 }}>👻</div>
            <h3 style={{ marginTop: 0, fontSize: 18, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 8 }}>Notice</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5, textAlign: 'center', marginBottom: 24 }}>{alertState.message}</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button className="btn-primary" style={{ minWidth: 120 }} onClick={() => setAlertState({ show: false, message: '' })}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmState.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 24, backdropFilter: 'blur(10px)'
        }}>
          <div className="glass-card animate-scale-up" style={{ padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 16 }}>❓</div>
            <h3 style={{ marginTop: 0, fontSize: 18, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 8 }}>Confirmation</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5, textAlign: 'center', marginBottom: 24 }}>{confirmState.message}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmState({ ...confirmState, show: false })}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => {
                setConfirmState({ ...confirmState, show: false });
                confirmState.onConfirm();
              }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  return useContext(DialogContext);
}
