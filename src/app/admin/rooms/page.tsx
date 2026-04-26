'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { useDialog } from '@/lib/dialog-context';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const ROOM_STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  AVAILABLE: { color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)', label: '✅ Available' },
  OCCUPIED: { color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)', label: '🔴 Occupied' },
  PAUSED: { color: '#eab308', bgColor: 'rgba(234,179,8,0.15)', label: '⏸️ Paused' },
  CLEANING: { color: '#6366f1', bgColor: 'rgba(99,102,241,0.15)', label: '🧹 Cleaning' },
  DISABLED: { color: '#6b7280', bgColor: 'rgba(107,114,128,0.15)', label: '⛔ Disabled' },
};

export default function AdminRoomsPage() {
  const { showAlert, showConfirm } = useDialog();
  const [rooms, setRooms] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  // New room form
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [chatId, setChatId] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const router = useRouter();

  useEffect(() => {
    fetchRooms();
  }, [filter]);



  async function fetchRooms() {
    setLoading(true);
    const token = localStorage.getItem('gr_admin_token');
    try {
      const url = filter === 'All' ? `${API_URL}/api/admin/rooms` : `${API_URL}/api/admin/rooms?status=${filter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('gr_admin_token');
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (data.success) setRooms(data.data);
    } catch {}
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/rooms`, {
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
        fetchRooms();
      } else {
        showAlert(data.error);
      }
    } catch {
      showAlert('Failed to create room');
    }
  }

  async function handleTogglePause(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'AVAILABLE' ? 'PAUSED' : 'AVAILABLE';
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/rooms/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) fetchRooms();
      else showAlert(data.error);
    } catch {
      showAlert('Failed to update status');
    }
  }

  const availableCount = rooms.filter(r => r.status === 'AVAILABLE').length;
  const occupiedCount = rooms.filter(r => r.status === 'OCCUPIED').length;
  const pausedCount = rooms.filter(r => r.status === 'PAUSED').length;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
            💬 <span className="gradient-text">Room Pool Management</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Monitor and manage Telegram battle rooms
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Close Form' : '+ New Room'}
        </button>
      </div>

      {showCreate && (
        <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Create New Room</h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Room Title</label>
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
            <button type="submit" className="btn-primary" style={{ padding: '12px 24px' }}>Create Room</button>
          </form>
        </div>
      )}

      {/* Summary Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Total Rooms</div>
          <div className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>{rooms.length}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Available</div>
          <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--neon-green)' }}>{availableCount}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Occupied</div>
          <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--neon-red)' }}>{occupiedCount}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Paused</div>
          <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--neon-yellow)' }}>{pausedCount}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['All', 'AVAILABLE', 'OCCUPIED', 'PAUSED'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: filter === tab ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
              border: 'none', color: filter === tab ? 'white' : 'var(--text-muted)', cursor: 'pointer'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div>Loading rooms...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {rooms.map((room) => {
            const config = ROOM_STATUS_CONFIG[room.status] || ROOM_STATUS_CONFIG.DISABLED;
            return (
              <div 
                key={room.id} 
                className="glass-card" 
                style={{ 
                  padding: 24, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onClick={() => router.push(`/admin/rooms/${room.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.boxShadow = '0 12px 40px var(--accent-glow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: room.status === 'AVAILABLE' 
                          ? 'linear-gradient(135deg, var(--neon-green), #22c55e)'
                          : room.status === 'OCCUPIED'
                          ? 'linear-gradient(135deg, var(--neon-red), #ef4444)'
                          : room.status === 'PAUSED'
                          ? 'linear-gradient(135deg, var(--neon-yellow), #eab308)'
                          : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                      }}
                    >
                      {room.status === 'AVAILABLE' ? '💬' : room.status === 'OCCUPIED' ? '⚔️' : room.status === 'PAUSED' ? '⏸️' : '🔒'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{room.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{room.chat_id}</div>
                    </div>
                  </div>
                  <span style={{ background: config.bgColor, color: config.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    {config.label}
                  </span>
                </div>

                <div style={{ flex: 1 }}>
                  {room.status === 'OCCUPIED' && room.current_match_id && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: 10, marginBottom: 12, border: '1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ fontSize: 10, color: 'var(--neon-red)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>Current Match</div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600 }}>#{room.current_match_id.slice(-8)}</div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Hosted Matches</span>
                    <span style={{ fontWeight: 700, color: 'var(--neon-cyan)' }}>{room.total_matches_hosted || 0}</span>
                  </div>
                  <div style={{ background: 'rgba(99,102,241,0.08)', padding: 10, borderRadius: 8, marginBottom: 0, fontSize: 12 }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Invite Link</div>
                    <div style={{ color: 'var(--accent-primary)', fontWeight: 600, wordBreak: 'break-all', fontSize: 11 }}>
                      {room.invite_link}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
