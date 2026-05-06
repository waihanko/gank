'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useDialog } from '@/lib/dialog-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function ProfilePage() {
  const { user, token, isLoggedIn, logout, loading, refreshUser } = useAuth();
  const { showAlert } = useDialog();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  
  // Modals
  const [editMlbb, setEditMlbb] = useState(false);
  const [editTg, setEditTg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // MLBB State
  const [serverId, setServerId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [mlbbIgn, setMlbbIgn] = useState('');
  
  // TG State
  const [tgUsername, setTgUsername] = useState('');
  const [tgStep, setTgStep] = useState(1);
  const [tgProfile, setTgProfile] = useState<{ display_name: string; bio: string; type: string; profile_image: string } | null>(null);
  const [tgGroupLink, setTgGroupLink] = useState('');
  const [vc, setVc] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [mlbbProfile, setMlbbProfile] = useState<{ mlbb_ign: string; avatar_url: string; level: number; rank_level: number; reg_country: string } | null>(null);

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      window.location.href = '/login';
      return;
    }
    if (token) {
      fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(async r => {
          if (!r.ok) {
            const text = await r.text();
            console.error(`Failed to fetch profile: ${r.status} ${r.statusText}. Response starts with: ${text.substring(0, 100)}`);
            return { success: false, error: 'Failed to load profile data.' };
          }
          return r.json();
        })
        .then(d => { 
          if (d.success) {
            setProfile(d.data);
            // Also refresh the auth context so user data stays in sync
            refreshUser();
          }
        })
        .catch(err => {
          console.error("Fetch error:", err);
        });
    }
  }, [token, isLoggedIn, loading]);

  async function handleSendVc() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/send-vc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: serverId, zone_id: zoneId }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setCodeSent(true);
    } catch {
      setError('Failed to send verification code.');
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyVc() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-vc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: serverId, zone_id: zoneId, vc }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setMlbbProfile(data.data);
      setMlbbIgn(data.data.mlbb_ign);
    } catch {
      setError('Failed to verify code.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMlbb() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mlbb_server_id: serverId, mlbb_zone_id: zoneId, mlbb_ign: mlbbIgn })
      });
      const data = await res.json();
      if (data.success) {
        showAlert('MLBB Info updated!');
        setEditMlbb(false);
        refreshUser();
        setProfile(data.data);
      } else {
        setError(data.error || 'Failed to update MLBB.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyTgUsername() {
    setError('');
    setSaving(true);
    const uname = tgUsername.trim().startsWith('@') ? tgUsername.trim() : `@${tgUsername.trim()}`;
    
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_username: uname }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setTgUsername(uname);
      setTgProfile(data.data);
    } catch {
      setError('Failed to verify.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmTgProfile() {
    setError('');
    setSaving(true);

    try {
      // 1. Save the username and profile data
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
      
      if (!data.success) {
        setError(data.error || 'Failed to save profile.');
        setSaving(false);
        return;
      }

      // 2. Fetch the group link
      const linkRes = await fetch(`${API_URL}/api/users/telegram-group`);
      const linkData = await linkRes.json();
      
      if (linkData.success && linkData.data.invite_link) {
        setTgGroupLink(linkData.data.invite_link);
        setTgStep(2); // Move to Step 2
      } else {
        setError('Saved, but could not retrieve the official group link. Please contact support.');
      }
    } catch {
      setError('Network error while saving.');
    } finally {
      setSaving(false);
    }
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
        setError("We couldn't detect your account. If you've already joined, please send a quick message (like 'hello') in the Telegram group to verify your identity, then click \"I've Joined\" again.");
      }
    } catch {
      setError('Network error while checking status.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="font-display gradient-text" style={{ fontSize: 20 }}>Loading...</div></div>;

  const p = (profile || user) as any;
  const wins = (p.wins as number) || 0;
  const losses = (p.losses as number) || 0;
  const total = wins + losses;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';
  const wallet = p.wallet as Record<string, number> | null;

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          {p.avatar_url ? (
            <img src={p.avatar_url as string} alt="Avatar" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent-primary)', margin: '0 auto 16px', display: 'block' }} />
          ) : (
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 16px', color: 'white', fontWeight: 700, border: '3px solid var(--accent-primary)' }}>
              {((p.telegram_display_name as string) || (p.telegram_username as string)?.replace('@', '') || (p.username as string) || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800 }}>
            <span className="gradient-text">{p.mlbb_ign as string || p.telegram_display_name as string || p.username as string}</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            {p.mlbb_server_id as string && p.mlbb_zone_id as string ? `${p.mlbb_server_id}(${p.mlbb_zone_id})` : ''}
          </p>
          {!!p.telegram_bio && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8, fontStyle: 'italic', maxWidth: 400, margin: '8px auto 0' }}>
              &ldquo;{p.telegram_bio as string}&rdquo;
            </p>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          <div className="stat-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Wins</div>
            <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--neon-green)' }}>{wins}</div>
          </div>
          <div className="stat-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Losses</div>
            <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--neon-red)' }}>{losses}</div>
          </div>
          <div className="stat-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Win Rate</div>
            <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--neon-cyan)' }}>{winRate}%</div>
          </div>
        </div>

        {/* Wallet */}
        {wallet && (
          <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>💰 Wallet</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Balance</span><div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-green)' }}>{Number(wallet.balance || 0).toLocaleString()} MMK</div></div>
              <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Frozen</span><div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-blue)' }}>{Number(wallet.frozen_amount || 0).toLocaleString()} MMK</div></div>
            </div>
          </div>
        )}

        {/* Account Info */}
        <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>🎮 Account Details</h3>
          <div style={{ fontSize: 11, color: 'var(--neon-yellow)', marginBottom: 16 }}>
            ⚠️ Note: Telegram Username can only be changed once every 30 days.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* MLBB Section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Mobile Legends ID</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.15)', padding: '2px 8px', borderRadius: 6, color: 'var(--neon-green)', fontWeight: 700 }}>Verified</span>
                  <button 
                    className="btn-secondary btn-sm" 
                    onClick={() => {
                      setServerId(p.mlbb_server_id as string || '');
                      setZoneId(p.mlbb_zone_id as string || '');
                      setError('');
                      setEditMlbb(true);
                      setCodeSent(false);
                      setMlbbProfile(null);
                    }}>
                    Edit
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>IGN</span><div style={{ fontSize: 14, fontWeight: 600 }}>{p.mlbb_ign as string || '—'}</div></div>
                <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Server ID</span><div style={{ fontSize: 14, fontWeight: 600 }}>{p.mlbb_server_id as string || '—'}</div></div>
                <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Zone ID</span><div style={{ fontSize: 14, fontWeight: 600 }}>{p.mlbb_zone_id as string || '—'}</div></div>
              </div>
            </div>

            {/* Telegram Section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Telegram Username</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {p.telegram_username && p.telegram_chat_id && (
                    <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.15)', padding: '2px 8px', borderRadius: 6, color: 'var(--neon-green)', fontWeight: 700 }}>Verified</span>
                  )}
                  {p.telegram_username && !p.telegram_chat_id && (
                    <span style={{ fontSize: 11, background: 'rgba(234,179,8,0.15)', padding: '2px 8px', borderRadius: 6, color: 'var(--neon-yellow)', fontWeight: 700 }}>Pending</span>
                  )}
                  <button 
                    className="btn-secondary btn-sm" 
                    onClick={() => {
                      setTgUsername((p.telegram_username as string)?.replace('@', '') || '');
                      setTgStep(p.telegram_username && !p.telegram_chat_id ? 2 : 1);
                      setError('');
                      setEditTg(true);
                      
                      // If moving to step 2, pre-fetch link
                      if (p.telegram_username && !p.telegram_chat_id) {
                         fetch(`${API_URL}/api/users/telegram-group`)
                          .then(r => r.json())
                          .then(d => { if (d.success) setTgGroupLink(d.data.invite_link) });
                      }
                    }}>
                    {p.telegram_chat_id ? 'Edit' : (p.telegram_username ? 'Complete Verification' : 'Connect')}
                  </button>
                </div>
              </div>
              <div style={{ fontSize: p.telegram_username ? 14 : 11, fontWeight: p.telegram_username ? 600 : 400, color: p.telegram_username ? 'inherit' : 'var(--neon-cyan)' }}>
                {p.telegram_username as string || '🔔 Get instant alerts on Telegram'}
              </div>
            </div>

          </div>
        </div>
      </div>
      <Footer />

      {/* Edit MLBB Modal */}
      {editMlbb && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="glass-card animate-fade-in-up" style={{ width: '100%', maxWidth: 440, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Edit MLBB Identity</h3>
            
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--neon-red)', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
            
            {!mlbbProfile ? (
              <>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Server ID</label>
                <input className="input-field" value={serverId} onChange={e => setServerId(e.target.value)} disabled={codeSent} style={{ width: '100%', marginBottom: 12 }} placeholder="e.g. 12345678" />
                
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Zone ID</label>
                <input className="input-field" value={zoneId} onChange={e => setZoneId(e.target.value)} disabled={codeSent} style={{ width: '100%', marginBottom: 16 }} placeholder="e.g. 1234" />
                
                {!codeSent ? (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditMlbb(false)}>Cancel</button>
                    <button className="btn-primary" style={{ flex: 1 }} onClick={handleSendVc} disabled={saving || !serverId || !zoneId}>{saving ? 'Sending...' : 'Send VC'}</button>
                  </div>
                ) : (
                  <>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Verification Code</label>
                    <input className="input-field" value={vc} onChange={e => setVc(e.target.value)} maxLength={4} style={{ width: '100%', marginBottom: 20, letterSpacing: 4, fontWeight: 700 }} placeholder="4-digit code" />
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setCodeSent(false)}>Back</button>
                      <button className="btn-primary" style={{ flex: 1 }} onClick={handleVerifyVc} disabled={saving || vc.length !== 4}>{saving ? 'Verifying...' : 'Verify'}</button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div style={{ 
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(6,182,212,0.06))', 
                  border: '1px solid var(--accent-primary)', 
                  borderRadius: 16, 
                  padding: 20, 
                  marginBottom: 20 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <img
                      src={mlbbProfile.avatar_url || 'https://via.placeholder.com/100'}
                      alt={mlbbProfile.mlbb_ign}
                      style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--accent-primary)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div className="font-display" style={{ fontSize: 20, fontWeight: 800 }}>{mlbbProfile.mlbb_ign}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: {serverId} ({zoneId})</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>Level {mlbbProfile.level}</span>
                        <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>{mlbbProfile.reg_country.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setMlbbProfile(null)}>✕ Not me</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveMlbb} disabled={saving}>{saving ? 'Saving...' : 'Confirm Changes'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Telegram Modal */}
      {editTg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="glass-card animate-fade-in-up" style={{ width: '100%', maxWidth: 440, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{p.telegram_username ? 'Edit' : 'Connect'} Telegram Identity</h3>
            
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--neon-red)', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
            
            {tgStep === 1 ? (
              !tgProfile ? (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Step 1: Enter your Telegram username. You can include the @ symbol.
                  </p>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Telegram Username</label>
                  <input className="input-field" value={tgUsername} onChange={e => setTgUsername(e.target.value)} placeholder="@username" style={{ width: '100%', marginBottom: 16 }} />
                  
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditTg(false)}>Cancel</button>
                    <button className="btn-primary" style={{ flex: 1 }} onClick={handleVerifyTgUsername} disabled={saving}>{saving ? 'Verifying...' : 'Verify'}</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 16 }}>
                    {tgProfile.profile_image ? (
                      <img src={tgProfile.profile_image} alt="Telegram Avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 12px', border: '3px solid var(--accent-primary)', display: 'block' }} />
                    ) : (
                      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: 'white', margin: '0 auto 12px', border: '3px solid var(--accent-primary)' }}>
                        {(tgProfile.display_name || tgUsername).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{tgProfile.display_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{tgUsername.startsWith('@') ? tgUsername : `@${tgUsername}`}</div>
                    {tgProfile.bio && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>"{tgProfile.bio}"</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setTgProfile(null)}>Re-enter</button>
                    <button className="btn-primary" style={{ flex: 1 }} onClick={handleConfirmTgProfile} disabled={saving}>{saving ? 'Saving...' : 'Confirm'}</button>
                  </div>
                </>
              )
            ) : (
              <>
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Step 2: Join the Official Group</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    To verify your identity and receive match notifications, you must join our official Telegram group using the account <b>{tgUsername.startsWith('@') ? tgUsername : `@${tgUsername}`}</b>.
                  </p>
                  {tgGroupLink ? (
                    <div style={{ marginBottom: 20 }}>
                      <div className="desktop-only" style={{ 
                        background: 'white', 
                        padding: 12, 
                        borderRadius: 12, 
                        display: 'inline-block', 
                        marginBottom: 16,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}>
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(tgGroupLink)}`} 
                          alt="Telegram Group QR Code"
                          style={{ width: 150, height: 150, display: 'block' }}
                        />
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <a href={tgGroupLink} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                          Join Telegram Group
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--neon-red)', fontSize: 13, marginBottom: 12 }}>Invite link unavailable. Please contact support.</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setTgStep(1)}>Back</button>
                  <button className="btn-primary" style={{ flex: 1, background: 'var(--neon-green)' }} onClick={handleCheckStatus} disabled={saving}>
                    {saving ? 'Checking...' : "I've Joined"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
