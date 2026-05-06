'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface DialogContextType {
  showAlert: (message: string) => void;
  showConfirm: (message: string, onConfirm: () => void, options?: { title?: string; titleColor?: string; icon?: string }) => void;
}

const DialogContext = createContext<DialogContextType>({
  showAlert: () => {},
  showConfirm: () => {},
});

export function DialogProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [confirmState, setConfirmState] = useState<{ show: boolean; message: string; onConfirm: () => void; title: string; titleColor: string; icon: string }>({ 
    show: false, message: '', onConfirm: () => {}, title: 'Confirmation', titleColor: 'var(--text-primary)', icon: '❓' 
  });

  return (
    <DialogContext.Provider value={{
      showAlert: (msg) => setAlertState({ show: true, message: msg }),
      showConfirm: (msg, onConfirm, options) => setConfirmState({ 
        show: true, message: msg, onConfirm, 
        title: options?.title || 'Confirmation', 
        titleColor: options?.titleColor || 'var(--text-primary)',
        icon: options?.icon || '❓'
      })
    }}>
      {children}
      
      {/* Alert Modal */}
      {alertState.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 24, backdropFilter: 'blur(12px)'
        }}>
          <div className="animate-scale-up" style={{ 
            padding: 24, width: '100%', maxWidth: 400, 
            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 20,
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
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
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 24, backdropFilter: 'blur(12px)'
        }}>
          <div className="animate-scale-up" style={{ 
            padding: 24, width: '100%', maxWidth: 400,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 20,
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 16 }}>{confirmState.icon}</div>
            <h3 style={{ marginTop: 0, fontSize: 24, fontWeight: 800, color: confirmState.titleColor, textAlign: 'center', marginBottom: 8, textTransform: 'uppercase' }}>{confirmState.title}</h3>
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
