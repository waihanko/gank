'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { useDialog } from '@/lib/dialog-context';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminGroupsPage() {
  const { showAlert, showConfirm } = useDialog();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New group form
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [chatId, setChatId] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const router = useRouter();

  useEffect(() => {
    fetchGroups();
  }, []);

  async function fetchGroups() {
    setLoading(true);
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/groups`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('gr_admin_token');
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (data.success) setGroups(data.data);
    } catch {}
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, chat_id: chatId, invite_link: inviteLink }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setTitle('');
        setChatId('');
        setInviteLink('');
        fetchGroups();
      } else {
        showAlert(data.error);
      }
    } catch {
      showAlert('Failed to create group');
    }
  }

  async function handleDelete(id: string) {
    showConfirm('Are you sure you want to delete this group?', async () => {
      const token = localStorage.getItem('gr_admin_token');
      try {
        const res = await fetch(`${API_URL}/api/admin/groups/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          showAlert('Group deleted successfully');
          fetchGroups();
        } else {
          showAlert(data.error);
        }
      } catch {
        showAlert('Failed to delete group');
      }
    });
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
            💬 <span className="gradient-text">Telegram Groups</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Manage the list of Telegram battle groups
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Close Form' : '+ New Group'}
        </button>
      </div>

      {showCreate && (
        <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Create New Group</h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Group Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="input-field" required />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chat ID</label>
              <input type="text" value={chatId} onChange={e => setChatId(e.target.value)} className="input-field" required />
            </div>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Invite Link</label>
              <input type="url" value={inviteLink} onChange={e => setInviteLink(e.target.value)} className="input-field" required />
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '12px 24px' }}>Create Group</button>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading groups...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {groups.map((group) => {
            return (
              <div 
                key={group.id} 
                className="glass-card" 
                style={{ 
                  padding: 24, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  height: '100%',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                      }}
                    >
                      💬
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{group.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{group.chat_id}</div>
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ background: 'rgba(99,102,241,0.08)', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Invite Link</div>
                    <a 
                      href={group.invite_link} 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ color: 'var(--neon-yellow)', fontWeight: 600, wordBreak: 'break-all', fontSize: 11, textDecoration: 'none' }}
                    >
                      {group.invite_link}
                    </a>
                  </div>
                  
                  <button 
                    className="btn-secondary" 
                    style={{ width: '100%', padding: '12px', fontWeight: 700, fontSize: 14 }}
                    onClick={() => router.push(`/admin/groups/${group.id}`)}
                  >
                    ⚙️ View Group Details
                  </button>
                </div>
              </div>
            );
          })}
          {groups.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', gridColumn: '1 / -1' }}>No groups configured</div>
          )}
        </div>
      )}
    </div>
  );
}
