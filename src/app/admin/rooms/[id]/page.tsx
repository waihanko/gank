'use client';

import { useEffect, useState, use } from 'react';
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

export default function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showAlert, showConfirm } = useDialog();
  
  const [room, setRoom] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Edit room form
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editChatId, setEditChatId] = useState('');
  const [editInviteLink, setEditInviteLink] = useState('');

  useEffect(() => {
    fetchRoom();
    fetchMatches();
  }, [id]);

  async function fetchRoom() {
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/rooms/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        const found = data.data;
        setRoom(found);
        setEditTitle(found.title);
        setEditChatId(found.chat_id);
        setEditInviteLink(found.invite_link);
      }
    } catch {}
    setLoading(false);
  }

  async function fetchMatches() {
    setLoadingMatches(true);
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/rooms/${id}/matches`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setMatches(data.data);
    } catch {}
    setLoadingMatches(false);
  }

  async function handleTogglePause() {
    const newStatus = room.status === 'AVAILABLE' ? 'PAUSED' : 'AVAILABLE';
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/rooms/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) setRoom({ ...room, status: newStatus });
      else showAlert(data.error);
    } catch {
      showAlert('Failed to update status');
    }
  }

  async function handleEditSave() {
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/rooms/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: editTitle, chat_id: editChatId, invite_link: editInviteLink }),
      });
      const data = await res.json();
      if (data.success) {
        setRoom({ ...room, title: editTitle, chat_id: editChatId, invite_link: editInviteLink });
        setShowEdit(false);
        showAlert('Room updated successfully');
      } else {
        showAlert(data.error);
      }
    } catch {
      showAlert('Failed to update room');
    }
  }

  async function handleDelete() {
    showConfirm(`Are you sure you want to delete this room? This action cannot be undone.`, async () => {
      const token = localStorage.getItem('gr_admin_token');
      try {
        const res = await fetch(`${API_URL}/api/admin/rooms/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          router.push('/admin/rooms');
        } else {
          showAlert(data.error);
        }
      } catch {
        showAlert('Failed to delete room');
      }
    });
  }

  if (loading) return <div className="page-container">Loading...</div>;
  if (!room) return <div className="page-container">Room not found</div>;

  return (
    <div className="page-container">
      <button 
        className="btn-secondary btn-sm" 
        style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}
        onClick={() => router.push('/admin/rooms')}
      >
        ← Back to Room List
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Room Info Section */}
        <div className="glass-card animate-fade-in" style={{ padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                }}
              >
                💬
              </div>
              <div>
                <h1 className="font-display" style={{ fontSize: 24, fontWeight: 800 }}>{room.title}</h1>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, fontFamily: 'monospace' }}>{room.chat_id}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                className={room.status === 'PAUSED' ? "btn-success" : "btn-secondary"} 
                onClick={handleTogglePause}
                style={{ minWidth: 120 }}
              >
                {room.status === 'PAUSED' ? '▶️ Unpause' : '⏸️ Pause'}
              </button>
              <button className="btn-primary" onClick={() => setShowEdit(true)}>✏️ Edit Room</button>
              {room.status !== 'OCCUPIED' && (
                <button className="btn-danger" onClick={handleDelete}>🗑️ Delete</button>
              )}
            </div>
          </div>

          {/* Premium Stats Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
            gap: 20, 
            paddingTop: 32, 
            borderTop: '1px solid rgba(255,255,255,0.08)' 
          }}>
            {/* Status Card */}
            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: 20, 
              padding: 24, 
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Status</span>
                <div style={{ 
                  width: 32, height: 32, borderRadius: 10, background: ROOM_STATUS_CONFIG[room.status]?.bgColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
                }}>
                  {room.status === 'AVAILABLE' ? '🟢' : room.status === 'OCCUPIED' ? '⚔️' : '⏸️'}
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: ROOM_STATUS_CONFIG[room.status]?.color }}>
                {ROOM_STATUS_CONFIG[room.status]?.label.split(' ')[1]}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Room is ready for matching</div>
            </div>

            {/* Lifetime Usage Card */}
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(59,130,246,0.1))', 
              borderRadius: 20, 
              padding: 24, 
              border: '1px solid rgba(6,182,212,0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(6,182,212,0.8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lifetime Usage</span>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(6,182,212,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📊</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--neon-cyan)', fontFamily: 'var(--font-display)' }}>
                {room.total_matches_hosted || 0} <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.7 }}>Matches</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Total challenges completed here</div>
            </div>

            {/* Telegram Link Card */}
            <div 
              style={{ 
                background: 'rgba(255,255,255,0.03)', 
                borderRadius: 20, 
                padding: 24, 
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }} 
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
              }}
              onClick={() => window.open(room.invite_link, '_blank')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Telegram Link</span>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✈️</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Open Chat <span style={{ fontSize: 14 }}>↗</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {room.invite_link}
              </div>
            </div>

            {/* Registration Card */}
            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: 20, 
              padding: 24, 
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Creation Date</span>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📅</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatDate(room.created_at).split(',')[0]}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(room.created_at).split(',')[1]}</div>
            </div>
          </div>
        </div>

        {/* Match History Table */}
        <div className="glass-card animate-fade-in" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>⚔️ Hosted Match History</h2>
          
          {loadingMatches ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>Loading match history...</div>
          ) : matches.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
              No matches have been played in this room yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-secondary)', color: 'var(--text-muted)', fontSize: 12 }}>
                    <th style={{ padding: '16px 8px' }}>DATE</th>
                    <th style={{ padding: '16px 8px' }}>MATCHUP</th>
                    <th style={{ padding: '16px 8px' }}>STAKE</th>
                    <th style={{ padding: '16px 8px' }}>STATUS</th>
                    <th style={{ padding: '16px 8px' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => {
                    const isActive = !['COMPLETED', 'VOIDED', 'CANCELLED'].includes(m.status);
                    const isWinnerChallenger = m.status === 'COMPLETED' && m.winner_id === m.challenger_id;
                    const isWinnerOpponent = m.status === 'COMPLETED' && m.winner_id === m.opponent_id;

                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border-secondary)', fontSize: 14 }}>
                        <td style={{ padding: '16px 8px' }}>{formatDate(m.created_at)}</td>
                        <td style={{ padding: '16px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ 
                              fontWeight: 600, 
                              color: isWinnerChallenger ? 'var(--neon-yellow)' : 'var(--text-primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              {isWinnerChallenger && <span>🏆</span>}
                              {m.challenger?.username}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>VS</span>
                            <span style={{ 
                              fontWeight: 600, 
                              color: isWinnerOpponent ? 'var(--neon-yellow)' : 'var(--text-primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              {isWinnerOpponent && <span>🏆</span>}
                              {m.opponent?.username || '---'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 8px', color: 'var(--neon-yellow)', fontWeight: 700 }}>
                          {Number(m.stake_amount).toLocaleString()}
                        </td>
                        <td style={{ padding: '16px 8px' }}>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: 6, 
                            fontSize: 11, 
                            fontWeight: 800,
                            background: isActive ? 'rgba(34,197,94,0.15)' : m.status === 'COMPLETED' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                            color: isActive ? 'var(--neon-green)' : m.status === 'COMPLETED' ? 'var(--neon-green)' : 'var(--text-muted)'
                          }}>
                            {isActive ? 'ACTIVE' : m.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 8px' }}>
                          <button 
                            className="btn-secondary btn-sm"
                            onClick={() => router.push(`/admin/matches/${m.id}`)}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="glass-card animate-scale-in" style={{ maxWidth: 450, width: '100%', padding: 32, background: 'rgba(20,20,30,0.98)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>Edit Battle Room</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Room Title</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="input-field" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Chat ID</label>
                <input type="text" value={editChatId} onChange={e => setEditChatId(e.target.value)} className="input-field" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Invite Link</label>
                <input type="url" value={editInviteLink} onChange={e => setEditInviteLink(e.target.value)} className="input-field" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleEditSave()}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
