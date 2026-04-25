'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminProfilePage() {
  const [admin, setAdmin] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('gr_admin_user');
      if (userStr) setAdmin(JSON.parse(userStr));
    } catch {}
  }, []);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');
    
    if (!password || !newPassword) {
      setError('Please fill in both password fields');
      return;
    }

    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/profile/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword: password, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Password updated successfully');
        setPassword('');
        setNewPassword('');
      } else {
        setError(data.error || 'Failed to update password');
      }
    } catch {
      setError('Network error');
    }
  }

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
        </div>
      </div>

      <div className="glass-card" style={{ padding: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Change Password</h3>
        
        {message && <div style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--neon-green)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{message}</div>}
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--neon-red)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>}

        <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Current Password</label>
            <input 
              type="password" 
              className="input-field" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>New Password</label>
            <input 
              type="password" 
              className="input-field" 
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>Update Password</button>
        </form>
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
        <button 
          className="btn-danger" 
          style={{ width: '100%', padding: '14px', fontSize: 15, justifyContent: 'center' }} 
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
