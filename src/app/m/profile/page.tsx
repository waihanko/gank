'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDialog } from '@/lib/dialog-context';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function MobileProfilePage() {
  const { user, token, isLoggedIn, logout, loading, refreshUser } = useAuth();
  const { showAlert } = useDialog();

  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [editMlbb, setEditMlbb] = useState(false);
  const [editTg, setEditTg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [serverId, setServerId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [mlbbIgn, setMlbbIgn] = useState('');
  const [tgUsername, setTgUsername] = useState('');
  const [tgProfile, setTgProfile] = useState<{ display_name: string; bio: string; type: string; profile_image: string } | null>(null);

  useEffect(() => {
    if (!loading && !isLoggedIn) { window.location.href = '/login'; return; }
    if (token) {
      fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { if (d.success) { setProfile(d.data); refreshUser(); } })
        .catch(() => {});
    }
  }, [token, isLoggedIn, loading]);

  async function handleVerifyMlbb() {
    setError(''); setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-mlbb`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: serverId, zone_id: zoneId }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setMlbbIgn(data.data.mlbb_ign);
    } catch { setError('Failed to verify.'); }
    finally { setSaving(false); }
  }

  async function handleSaveMlbb() {
    setError(''); setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mlbb_server_id: serverId, mlbb_zone_id: zoneId, mlbb_ign: mlbbIgn }),
      });
      const data = await res.json();
      if (data.success) { showAlert('MLBB Info updated!'); setEditMlbb(false); refreshUser(); setProfile(data.data); }
      else setError(data.error || 'Failed to update.');
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  async function handleVerifyTg() {
    setError(''); setSaving(true);
    const uname = tgUsername.startsWith('@') ? tgUsername : `@${tgUsername}`;
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-telegram`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_username: uname }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setTgUsername(uname); setTgProfile(data.data);
    } catch { setError('Failed to verify.'); }
    finally { setSaving(false); }
  }

  async function handleSaveTg() {
    setError(''); setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          telegram_username: tgUsername,
          telegram_display_name: tgProfile?.display_name,
          telegram_bio: tgProfile?.bio,
          telegram_profile_image: tgProfile?.profile_image,
        }),
      });
      const data = await res.json();
      if (data.success) { showAlert('Telegram updated!'); setEditTg(false); refreshUser(); setProfile(data.data); }
      else setError(data.error || 'Failed.');
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  if (loading || !user) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="font-display gradient-text" style={{ fontSize: 16 }}>Loading...</div>
      </div>
    );
  }

  const p = profile || user;
  const wins = (p.wins as number) || 0;
  const losses = (p.losses as number) || 0;
  const total = wins + losses;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';
  const wallet = p.wallet as Record<string, number> | null;
  const displayName = (p.telegram_display_name as string) || (p.mlbb_ign as string) || (p.username as string) || 'Player';
  const initial = displayName.replace('@', '').charAt(0).toUpperCase();

  return (
    <div style={{ padding: '0 16px 24px' }}>
      {/* Profile Card */}
      <div style={{ padding: '24px 0 16px', textAlign: 'center' }}>
        {p.avatar_url ? (
          <img
            src={p.avatar_url as string}
            alt="Avatar"
            style={{
              width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
              border: '3px solid var(--accent-primary)',
              margin: '0 auto 12px', display: 'block',
              boxShadow: '0 0 20px var(--accent-glow)',
            }}
          />
        ) : (
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 700, color: 'white',
            margin: '0 auto 12px', border: '3px solid var(--accent-primary)',
            boxShadow: '0 0 20px var(--accent-glow)',
          }}>
            {initial}
          </div>
        )}
        <h1 className="font-display" style={{ fontSize: 22, fontWeight: 800 }}>
          <span className="gradient-text">{displayName}</span>
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {p.telegram_username as string} {p.telegram_username && p.mlbb_ign ? '•' : ''} {p.mlbb_ign as string}
        </div>
        {!!(p.telegram_bio as string) && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, fontStyle: 'italic' }}>
            "{p.telegram_bio as string}"
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Wins', value: wins, color: 'var(--neon-green)' },
          { label: 'Losses', value: losses, color: 'var(--neon-red)' },
          { label: 'Win Rate', value: `${winRate}%`, color: 'var(--neon-cyan)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 14, padding: '14px 8px', textAlign: 'center',
          }}>
            <div className="font-display" style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Wallet card */}
      {wallet && (
        <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: '16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>💰 Wallet</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Balance', value: `${Number(wallet.balance || 0).toLocaleString()} MMK`, color: 'var(--neon-green)' },
              { label: 'Frozen', value: `${Number(wallet.frozen_amount || 0).toLocaleString()} MMK`, color: 'var(--neon-blue)' },
              { label: 'Total Won', value: `${Number(wallet.total_won || 0).toLocaleString()} MMK`, color: 'var(--neon-green)' },
              { label: 'Total Lost', value: `${Number(wallet.total_lost || 0).toLocaleString()} MMK`, color: 'var(--neon-red)' },
            ].map(w => (
              <div key={w.label} style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>{w.label}</div>
                <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: w.color }}>{w.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account Details */}
      <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: '16px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🎮 Account Details</div>
        <div style={{ fontSize: 11, color: 'var(--neon-yellow)', marginBottom: 14 }}>
          ⚠️ Telegram & MLBB can only be changed once every 30 days.
        </div>

        {/* Telegram row */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Telegram Username</span>
            <button
              onClick={() => { setTgUsername((p.telegram_username as string)?.replace('@', '') || ''); setTgProfile(null); setError(''); setEditTg(true); }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-secondary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
            >
              Edit
            </button>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{p.telegram_username as string || '—'}</div>
        </div>

        {/* MLBB row */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>MLBB Identity</span>
            <button
              onClick={() => { setServerId(p.mlbb_server_id as string || ''); setZoneId(p.mlbb_zone_id as string || ''); setMlbbIgn(''); setError(''); setEditMlbb(true); }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-secondary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
            >
              Edit
            </button>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>IGN</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.mlbb_ign as string || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Server</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.mlbb_server_id as string || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Zone</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.mlbb_zone_id as string || '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {[
          { href: '/matches',  icon: '⚔️', label: 'Battle History',      sub: 'View all your matches' },
          { href: '/transactions', icon: '📊', label: 'Transaction History', sub: 'Deposits, withdrawals & payouts' },
        ].map(link => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
              borderRadius: 14, padding: '14px 16px', textDecoration: 'none', color: 'inherit',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'var(--bg-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>
                {link.icon}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{link.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{link.sub}</div>
              </div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>›</span>
          </Link>
        ))}
      </div>

      {/* Switch to desktop */}
      <div style={{ marginBottom: 12 }}>
        <a
          href="/?mobile=false"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px', borderRadius: 14, textDecoration: 'none',
            border: '1px solid var(--border-secondary)', background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
          }}
        >
          🖥️ Switch to Desktop View
        </a>
      </div>

      {/* Logout */}
      <button
        onClick={() => { logout(); window.location.href = '/'; }}
        style={{
          width: '100%', padding: '13px', borderRadius: 14, border: '1px solid rgba(239,68,68,0.25)',
          background: 'rgba(239,68,68,0.08)', color: 'var(--neon-red)',
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}
      >
        Sign Out
      </button>

      {/* ===== EDIT MLBB SHEET ===== */}
      {editMlbb && (
        <>
          <div onClick={() => setEditMlbb(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
            background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)',
            borderRadius: '24px 24px 0 0', padding: '24px 20px 48px',
            animation: 'slideUp 0.28s ease',
          }}>
            <div style={{ width: 36, height: 4, background: 'var(--border-secondary)', borderRadius: 2, margin: '0 auto 20px' }} />
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Edit MLBB Identity</h2>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--neon-red)', padding: 10, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{error}</div>}

            {!mlbbIgn ? (
              <>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Server ID</label>
                <input className="input-field" value={serverId} onChange={e => setServerId(e.target.value)} style={{ marginBottom: 12 }} placeholder="e.g. 19864" />
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Zone ID</label>
                <input className="input-field" value={zoneId} onChange={e => setZoneId(e.target.value)} style={{ marginBottom: 16 }} placeholder="e.g. 9637" />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setEditMlbb(false)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border-secondary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleVerifyMlbb} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, var(--accent-primary), #6d28d9)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Verifying...' : 'Verify IGN'}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid var(--neon-green)', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--neon-green)', fontWeight: 700, marginBottom: 6 }}>✓ Verified</div>
                  <div className="font-display" style={{ fontSize: 22, fontWeight: 800 }}>{mlbbIgn}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{serverId} / {zoneId}</div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setMlbbIgn('')} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border-secondary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Re-enter</button>
                  <button onClick={handleSaveMlbb} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, var(--accent-primary), #6d28d9)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ===== EDIT TELEGRAM SHEET ===== */}
      {editTg && (
        <>
          <div onClick={() => setEditTg(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
            background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)',
            borderRadius: '24px 24px 0 0', padding: '24px 20px 48px',
            animation: 'slideUp 0.28s ease',
          }}>
            <div style={{ width: 36, height: 4, background: 'var(--border-secondary)', borderRadius: 2, margin: '0 auto 20px' }} />
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Edit Telegram</h2>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--neon-red)', padding: 10, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{error}</div>}

            {!tgProfile ? (
              <>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Username (without @)</label>
                <input className="input-field" value={tgUsername} onChange={e => setTgUsername(e.target.value.replace('@', ''))} style={{ marginBottom: 16 }} placeholder="your_username" />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setEditTg(false)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border-secondary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleVerifyTg} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #0088cc, #006ba6)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Verifying...' : 'Verify'}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 16 }}>
                  {tgProfile.profile_image ? (
                    <img src={tgProfile.profile_image} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 10px', border: '2px solid var(--accent-primary)', display: 'block' }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #0088cc, #006ba6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'white', margin: '0 auto 10px' }}>
                      {(tgProfile.display_name || tgUsername).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{tgProfile.display_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>@{tgUsername.replace('@', '')}</div>
                  {tgProfile.bio && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>"{tgProfile.bio}"</div>}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setTgProfile(null)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border-secondary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Re-enter</button>
                  <button onClick={handleSaveTg} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #0088cc, #006ba6)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
