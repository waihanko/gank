'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/lib/dialog-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Announcement {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  link_url?: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminAnnouncementsPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useDialog();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    image_url: '',
    link_url: '',
    starts_at: '',
    ends_at: '',
    is_active: true,
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    const token = localStorage.getItem('gr_admin_token');
    if (!token) { router.push('/admin/login'); return; }

    try {
      const res = await fetch(`${API_URL}/api/announcements/admin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAnnouncements(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('gr_admin_token');
    if (!token) return;

    // Basic validation
    if (!formData.title || !formData.content || !formData.starts_at || !formData.ends_at) {
      return showAlert('Please fill in all required fields.');
    }

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API_URL}/api/announcements/${editingId}` : `${API_URL}/api/announcements`;

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        showAlert(editingId ? 'Announcement updated!' : 'Announcement created!');
        setShowModal(false);
        resetForm();
        fetchAnnouncements();
      } else {
        showAlert(data.error);
      }
    } catch {
      showAlert('Request failed.');
    }
  };

  const handleDelete = (id: string) => {
    showConfirm('Are you sure you want to delete this announcement?', async () => {
      const token = localStorage.getItem('gr_admin_token');
      try {
        const res = await fetch(`${API_URL}/api/announcements/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          fetchAnnouncements();
        }
      } catch {
        showAlert('Delete failed.');
      }
    });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      image_url: '',
      link_url: '',
      starts_at: '',
      ends_at: '',
      is_active: true,
    });
    setEditingId(null);
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a.id);
    setFormData({
      title: a.title,
      content: a.content,
      image_url: a.image_url || '',
      link_url: a.link_url || '',
      starts_at: new Date(a.starts_at).toISOString().slice(0, 16),
      ends_at: new Date(a.ends_at).toISOString().slice(0, 16),
      is_active: a.is_active,
    });
    setShowModal(true);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading Announcements...</div>;

  return (
    <div style={{ padding: 40, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>📢 Announcement Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Create and manage sequential announcements for users</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          ➕ Add Announcement
        </button>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Period</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {announcements.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No announcements found.</td>
              </tr>
            )}
            {announcements.map((a) => {
              const now = new Date();
              const start = new Date(a.starts_at);
              const end = new Date(a.ends_at);
              const isLive = a.is_active && now >= start && now <= end;

              return (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.title}</td>
                  <td>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: isLive ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                      color: isLive ? 'var(--neon-green)' : 'var(--text-muted)',
                      border: `1px solid ${isLive ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`
                    }}>
                      {isLive ? '🟢 LIVE' : !a.is_active ? '⚪ INACTIVE' : now < start ? '🟡 SCHEDULED' : '🔴 EXPIRED'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {new Date(a.starts_at).toLocaleDateString()} - {new Date(a.ends_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-secondary btn-sm" onClick={() => openEdit(a)}>Edit</button>
                      <button className="btn-danger btn-sm" onClick={() => handleDelete(a.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', padding: 20 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 600, padding: 32, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
            <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>
              {editingId ? 'Edit Announcement' : 'New Announcement'}
            </h2>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Title *</label>
                <input 
                  className="input-field" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  placeholder="Welcome to Season 2!"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Content *</label>
                <textarea 
                  className="input-field" 
                  value={formData.content} 
                  onChange={e => setFormData({...formData, content: e.target.value})} 
                  placeholder="Announcement body text..."
                  style={{ minHeight: 100, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Image URL (Optional)</label>
                  <input 
                    className="input-field" 
                    value={formData.image_url} 
                    onChange={e => setFormData({...formData, image_url: e.target.value})} 
                    placeholder="https://..."
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Action URL (Optional)</label>
                  <input 
                    className="input-field" 
                    value={formData.link_url} 
                    onChange={e => setFormData({...formData, link_url: e.target.value})} 
                    placeholder="/wallet or https://..."
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Starts At *</label>
                  <input 
                    type="datetime-local"
                    className="input-field" 
                    value={formData.starts_at} 
                    onChange={e => setFormData({...formData, starts_at: e.target.value})} 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Ends At *</label>
                  <input 
                    type="datetime-local"
                    className="input-field" 
                    value={formData.ends_at} 
                    onChange={e => setFormData({...formData, ends_at: e.target.value})} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input 
                  type="checkbox" 
                  checked={formData.is_active} 
                  onChange={e => setFormData({...formData, is_active: e.target.checked})}
                  style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)' }}
                />
                <label style={{ fontSize: 14, fontWeight: 600 }}>Is Active (Global Toggle)</label>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editingId ? 'Save Changes' : 'Create Announcement'}</button>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
