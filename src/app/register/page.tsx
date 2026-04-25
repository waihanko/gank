'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

type Step = 1 | 2 | 3;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // State 1
  const [serverId, setServerId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [mlbbIgn, setMlbbIgn] = useState('');
  const [region, setRegion] = useState('');

  // State 2
  const [telegramUsername, setTelegramUsername] = useState('');
  const [tgProfile, setTgProfile] = useState<{ display_name: string; bio: string; type: string; profile_image: string } | null>(null);
  const [tgConfirmed, setTgConfirmed] = useState(false);

  // State 3
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const stepLabels = ['MLBB Identity', 'Telegram', 'Security'];

  async function handleStep1() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-mlbb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: serverId, zone_id: zoneId }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setMlbbIgn(data.data.mlbb_ign);
      setRegion(data.data.region);
      setStep(2);
    } catch {
      setError('Failed to verify. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2() {
    setError('');
    const username = telegramUsername.startsWith('@') ? telegramUsername : `@${telegramUsername}`;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_username: username }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setTelegramUsername(username);
      setTgProfile(data.data);
    } catch {
      setError('Failed to verify. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleTgConfirm() {
    setTgConfirmed(true);
    setStep(3);
  }

  function handleTgReject() {
    setTgProfile(null);
    setTelegramUsername('');
  }

  async function handleStep3() {
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_id: serverId,
          zone_id: zoneId,
          mlbb_ign: mlbbIgn,
          telegram_username: telegramUsername,
          telegram_display_name: tgProfile?.display_name,
          telegram_bio: tgProfile?.bio,
          telegram_profile_image: tgProfile?.profile_image,
          password,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      // Save token
      localStorage.setItem('gr_token', data.data.token);
      localStorage.setItem('gr_user', JSON.stringify(data.data.user));
      window.location.href = '/matches';
    } catch {
      setError('Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 500, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
            👻 <span className="gradient-text">Create Account</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
            3-step verification to join Ghost Referee
          </p>
        </div>

        {/* Progress Steps */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: step >= s ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  color: step >= s ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.3s',
                }}
              >
                {step > s ? '✓' : s}
              </div>
              <span style={{ fontSize: 12, color: step === s ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: step === s ? 600 : 400 }}>
                {stepLabels[s - 1]}
              </span>
              {s < 3 && <div style={{ width: 30, height: 2, background: step > s ? 'var(--accent-primary)' : 'var(--border-secondary)', borderRadius: 1 }} />}
            </div>
          ))}
        </div>

        <div className="glass-card" style={{ padding: 28 }}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--neon-red)' }}>
              ⚠️ {error}
            </div>
          )}

          {/* STATE 1: MLBB Identity */}
          {step === 1 && (
            <>
              <div style={{ fontSize: 18, marginBottom: 4 }}>🎮</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>MLBB Identity Verification</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Enter your Mobile Legends Server ID and Zone ID</p>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Server ID</label>
              <input className="input-field" placeholder="e.g. 123456789" value={serverId} onChange={(e) => setServerId(e.target.value)} style={{ marginBottom: 14 }} />

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Zone ID</label>
              <input className="input-field" placeholder="e.g. 2001" value={zoneId} onChange={(e) => setZoneId(e.target.value)} style={{ marginBottom: 20 }} />

              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleStep1} disabled={loading || !serverId || !zoneId}>
                {loading ? '⏳ Verifying...' : '🔍 Verify MLBB Account'}
              </button>
            </>
          )}

          {/* STATE 2: Telegram Identity */}
          {step === 2 && (
            <>
              <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13 }}>
                ✅ MLBB Account Found: <strong style={{ color: 'var(--neon-green)' }}>{mlbbIgn}</strong> ({region})
              </div>

              <div style={{ fontSize: 18, marginBottom: 4 }}>📱</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Telegram Identity</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Enter your Telegram username for battle room communication</p>

              {!tgProfile ? (
                <>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Telegram Username</label>
                  <input className="input-field" placeholder="@your_username" value={telegramUsername} onChange={(e) => setTelegramUsername(e.target.value)} style={{ marginBottom: 20 }} />

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
                    <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleStep2} disabled={loading || !telegramUsername}>
                      {loading ? '⏳ Checking...' : '🔍 Verify'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Telegram Profile Card */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(0,136,204,0.08), rgba(124,58,237,0.06))',
                    border: '1px solid rgba(0,136,204,0.2)',
                    borderRadius: 14,
                    padding: 20,
                    marginBottom: 20,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                      {tgProfile.profile_image ? (
                        <img
                          src={tgProfile.profile_image}
                          alt={tgProfile.display_name}
                          style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(0,136,204,0.4)' }}
                        />
                      ) : (
                        <div style={{
                          width: 56, height: 56, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0088cc, #6c3aed)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 22, fontWeight: 700, color: 'white',
                        }}>
                          {tgProfile.display_name.charAt(0)}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{tgProfile.display_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{telegramUsername}</div>
                      </div>
                      <div style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: tgProfile.type === 'user' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: tgProfile.type === 'user' ? 'var(--neon-green)' : 'var(--neon-red)',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}>
                        {tgProfile.type}
                      </div>
                    </div>
                    {tgProfile.bio && (
                      <div style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 8,
                        borderLeft: '3px solid rgba(0,136,204,0.4)',
                      }}>
                        &ldquo;{tgProfile.bio}&rdquo;
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, textAlign: 'center' }}>
                    Is this your Telegram account?
                  </p>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn-danger" style={{ flex: 1 }} onClick={handleTgReject}>✕ Not me</button>
                    <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleTgConfirm}>
                      ✓ Yes, that&apos;s me
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* STATE 3: Account Security */}
          {step === 3 && (
            <>
              <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13 }}>
                ✅ {mlbbIgn} • {telegramUsername}
              </div>

              <div style={{ fontSize: 18, marginBottom: 4 }}>🔒</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Account Security</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Set a strong password for your account</p>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Password</label>
              <input className="input-field" type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 14 }} />

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Confirm Password</label>
              <input className="input-field" type="password" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ marginBottom: 20 }} />

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(2)}>← Back</button>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleStep3} disabled={loading || !password || !confirmPassword}>
                  {loading ? '⏳ Creating...' : '🚀 Create Account'}
                </button>
              </div>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-muted)' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>Login →</Link>
        </p>
      </div>
    </>
  );
}
