'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminProfilePage() {
  const [admin, setAdmin] = useState<any>(null);
  
  useEffect(() => {
    try {
      const userStr = localStorage.getItem('gr_admin_user');
      if (userStr) setAdmin(JSON.parse(userStr));
    } catch {}
  }, []);

  if (!admin) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;

  return (
    <div className="page-container" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
          🛡️ <span className="gradient-text">Admin Profile</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Manage your administrator account
        </p>
      </div>

      <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Account Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-secondary)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Email</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{admin.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-secondary)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Role</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: admin.role === 'SUPER_ADMIN' ? 'var(--neon-yellow)' : 'var(--neon-green)' }}>
              {admin.role}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-secondary)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Created At</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
        <button 
          className="btn-danger" 
          style={{ width: '100%', padding: '14px', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} 
          onClick={() => {
            localStorage.removeItem('gr_admin_token');
            localStorage.removeItem('gr_admin_user');
            window.location.href = '/admin/login';
          }}
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
}
