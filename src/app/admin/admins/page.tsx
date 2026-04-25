'use client';

import { useEffect, useState } from 'react';
import { useDialog } from '@/lib/dialog-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminsPage() {
  const { showAlert, showConfirm } = useDialog();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    let isAdminRole = false;
    try {
      const userStr = localStorage.getItem('gr_admin_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        setMe(u);
        isAdminRole = u.role === 'SUPER_ADMIN';
      }
    } catch {}
    if (isAdminRole) {
      fetchAdmins();
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchAdmins() {
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/admins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setAdmins(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/admins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setEmail('');
        setPassword('');
        fetchAdmins();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Network error');
    }
  }

  async function handleDelete(id: string) {
    showConfirm('Are you sure you want to delete this admin?', async () => {
      const token = localStorage.getItem('gr_admin_token');
      try {
        const res = await fetch(`${API_URL}/api/admin/admins/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) fetchAdmins();
        else showAlert(data.error);
      } catch {
        showAlert('Failed to delete');
      }
    });
  }

  if (me?.role !== 'SUPER_ADMIN') {
    return (
      <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ color: 'var(--neon-red)' }}>Access Denied: Super Admin Only</h2>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
            🛡️ <span className="gradient-text">Admin Management</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Control platform access and super admin privileges
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Close Form' : '+ New Admin'}
        </button>
      </div>

      {showCreate && (
        <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Create New Admin</h2>
          {error && <div style={{ color: 'var(--neon-red)', fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" required />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" required minLength={6} />
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '12px 24px' }}>Create Admin</button>
          </form>
        </div>
      )}

      {loading ? (
        <div>Loading admins...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {admins.map(admin => (
            <div key={admin.id} className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{admin.email}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>Role: {admin.role}</div>
                </div>
                {admin.role === 'SUPER_ADMIN' ? (
                  <span style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    ⭐ SUPER
                  </span>
                ) : (
                  <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    ✅ NORMAL
                  </span>
                )}
              </div>

              {admin.id !== me.id && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-danger btn-sm" style={{ flex: 1 }} onClick={() => handleDelete(admin.id)}>
                    🗑️ Delete Admin
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
