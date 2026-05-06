'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PLATFORM_NAME } from '@/lib/constants';

type Step = 1 | 2 | 3;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // State 1
  const [serverId, setServerId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [vc, setVc] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [mlbbProfile, setMlbbProfile] = useState<{ mlbb_ign: string; avatar_url: string; level: number; rank_level: number; reg_country: string } | null>(null);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // State 2
  const [telegramUsername, setTelegramUsername] = useState('');
  const [tgProfile, setTgProfile] = useState<{ display_name: string; bio: string; type: string; profile_image: string } | null>(null);
  const [tgConfirmed, setTgConfirmed] = useState(false);

  // State 3
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  const stepLabels = ['MLBB Identity', 'Telegram', 'Security'];

  async function handleSendCode() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/send-vc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: serverId, zone_id: zoneId }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setCodeSent(true);
      setTimer(60);
    } catch {
      setError('Failed to send verification code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyVc() {
    if (!vc || vc.length !== 4) {
      setError('Please enter the 4-digit verification code');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-vc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: serverId, zone_id: zoneId, vc }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setMlbbProfile(data.data);
    } catch {
      setError('Failed to verify code. Try again.');
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

  function handleSkipTelegram() {
    setTelegramUsername('');
    setTgProfile(null);
    setTgConfirmed(false);
    setStep(3);
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
          vc,
          telegram_username: telegramUsername || '',
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
      {/* Minimal auth header */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-secondary)',
        padding: '0 24px', height: 60, display: 'flex', alignItems: 'center',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👻</div>
          <span className="font-display" style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2 }}>
            <span className="gradient-text">{PLATFORM_NAME.toUpperCase()}</span>
          </span>
        </Link>
      </nav>
      <div className="page-container" style={{ maxWidth: 500, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
            👻 <span className="gradient-text">Create Account</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
            3-step verification to join Good Game
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
                  background: step >= s ? 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))' : 'var(--bg-tertiary)',
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
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Enter your Mobile Legends Server ID and Zone ID to receive a verification code in your in-game mail.</p>

              {!mlbbProfile ? (
                <>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Server ID</label>
                  <input className="input-field" placeholder="e.g. 123456789" value={serverId} onChange={(e) => setServerId(e.target.value)} disabled={codeSent} style={{ marginBottom: 14 }} />

                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Zone ID</label>
                  <input className="input-field" placeholder="e.g. 2001" value={zoneId} onChange={(e) => setZoneId(e.target.value)} disabled={codeSent} style={{ marginBottom: 20 }} />

                  {!codeSent ? (
                    <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSendCode} disabled={loading || !serverId || !zoneId}>
                      {loading ? '⏳ Sending...' : '✉️ Send Verification Code'}
                    </button>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--neon-cyan)' }}>Verification Code</label>
                        {timer > 0 ? (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Resend in {timer}s</span>
                        ) : (
                          <button 
                            onClick={handleSendCode} 
                            disabled={loading}
                            style={{ background: 'none', border: 'none', color: 'var(--neon-yellow)', fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                          >
                            Resend Code
                          </button>
                        )}
                      </div>
                      <input className="input-field" placeholder="Enter 4-digit code" maxLength={4} value={vc} onChange={(e) => setVc(e.target.value)} style={{ marginBottom: 8, letterSpacing: 4, fontWeight: 700 }} />
                      
                      <div 
                        onClick={() => setShowInstructions(true)}
                        style={{ 
                          fontSize: 11, 
                          color: 'var(--text-muted)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 4, 
                          marginBottom: 20, 
                          cursor: 'pointer',
                          width: 'fit-content'
                        }}
                      >
                        📖 <span style={{ textDecoration: 'underline' }}>From In-Game Inbox (How to find?)</span>
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setCodeSent(false); setTimer(0); }}>← Back</button>
                        <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleVerifyVc} disabled={loading || !vc || vc.length !== 4}>
                          {loading ? '⏳ Verifying...' : 'Verify Code →'}
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* MLBB Profile Card */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(6,182,212,0.06))',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 14,
                    padding: 20,
                    marginBottom: 20,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                      <img
                        src={mlbbProfile.avatar_url || 'https://via.placeholder.com/100'}
                        alt={mlbbProfile.mlbb_ign}
                        style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--accent-primary)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{mlbbProfile.mlbb_ign}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: {serverId} ({zoneId})</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>Level {mlbbProfile.level}</span>
                          <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>{mlbbProfile.reg_country.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setMlbbProfile(null); setVc(''); }}>✕ Not me</button>
                    <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(2)}>
                      ✓ Yes, that&apos;s me
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* STATE 2: Telegram Identity */}
          {step === 2 && (
            <>
              <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13 }}>
                ✅ MLBB Account Verified: <strong style={{ color: 'var(--neon-green)' }}>{mlbbProfile?.mlbb_ign}</strong>
              </div>

              <div style={{ fontSize: 18, marginBottom: 4 }}>📱</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Telegram Identity</h3>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>Optional</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Link your Telegram to get battle room notifications and communicate with opponents easily.</p>

              {!tgProfile ? (
                <>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Telegram Username</label>
                  <input className="input-field" placeholder="@your_username" value={telegramUsername} onChange={(e) => setTelegramUsername(e.target.value)} style={{ marginBottom: 20 }} />

                  <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
                    <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleStep2} disabled={loading || !telegramUsername}>
                      {loading ? '⏳ Checking...' : '🔍 Verify'}
                    </button>
                  </div>
                  <button onClick={handleSkipTelegram} style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: '10px 0', textDecoration: 'underline' }}>
                    Skip this step
                  </button>
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
                ✅ Ready to finalize • {telegramUsername ? telegramUsername : 'No Telegram linked'}
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

      {/* Instructions Dialog */}
      {showInstructions && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20
        }} onClick={() => setShowInstructions(false)}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 24, maxWidth: 600, width: '100%', padding: 24,
            position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            animation: 'modalFadeIn 0.3s ease'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 className="font-display" style={{ fontSize: 20, fontWeight: 800 }}>
                📖 <span className="gradient-text">How to find code?</span>
              </h3>
              <button onClick={() => setShowInstructions(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-secondary)', marginBottom: 20 }}>
              <img 
                src="/mlbb_instructions.png" 
                alt="MLBB Instructions" 
                style={{ width: '100%', height: 'auto', display: 'block' }} 
              />
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <p style={{ marginBottom: 10 }}>1. Open <strong>Mobile Legends</strong> on your device.</p>
              <p style={{ marginBottom: 10 }}>2. Tap the <strong>Mail</strong> icon at the top of the main menu.</p>
              <p>3. Find the message titled <strong>&quot;Verification Code&quot;</strong> to get your 4-digit code.</p>
            </div>

            <button className="btn-primary" style={{ width: '100%', marginTop: 24, justifyContent: 'center' }} onClick={() => setShowInstructions(false)}>
              Got it!
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
