'use client';

import { useEffect, useState, use } from 'react';
import { useDialog } from '@/lib/dialog-context';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showAlert, showConfirm } = useDialog();

  const [admin, setAdmin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [me, setMe] = useState<any>(null);

  // Edit form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [isSuspended, setIsSuspended] = useState(false);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('gr_admin_user');
      if (userStr) setMe(JSON.parse(userStr));
    } catch {}
    fetchAdmin();
  }, [id]);

  async function fetchAdmin() {
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/admins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const found = data.data.find((a: any) => a.id === id);
        if (found) {
          setAdmin(found);
          setEmail(found.email);
          setRole(found.role);
          setIsSuspended(found.is_suspended || false);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/admins/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          email, 
          role, 
          password: password || undefined,
          is_suspended: isSuspended 
        })
      });
      const data = await res.json();
      if (data.success) {
        showAlert('Admin updated successfully');
        setIsEditing(false);
        fetchAdmin();
      } else {
        showAlert(data.error);
      }
    } catch {
      showAlert('Network error');
    }
  }

  async function handleDelete() {
    showConfirm('CRITICAL ACTION: Are you sure you want to PERMANENTLY delete this administrator? This cannot be undone.', async () => {
      const token = localStorage.getItem('gr_admin_token');
      try {
        const res = await fetch(`${API_URL}/api/admin/admins/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          showAlert('Administrator removed from system.');
          router.push('/admin/admins');
        } else {
          showAlert(data.error);
        }
      } catch {
        showAlert('Failed to delete');
      }
    });
  }

  if (loading) return <div className="page-container">Loading security clearance...</div>;
  if (!admin) return <div className="page-container">Administrator record not found.</div>;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button 
            onClick={() => router.push('/admin/admins')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ← Back to Registry
          </button>
          <h1 className="font-display" style={{ fontSize: 32, fontWeight: 900 }}>
            <span className="gradient-text">Admin Profile</span>
          </h1>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>UUID: {admin.id}</div>
        </div>
        
        {me?.role === 'SUPER_ADMIN' && admin.id !== me.id && (
          <button className="btn-danger" style={{ padding: '12px 24px' }} onClick={handleDelete}>
            Terminate Access
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 32 }}>
        {/* Profile Card */}
        <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ 
            width: 100, 
            height: 100, 
            borderRadius: 32, 
            background: admin.role === 'SUPER_ADMIN' ? 'linear-gradient(135deg, var(--accent-primary), #6d28d9)' : 'var(--bg-tertiary)',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 42,
            fontWeight: 900,
            color: 'white',
            boxShadow: admin.role === 'SUPER_ADMIN' ? '0 12px 30px var(--accent-glow)' : 'none'
          }}>
            {admin.email.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{admin.email}</h2>
          <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 24 }}>
            {admin.role.replace('_', ' ')}
          </div>

          <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 24, textAlign: 'left' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>System Status</div>
              {admin.is_suspended ? (
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--neon-red)' }}>● SUSPENDED / INACTIVE</div>
              ) : (
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--neon-green)' }}>● ACTIVE / OPERATIONAL</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Date of Commission</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{new Date(admin.created_at).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="glass-card" style={{ padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800 }}>Manage Credentials</h3>
            {!isEditing && (
              <button className="btn-secondary btn-sm" onClick={() => setIsEditing(true)}>Edit Details</button>
            )}
          </div>

          <form onSubmit={handleUpdate}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>Login Email</label>
              <input 
                type="email" 
                className="input-field" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                disabled={!isEditing} 
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>Security Role</label>
              <select 
                className="input-field" 
                value={role} 
                onChange={e => setRole(e.target.value)} 
                disabled={!isEditing}
              >
                <option value="NORMAL_ADMIN">Normal Administrator</option>
                <option value="SUPER_ADMIN">Super Administrator</option>
              </select>
            </div>

            {isEditing && (
              <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.05)', padding: '16px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.1)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--neon-red)' }}>Suspend Account</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Immediately block all platform access.</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={isSuspended} 
                  onChange={e => setIsSuspended(e.target.checked)}
                  style={{ width: 24, height: 24, cursor: 'pointer' }}
                />
              </div>
            )}

            {isEditing && (
              <div style={{ marginBottom: 32 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>Reset Password (Optional)</label>
                <input 
                  type="password" 
                  className="input-field" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="Enter new password to reset"
                  minLength={6}
                />
              </div>
            )}

            {isEditing && (
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save Changes</button>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsEditing(false)}>Cancel</button>
              </div>
            )}
          </form>

          {!isEditing && (
            <div style={{ padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px dashed var(--border-primary)', marginTop: 24 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                💡 Click "Edit Details" to update this administrator's platform permissions or reset their security credentials.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
