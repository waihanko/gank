'use client';

import { use, useEffect, useState } from 'react';
import { formatCurrency, formatDate, getWinRate } from '@/lib/utils';
import { useDialog } from '@/lib/dialog-context';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showAlert, showConfirm } = useDialog();

  const [user, setUser] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showNotify, setShowNotify] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('Important Message');
  const [notifyMessage, setNotifyMessage] = useState('');
  
  const [showBan, setShowBan] = useState(false);
  const [banReason, setBanReason] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    setLoading(true);
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
    if (!notifyTitle || !notifyMessage) return showAlert('Title and message required');
    
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${id}/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: notifyTitle, message: notifyMessage })
      });
      const data = await res.json();
      if (data.success) {
        showAlert('Notification dispatched successfully');
        setShowNotify(false);
        setNotifyMessage('');
      }
    } catch {
      showAlert('Failed to transmit signal');
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
        body: JSON.stringify({ reason: banReason })
      });
      const data = await res.json();
      if (data.success) {
        showAlert('User access has been restricted');
        setShowBan(false);
        fetchData();
      }
    } catch {
      showAlert('Failed to apply restriction');
    }
  }

  async function handleUnban() {
    showConfirm('Lift all restrictions for this user?', async () => {
      const token = localStorage.getItem('gr_admin_token');
      try {
        const res = await fetch(`${API_URL}/api/admin/users/${id}/unban`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          showAlert('User access restored');
          fetchData();
        }
      } catch {
        showAlert('Failed to restore access');
      }
    });
  }

  if (loading) return <div className="page-container">Scanning user profile...</div>;
  if (!user) return <div className="page-container">User not found in registry.</div>;

  return (
    <div className="page-container">
      {/* Header Area */}
      <div style={{ marginBottom: 32 }}>
        <button 
          onClick={() => router.push('/admin/users')}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back to Users
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="font-display" style={{ fontSize: 32, fontWeight: 900 }}>
              👤 <span className="gradient-text">{user.username}</span>
            </h1>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {user.id}</span>
              {user.is_banned ? (
                <span style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--neon-red)', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, border: '1px solid rgba(239,68,68,0.2)' }}>
                  🚫 ACCOUNT BANNED
                </span>
              ) : (
                <span style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--neon-green)', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, border: '1px solid rgba(34,197,94,0.2)' }}>
                  ✅ VERIFIED PLAYER
                </span>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-primary" onClick={() => setShowNotify(true)}>
              🔔 Send Notify
            </button>
            {user.is_banned ? (
              <button className="btn-success" onClick={handleUnban}>
                🔓 Lift Ban
              </button>
            ) : (
              <button className="btn-danger" onClick={() => setShowBan(true)}>
                🚫 Ban User
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
        {/* Sidebar: Profile Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>Player Identity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Telegram Identity</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-secondary)' }}>
                  {user.telegram_username?.startsWith('@') ? user.telegram_username : `@${user.telegram_username}`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>MLBB IGN</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--neon-yellow)' }}>{user.mlbb_ign}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Server / Zone ID</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{user.mlbb_server_id} ({user.mlbb_zone_id})</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Member Since</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(user.created_at)}</div>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: 24, background: 'linear-gradient(135deg, rgba(34,197,94,0.05), transparent)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>Financial Overview</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Available Balance</span>
                <span className="font-display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--neon-green)' }}>{formatCurrency(user.wallet?.balance)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Locked in Matches</span>
                <span className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--neon-blue)' }}>{formatCurrency(user.wallet?.frozen_amount)}</span>
              </div>
            </div>
          </div>

          {user.is_banned && (
            <div className="glass-card" style={{ padding: 24, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--neon-red)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Suspension Record</h3>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{user.ban_reason || 'No specific reason provided.'}</p>
            </div>
          )}
        </div>

        {/* Main Content: Match History */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800 }}>⚔️ Match History</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--neon-green)' }}>{user.wins}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Wins</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--neon-red)' }}>{user.losses}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Losses</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--neon-cyan)' }}>{getWinRate(user.wins, user.losses)}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>WR</div>
              </div>
            </div>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  <th style={{ padding: '16px 32px' }}>Date</th>
                  <th style={{ padding: '16px 12px' }}>Opponent</th>
                  <th style={{ padding: '16px 12px' }}>Stake</th>
                  <th style={{ padding: '16px 12px' }}>Result</th>
                  <th style={{ padding: '16px 32px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>No matches recorded in security logs.</td>
                  </tr>
                ) : matches.map(match => {
                  const isChallenger = match.challenger_id === user.id;
                  const opponent = isChallenger ? match.opponent : match.challenger;
                  const result = match.status === 'COMPLETED' 
                    ? (match.winner_id === user.id ? 'WIN' : 'LOSS')
                    : match.status;

                  return (
                    <tr key={match.id} style={{ borderBottom: '1px solid var(--border-secondary)', fontSize: 14 }}>
                      <td style={{ padding: '16px 32px' }}>
                        <div style={{ fontWeight: 600 }}>{formatDate(match.created_at).split(',')[0]}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(match.created_at).split(',')[1]}</div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        {opponent ? (
                          <>
                            <div style={{ fontWeight: 700 }}>{opponent.mlbb_ign}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{opponent.username}</div>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Open Challenge</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 12px', fontWeight: 700, color: 'var(--neon-yellow)' }}>
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
                          onClick={() => window.location.href = `/admin/matches/${match.id}`}
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

      {/* Notify Modal */}
      {showNotify && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glass-card animate-fade-in-up" style={{ width: 450, padding: 32, border: '1px solid var(--accent-primary)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Transmit Signal</h3>
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
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowNotify(false)}>Abort</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Dispatch</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {showBan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glass-card animate-fade-in-up" style={{ width: 450, padding: 32, border: '1px solid var(--neon-red)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--neon-red)', marginBottom: 8 }}>Restrict Access</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Enter the official reason for suspending this account.</p>
            <form onSubmit={handleBan}>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Violation Details</label>
                <textarea
                  className="input-field"
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  placeholder="e.g., Match fixing, toxic behavior, etc."
                  style={{ height: 120, resize: 'none' }}
                  required
                ></textarea>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowBan(false)}>Cancel</button>
                <button type="submit" className="btn-danger" style={{ flex: 1 }}>Apply Restriction</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
