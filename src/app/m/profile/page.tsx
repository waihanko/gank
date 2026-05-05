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
  const [tgStep, setTgStep] = useState(1);
  const [tgProfile, setTgProfile] = useState<{ display_name: string; bio: string; type: string; profile_image: string } | null>(null);
  const [tgGroupLink, setTgGroupLink] = useState('');
  const [vc, setVc] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [mlbbProfile, setMlbbProfile] = useState<{ mlbb_ign: string; avatar_url: string; level: number; rank_level: number; reg_country: string } | null>(null);

  useEffect(() => {
    if (!loading && !isLoggedIn) { window.location.href = '/login'; return; }
    if (token) {
      fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { if (d.success) { setProfile(d.data); refreshUser(); } })
        .catch(() => {});
    }
  }, [token, isLoggedIn, loading]);

  async function handleSendVc() {
    setError(''); setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/send-vc`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: serverId, zone_id: zoneId }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setCodeSent(true);
    } catch { setError('Failed to send code.'); }
    finally { setSaving(false); }
  }

  async function handleVerifyVc() {
    setError(''); setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-vc`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: serverId, zone_id: zoneId, vc }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setMlbbProfile(data.data);
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
    const uname = tgUsername.trim().startsWith('@') ? tgUsername.trim() : `@${tgUsername.trim()}`;
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

  async function handleConfirmTgProfile() {
    setError(''); setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          telegram_username: tgUsername,
          telegram_display_name: tgProfile?.display_name,
          telegram_bio: tgProfile?.bio,
          telegram_profile_image: tgProfile?.profile_image
        })
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Failed to save profile.'); return; }

      const linkRes = await fetch(`${API_URL}/api/users/telegram-group`);
      const linkData = await linkRes.json();
      if (linkData.success && linkData.data.invite_link) {
        setTgGroupLink(linkData.data.invite_link);
        setTgStep(2);
      } else {
        setError('Saved, but could not retrieve the official group link. Please contact support.');
      }
    } catch { setError('Network error while saving.'); }
    finally { setSaving(false); }
  }

  async function handleCheckStatus() {
    setSaving(true);
    try {
      await refreshUser();
      const res = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success && data.data.telegram_chat_id) {
        showAlert('Telegram Successfully Connected!');
        setProfile(data.data);
        setEditTg(false);
      } else {
        setError("We couldn't detect your account. If you've already joined, please send a quick message in the group to verify, then click \"I've Joined\" again.");
      }
    } catch { setError('Network error while checking status.'); }
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
  const displayName = (p.mlbb_ign as string) || (p.telegram_display_name as string) || (p.username as string) || 'Player';
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
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Balance</div>
              <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--neon-green)' }}>{Number(wallet.balance || 0).toLocaleString()} MMK</div>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Frozen</div>
              <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--neon-blue)' }}>{Number(wallet.frozen_amount || 0).toLocaleString()} MMK</div>
            </div>
          </div>
        </div>
      )}

      {/* Account Details */}
      <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: '16px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🎮 Account Details</div>
        <div style={{ fontSize: 11, color: 'var(--neon-yellow)', marginBottom: 14 }}>
          ⚠️ Note: Telegram Username can only be changed once every 30 days.
        </div>

        {/* MLBB row */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mobile Legends ID</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.15)', padding: '2px 8px', borderRadius: 6, color: 'var(--neon-green)', fontWeight: 700 }}>Verified</span>
              <button
                onClick={() => { setServerId(p.mlbb_server_id as string || ''); setZoneId(p.mlbb_zone_id as string || ''); setMlbbIgn(''); setMlbbProfile(null); setVc(''); setCodeSent(false); setError(''); setEditMlbb(true); }}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-secondary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
              >
                Edit
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div><div style={{ fontSize: 9, color: 'var(--text-muted)' }}>IGN</div><div style={{ fontSize: 13, fontWeight: 600 }}>{p.mlbb_ign as string || '—'}</div></div>
            <div><div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Server</div><div style={{ fontSize: 13, fontWeight: 600 }}>{p.mlbb_server_id as string || '—'}</div></div>
            <div><div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Zone</div><div style={{ fontSize: 13, fontWeight: 600 }}>{p.mlbb_zone_id as string || '—'}</div></div>
          </div>
        </div>

        {/* Telegram row */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Telegram Username</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {p.telegram_username && p.telegram_chat_id && (
                <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.15)', padding: '2px 8px', borderRadius: 6, color: 'var(--neon-green)', fontWeight: 700 }}>Verified</span>
              )}
              {p.telegram_username && !p.telegram_chat_id && (
                <span style={{ fontSize: 10, background: 'rgba(234,179,8,0.15)', padding: '2px 8px', borderRadius: 6, color: 'var(--neon-yellow)', fontWeight: 700 }}>Pending</span>
              )}
              <button
                onClick={() => { 
                  setTgUsername((p.telegram_username as string)?.replace('@', '') || ''); 
                  setTgStep(p.telegram_username && !p.telegram_chat_id ? 2 : 1);
                  setTgProfile(null); setError(''); setEditTg(true); 
                  if (p.telegram_username && !p.telegram_chat_id) {
                    fetch(`${API_URL}/api/users/telegram-group`).then(r => r.json()).then(d => { if (d.success) setTgGroupLink(d.data.invite_link) });
                  }
                }}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-secondary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
              >
                {p.telegram_chat_id ? 'Edit' : (p.telegram_username ? 'Verify' : 'Connect')}
              </button>
            </div>
          </div>
          <div style={{ fontSize: p.telegram_username ? 13 : 11, fontWeight: p.telegram_username ? 600 : 400, color: p.telegram_username ? 'inherit' : 'var(--neon-cyan)' }}>
            {p.telegram_username as string || '🔔 Get instant alerts on Telegram'}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {[
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

            {!mlbbProfile ? (
              <>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Server ID</label>
                <input className="input-field" value={serverId} onChange={e => setServerId(e.target.value)} disabled={codeSent} style={{ marginBottom: 12 }} placeholder="e.g. 19864" />
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Zone ID</label>
                <input className="input-field" value={zoneId} onChange={e => setZoneId(e.target.value)} disabled={codeSent} style={{ marginBottom: 16 }} placeholder="e.g. 9637" />
                
                {!codeSent ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setEditMlbb(false)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border-secondary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSendVc} disabled={saving || !serverId || !zoneId} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, var(--accent-primary), #6d28d9)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Sending...' : 'Send VC'}</button>
                  </div>
                ) : (
                  <>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--neon-cyan)', marginBottom: 4 }}>Verification Code</label>
                    <input className="input-field" value={vc} onChange={e => setVc(e.target.value)} maxLength={4} style={{ marginBottom: 20, letterSpacing: 4, fontWeight: 700 }} placeholder="4-digit code" />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setCodeSent(false)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border-secondary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                      <button onClick={handleVerifyVc} disabled={saving || vc.length !== 4} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, var(--accent-primary), #6d28d9)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Verifying...' : 'Verify'}</button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div style={{
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(6,182,212,0.06))',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src={mlbbProfile.avatar_url || 'https://via.placeholder.com/100'}
                      alt={mlbbProfile.mlbb_ign}
                      style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--accent-primary)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{mlbbProfile.mlbb_ign}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {serverId} ({zoneId})</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 4 }}>Level {mlbbProfile.level}</span>
                        <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 4 }}>{mlbbProfile.reg_country.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setMlbbProfile(null)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border-secondary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>✕ Not me</button>
                  <button onClick={handleSaveMlbb} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, var(--accent-primary), #6d28d9)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Confirm Changes'}</button>
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
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              {tgStep === 1 ? (p.telegram_username ? 'Edit' : 'Connect') : 'Verify'} Telegram
            </h2>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--neon-red)', padding: 10, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{error}</div>}

            {tgStep === 1 ? (
              !tgProfile ? (
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
                    <button onClick={handleConfirmTgProfile} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #0088cc, #006ba6)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Confirm & Next' : 'Next Step'}</button>
                  </div>
                </>
              )
            ) : (
              <>
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Step 2: Join the Official Group</h4>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    To verify your identity, you must join our official Telegram group using the account <b>{tgUsername}</b>.
                  </p>
                  {tgGroupLink ? (
                    <a href={tgGroupLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '12px 24px', background: 'linear-gradient(135deg, #0088cc, #006ba6)', color: 'white', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                      Join Telegram Group
                    </a>
                  ) : (
                    <div style={{ color: 'var(--neon-red)', fontSize: 12, marginBottom: 10 }}>Invite link unavailable.</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setTgStep(1)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border-secondary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button onClick={handleCheckStatus} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: 'var(--neon-green)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                    {saving ? 'Checking...' : "I've Joined"}
                  </button>
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
