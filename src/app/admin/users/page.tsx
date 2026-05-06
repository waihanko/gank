'use client';

import { formatCurrency, formatDate, getWinRate } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/lib/dialog-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminUsersPage() {
  const router = useRouter();
  const { showAlert } = useDialog();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showBanned, setShowBanned] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('gr_admin_token');
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      window.location.href = '/admin/error?message=The user directory could not be reached. Please check your network connection.';
    }
    setLoading(false);
  }

  const filtered = users.filter((u) => {
    const matchesSearch = search === '' ||
      u.mlbb_ign?.toLowerCase().includes(search.toLowerCase()) ||
      (u.username && u.username.toLowerCase().includes(search.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
      (u.telegram_username && u.telegram_username.includes(search));
    const matchesBanned = showBanned ? u.is_banned : true;
    return matchesSearch && matchesBanned;
  });

  return (
    <div className="page-container">
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
          👥 <span className="gradient-text">Player Management</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Manage all registered players and their wallets
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input-field"
          placeholder="🔍 Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={showBanned}
            onChange={(e) => setShowBanned(e.target.checked)}
            style={{ accentColor: 'var(--accent-primary)' }}
          />
          Banned Only
        </label>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading players...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map((user) => {
            const wallet = user.wallet;
            return (
              <div
                key={user.id}
                className="glass-card"
                style={{
                  padding: 24,
                  borderColor: user.is_banned ? 'rgba(239,68,68,0.3)' : undefined,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        overflow: 'hidden',
                        background: user.is_banned
                          ? 'linear-gradient(135deg, #dc2626, #991b1b)'
                          : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        fontWeight: 700,
                      }}
                    >
                      {user.is_banned ? '🚫' : (user.mlbb_avatar_url
                        ? <img src={user.mlbb_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (user.mlbb_ign?.charAt(0) || user.username.charAt(0)))}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: user.is_banned ? 'var(--neon-red)' : 'var(--text-primary)' }}>
                        {user.mlbb_ign || user.username}
                      </div>
                      {user.email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.email}</div>}
                    </div>
                  </div>
                  {user.is_banned ? (
                    <span style={{ background: 'rgba(239,68,68,0.2)', color: 'var(--neon-red)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      BANNED
                    </span>
                  ) : (
                    <span style={{ background: 'rgba(34,197,94,0.2)', color: 'var(--neon-green)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      ACTIVE
                    </span>
                  )}
                </div>

                {/* Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, fontSize: 12 }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Telegram: </span>
                    <span style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>{user.telegram_username}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>MLBB: </span>
                    <span style={{ color: 'var(--neon-yellow)', fontWeight: 600 }}>{user.mlbb_ign}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Server/Zone: </span>
                    <span style={{ fontFamily: 'monospace' }}>{user.mlbb_server_id || '—'} / {user.mlbb_zone_id || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Since: </span>
                    <span>{formatDate(user.created_at).split(',')[0]}</span>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 0', borderTop: '1px solid var(--border-secondary)', borderBottom: '1px solid var(--border-secondary)', marginBottom: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--neon-green)' }}>{user.wins}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Wins</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--neon-red)' }}>{user.losses}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Losses</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--neon-cyan)' }}>{getWinRate(user.wins, user.losses)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>WR</div>
                  </div>
                </div>

                {/* Wallet */}
                {wallet && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gridColumn: '1 / -1', padding: '6px 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Balance</span>
                      <span className="font-display" style={{ fontWeight: 700, color: 'var(--neon-green)' }}>{formatCurrency(wallet.balance)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gridColumn: '1 / -1', padding: '6px 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Frozen</span>
                      <span className="font-display" style={{ fontWeight: 700, color: 'var(--neon-blue)' }}>{formatCurrency(wallet.frozen_amount)}</span>
                    </div>
                  </div>
                )}

                {/* Ban Reason */}
                {user.is_banned && user.ban_reason && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 12, color: 'var(--neon-red)', lineHeight: 1.5 }}>
                    ⚠️ {user.ban_reason}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-secondary"
                    style={{ width: '100%', padding: '12px', fontSize: 13, fontWeight: 700 }}
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                  >
                    👤 View Full Profile
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
