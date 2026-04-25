const fs = require('fs');

const content = `'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ProfilePage() {
  const { user, token, isLoggedIn, logout, loading, refreshUser } = useAuth();
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
  const [tgProfile, setTgProfile] = useState<{ display_name: string; bio: string; type: string; profile_image: string } | null>(null);

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      window.location.href = '/login';
      return;
    }
    if (token) {
      fetch(\`\${API_URL}/api/auth/me\`, { headers: { Authorization: \`Bearer \${token}\` } })
        .then(r => r.json())
        .then(d => { 
          if (d.success) setProfile(d.data);
        })
        .catch(() => {});
    }
  }, [token, isLoggedIn, loading]);

  async function handleVerifyMlbb() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(\`\${API_URL}/api/auth/verify-mlbb\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: serverId, zone_id: zoneId }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setMlbbIgn(data.data.mlbb_ign);
    } catch {
      setError('Failed to verify.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMlbb() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(\`\${API_URL}/api/users/profile\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({ mlbb_server_id: serverId, mlbb_zone_id: zoneId, mlbb_ign: mlbbIgn })
      });
      const data = await res.json();
      if (data.success) {
        alert('MLBB Info updated!');
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

  async function handleVerifyTg() {
    setError('');
    setSaving(true);
    const uname = tgUsername.startsWith('@') ? tgUsername : \`@\${tgUsername}\`;
    try {
      const res = await fetch(\`\${API_URL}/api/auth/verify-telegram\`, {
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

  async function handleSaveTg() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(\`\${API_URL}/api/users/profile\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({ 
          telegram_username: tgUsername, 
          telegram_display_name: tgProfile?.display_name,
          telegram_bio: tgProfile?.bio,
          telegram_profile_image: tgProfile?.profile_image 
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Telegram Info updated!');
        setEditTg(false);
        refreshUser();
        setProfile(data.data);
      } else {
        setError(data.error || 'Failed to update Telegram.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="font-display gradient-text" style={{ fontSize: 20 }}>Loading...</div></div>;

  const p = profile || user;
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
            <span className="gradient-text">{p.telegram_display_name as string || p.mlbb_ign as string || p.username as string}</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            {p.telegram_username as string} • {p.mlbb_ign as string}
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
              <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Won</span><div style={{ fontSize: 16, fontWeight: 600, color: 'var(--neon-green)' }}>{Number(wallet.total_won || 0).toLocaleString()} MMK</div></div>
              <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Lost</span><div style={{ fontSize: 16, fontWeight: 600, color: 'var(--neon-red)' }}>{Number(wallet.total_lost || 0).toLocaleString()} MMK</div></div>
            </div>
          </div>
        )}

        {/* Account Info */}
        <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>🎮 Account Details</h3>
          <div style={{ fontSize: 11, color: 'var(--neon-yellow)', marginBottom: 16 }}>
            ⚠️ Note: Telegram Username and MLBB Game ID can only be changed once every 30 days.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Telegram Section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Telegram Username</span>
                <button 
                  className="btn-secondary btn-sm" 
                  onClick={() => {
                    setTgUsername((p.telegram_username as string)?.replace('@', '') || '');
                    setTgProfile(null);
                    setError('');
                    setEditTg(true);
                  }}>
                  Edit
                </button>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p.telegram_username as string || '—'}</div>
            </div>

            {/* MLBB Section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Mobile Legends ID</span>
                <button 
                  className="btn-secondary btn-sm" 
                  onClick={() => {
                    setServerId(p.mlbb_server_id as string || '');
                    setZoneId(p.mlbb_zone_id as string || '');
                    setMlbbIgn('');
                    setError('');
                    setEditMlbb(true);
                  }}>
                  Edit
                </button>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>IGN</span><div style={{ fontSize: 14, fontWeight: 600 }}>{p.mlbb_ign as string || '—'}</div></div>
                <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Server ID</span><div style={{ fontSize: 14, fontWeight: 600 }}>{p.mlbb_server_id as string || '—'}</div></div>
                <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Zone ID</span><div style={{ fontSize: 14, fontWeight: 600 }}>{p.mlbb_zone_id as string || '—'}</div></div>
              </div>
            </div>

          </div>
        </div>
      </div>
      <Footer />

      {/* Edit MLBB Modal */}
      {editMlbb && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="glass-card" style={{ width: 400, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Edit MLBB Identity</h3>
            
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--neon-red)', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
            
            {!mlbbIgn ? (
              <>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Server ID</label>
                <input className="input-field" value={serverId} onChange={e => setServerId(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
                
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Zone ID</label>
                <input className="input-field" value={zoneId} onChange={e => setZoneId(e.target.value)} style={{ width: '100%', marginBottom: 16 }} />
                
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditMlbb(false)}>Cancel</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleVerifyMlbb} disabled={saving}>{saving ? 'Verifying...' : 'Verify'}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--neon-green)', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--neon-green)', fontWeight: 700, marginBottom: 8 }}>✓ Verified Successfully</div>
                  <div className="font-display" style={{ fontSize: 20, fontWeight: 800 }}>{mlbbIgn}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Server ID: {serverId} • Zone ID: {zoneId}</div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setMlbbIgn('')}>Re-enter</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveMlbb} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Telegram Modal */}
      {editTg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="glass-card" style={{ width: 400, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Edit Telegram Identity</h3>
            
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--neon-red)', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
            
            {!tgProfile ? (
              <>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Telegram Username (without @)</label>
                <input className="input-field" value={tgUsername} onChange={e => setTgUsername(e.target.value.replace('@', ''))} style={{ width: '100%', marginBottom: 16 }} />
                
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditTg(false)}>Cancel</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleVerifyTg} disabled={saving}>{saving ? 'Verifying...' : 'Verify'}</button>
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
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{tgUsername.startsWith('@') ? tgUsername : \`@\${tgUsername}\`}</div>
                  {tgProfile.bio && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>"{tgProfile.bio}"</div>}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setTgProfile(null)}>Re-enter</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveTg} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
`;

fs.writeFileSync('src/app/profile/page.tsx', content);
