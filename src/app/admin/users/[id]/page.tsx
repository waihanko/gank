'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showNotify, setShowNotify] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('Important Message');
  const [notifyMessage, setNotifyMessage] = useState('');

  const [showBan, setShowBan] = useState(false);
  const [banReason, setBanReason] = useState('');

  const [sendNotification, setSendNotification] = useState(true);
  const [sendTelegram, setSendTelegram] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    const token = localStorage.getItem('gr_admin_token');
    try {
      const [uRes, mRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/users/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/admin/users/${id}/matches`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const uData = await uRes.json();
      const mData = await mRes.json();

      if (uData.success) setUser(uData.data);
      if (mData.success) setMatches(mData.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleNotify(e: React.FormEvent) {
    e.preventDefault();
    if (!notifyTitle || !notifyMessage) return alert('Title and message required');

    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${id}/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: notifyTitle,
          message: notifyMessage,
          sendNotification,
          sendTelegram
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowNotify(false);
        setNotifyMessage('');
      }
    } catch (e) {
      alert('Failed to send notification');
    }
  }

  async function handleBan(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${id}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_banned: !user.is_banned, ban_reason: banReason })
      });
      const data = await res.json();
      if (data.success) {
        alert(user.is_banned ? 'User unbanned' : 'User banned');
        setShowBan(false);
        fetchData();
      }
    } catch (e) {
      alert('Action failed');
    }
  }

  if (loading) return <div className="p-8 text-center text-muted">Analyzing profile data...</div>;
  if (!user) return <div className="p-8 text-center text-muted">User not found.</div>;

  return (
    <div className="page-container">
      {/* Header Area */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => router.push('/admin/users')}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Return to Directory
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <img
              src={user.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.username}
              style={{ width: 80, height: 80, borderRadius: 20, border: '2px solid var(--accent-primary)', objectFit: 'cover' }}
            />
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px', marginBottom: 4 }}>{user.username}</h1>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>UID: {user.id.substring(0, 8)}</span>
                {user.is_banned && (
                  <span style={{ background: 'var(--neon-red)', color: 'white', fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>Banned</span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-primary" onClick={() => setShowNotify(true)}>
              🔔 Send Notify
            </button>
            <button className={user.is_banned ? 'btn-secondary' : 'btn-danger'} onClick={() => setShowBan(true)}>
              {user.is_banned ? 'Unban User' : 'Ban Account'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 32 }}>
        {/* Main Content */}
        <div>
          {/* Identity & Game Stats */}
          <div className="glass-card" style={{ marginBottom: 32, padding: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24, textTransform: 'uppercase', letterSpacing: '1px' }}>Identity Overview</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Telegram Handle</label>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{user.telegram_username}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>MLBB Identifier</label>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{user.mlbb_ign} ({user.mlbb_server_id})</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Zone ID</label>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{user.mlbb_zone_id}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Enrollment Date</label>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{formatDate(user.created_at)}</div>
              </div>
            </div>
          </div>

          {/* Battle History */}
          <div className="glass-card" style={{ padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Match Record</h2>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--neon-green)' }}>{user.wins}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Victories</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--neon-red)' }}>{user.losses}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Defeats</div>
                </div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <th style={{ padding: '0 12px 16px 12px', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Match</th>
                    <th style={{ padding: '0 12px 16px 12px', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Opponent</th>
                    <th style={{ padding: '0 12px 16px 12px', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Stake</th>
                    <th style={{ padding: '0 12px 16px 12px', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Result</th>
                    <th style={{ padding: '0 32px 16px 12px', textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {matches.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No matches recorded yet.</td>
                    </tr>
                  ) : matches.map(match => {
                    const isChallenger = match.challenger_id === user.id;
                    const opponent = isChallenger ? match.opponent : match.challenger;
                    const result = match.status === 'COMPLETED'
                      ? (match.winner_id === user.id ? 'WIN' : 'LOSS')
                      : match.status;

                    return (
                      <tr key={match.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} className="hover-row">
                        <td style={{ padding: '16px 12px' }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>#{match.id.substring(0, 6)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(match.created_at)}</div>
                        </td>
                        <td style={{ padding: '16px 12px' }}>
                          {opponent ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <img src={opponent.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + opponent.username} style={{ width: 24, height: 24, borderRadius: 6 }} />
                              <span style={{ fontSize: 14, fontWeight: 600 }}>{opponent.username}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '16px 12px', fontSize: 14, fontWeight: 700, color: 'var(--accent-primary)' }}>
                          {formatCurrency(match.stake_amount)}
                        </td>
                        <td style={{ padding: '16px 12px' }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: result === 'WIN' ? 'rgba(34,197,94,0.15)' : (result === 'LOSS' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)'),
                            color: result === 'WIN' ? 'var(--neon-green)' : (result === 'LOSS' ? 'var(--neon-red)' : 'var(--text-muted)')
                          }}>
                            {result}
                          </span>
                        </td>
                        <td style={{ padding: '16px 32px', textAlign: 'right' }}>
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => router.push(`/admin/matches/${match.id}`)}
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
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div>
          {/* Wallet Widget */}
          <div className="glass-card" style={{ padding: 32, marginBottom: 32, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'var(--accent-primary)', opacity: 0.1, filter: 'blur(30px)' }}></div>
            <h2 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>Available Credit</h2>
            <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--accent-primary)', marginBottom: 8 }}>{formatCurrency(user.wallet?.balance || 0)}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Wallet Active</div>
          </div>

          {/* Account Actions Log */}
          <div className="glass-card" style={{ padding: 32 }}>
            <h2 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 20 }}>System Logs</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Profile Created</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(user.created_at)}</div>
              </div>
              <div style={{ borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Identity Verified</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Automatic System Check</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notify Modal */}
      {showNotify && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glass-card animate-fade-in-up" style={{ width: 450, padding: 32, border: '1px solid var(--accent-primary)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Send Notify</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Send a direct system notification to this player.</p>
            <form onSubmit={handleNotify}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Subject</label>
                <input
                  type="text"
                  className="input-field"
                  value={notifyTitle}
                  onChange={e => setNotifyTitle(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Payload Message</label>
                <textarea
                  className="input-field"
                  value={notifyMessage}
                  onChange={e => setNotifyMessage(e.target.value)}
                  style={{ height: 120, resize: 'none' }}
                  required
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={sendNotification}
                    onChange={e => setSendNotification(e.target.checked)}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  <span>Internal Notification</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={sendTelegram}
                    onChange={e => setSendTelegram(e.target.checked)}
                    disabled={!user.telegram_id}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  <span style={{ color: user.telegram_id ? 'inherit' : 'var(--text-muted)' }}>
                    Telegram Alert {!user.telegram_id && '(No ID)'}
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowNotify(false)}>Close</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Send</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {showBan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glass-card animate-fade-in-up" style={{ width: 400, padding: 32, border: '1px solid var(--neon-red)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>{user.is_banned ? 'Restore Account' : 'Suspend Access'}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              {user.is_banned ? 'Are you sure you want to restore access for this player?' : 'Please provide a formal reason for this suspension.'}
            </p>
            <form onSubmit={handleBan}>
              {!user.is_banned && (
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Violation Reason</label>
                  <textarea
                    className="input-field"
                    value={banReason}
                    onChange={e => setBanReason(e.target.value)}
                    style={{ height: 100, resize: 'none' }}
                    required
                  ></textarea>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowBan(false)}>Abort</button>
                <button type="submit" className="btn-danger" style={{ flex: 1 }}>{user.is_banned ? 'Restore' : 'Confirm Ban'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
