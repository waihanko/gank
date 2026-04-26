'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/lib/dialog-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminsPage() {
  const router = useRouter();
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
      <div className="page-container" style={{ display: 'flex', minHeight: '70vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-card animate-glow-pulse" style={{ padding: 48, textAlign: 'center', maxWidth: 500, border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🛑</div>
          <h2 className="font-display" style={{ fontSize: 28, fontWeight: 900, color: 'white', marginBottom: 16 }}>Security Restriction</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
            Access to the <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>Admin Management Registry</span> is restricted to Super Administrators only.
          </p>
          <div style={{ padding: '16px 24px', background: 'rgba(239,68,68,0.1)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', display: 'inline-block' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1 }}>
              Insufficient Clearance Level
            </span>
          </div>
        </div>
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
            Control platform access and system security roles
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Close Form' : '+ Create New Admin'}
        </button>
      </div>

      {showCreate && (
        <div className="glass-card animate-fade-in-up" style={{ padding: 32, marginBottom: 32, border: '1px solid var(--accent-primary)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Initialize New Administrator</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Set up credentials for a new team member.</p>
          
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--neon-red)', padding: '12px 16px', borderRadius: 12, fontSize: 14, marginBottom: 24, border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
          
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 20, alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Official Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="name@ghostreferee.com" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Security Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="••••••••" required minLength={6} />
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '14px 32px' }}>Deploy Admin</button>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>🔍 Scanning security registry...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
          {admins.map(admin => (
            <div key={admin.id} className="glass-card animate-glow-pulse" style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
              {/* Card Header */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
                <div style={{ 
                  width: 52, 
                  height: 52, 
                  borderRadius: 16, 
                  background: admin.role === 'SUPER_ADMIN' ? 'linear-gradient(135deg, var(--accent-primary), #6d28d9)' : 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 900,
                  color: 'white',
                  boxShadow: admin.role === 'SUPER_ADMIN' ? '0 8px 20px var(--accent-glow)' : 'none',
                  border: admin.role === 'SUPER_ADMIN' ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-primary)'
                }}>
                  {admin.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{admin.email}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <span style={{ 
                      fontSize: 10, 
                      fontWeight: 800, 
                      padding: '2px 8px', 
                      borderRadius: 6, 
                      background: admin.role === 'SUPER_ADMIN' ? 'rgba(124,58,237,0.15)' : 'rgba(34,197,94,0.15)',
                      color: admin.role === 'SUPER_ADMIN' ? 'var(--accent-primary)' : 'var(--neon-green)',
                      textTransform: 'uppercase'
                    }}>
                      {admin.role.replace('_', ' ')}
                    </span>
                    {admin.id === me.id && (
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>You</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Strip */}
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Status</div>
                  {admin.is_suspended ? (
                    <div style={{ fontSize: 13, color: 'var(--neon-red)', fontWeight: 700 }}>🚫 Suspended</div>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--neon-green)', fontWeight: 700 }}>✅ Operational</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Registered</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{new Date(admin.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Action */}
                <button 
                  className="btn-secondary" 
                  style={{ width: '100%', padding: '12px', fontWeight: 700, fontSize: 14 }}
                  onClick={() => router.push(`/admin/admins/${admin.id}`)}
                >
                  🔒 View Access Details
                </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
