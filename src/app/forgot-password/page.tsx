'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PLATFORM_NAME } from '@/lib/constants';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [serverId, setServerId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [vc, setVc] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [codeSent, setCodeSent] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  async function handleSendCode() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password/send-vc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: serverId, zone_id: zoneId }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setCodeSent(true);
      setSuccessMsg(data.message);
    } catch {
      setError('Failed to send verification code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_id: serverId,
          zone_id: zoneId,
          vc,
          password
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setResetComplete(true);
    } catch {
      setError('Password reset failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-secondary)',
        padding: '0 24px', height: 60, display: 'flex', alignItems: 'center',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👻</div>
          <span className="font-display" style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2 }}>
            <span className="gradient-text">{PLATFORM_NAME.toUpperCase()}</span>
          </span>
        </Link>
      </nav>
      <div className="page-container" style={{ maxWidth: 440, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
            <span className="gradient-text">Forgot Password</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
            {!resetComplete ? 'Reset your password using MLBB Verification Code' : 'Password reset successful'}
          </p>
        </div>

        <div className="glass-card" style={{ padding: 28 }}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--neon-red)' }}>
              ⚠️ {error}
            </div>
          )}

          {successMsg && !resetComplete && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--neon-green)' }}>
              ✅ {successMsg}
            </div>
          )}

          {resetComplete ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>All Set!</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>Your password has been reset successfully.</p>
              <Link href="/login" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', width: '100%', justifyContent: 'center' }}>
                Go to Login
              </Link>
            </div>
          ) : !codeSent ? (
            <>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>MLBB Server ID</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 123456789"
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
                style={{ marginBottom: 16 }}
              />
              
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>MLBB Zone ID</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 2001"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                style={{ marginBottom: 24 }}
              />

              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSendCode} disabled={loading || !serverId || !zoneId}>
                {loading ? '⏳ Sending...' : '✉️ Send Verification Code'}
              </button>
            </>
          ) : (
            <>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--neon-cyan)', marginBottom: 6 }}>Verification Code (From In-Game Mail)</label>
              <input 
                className="input-field" 
                placeholder="Enter 4-digit code" 
                maxLength={4} 
                value={vc} 
                onChange={(e) => setVc(e.target.value)} 
                style={{ marginBottom: 20, letterSpacing: 4, fontWeight: 700 }} 
              />

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>New Password</label>
              <input 
                className="input-field" 
                type="password" 
                placeholder="Min 6 characters" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                style={{ marginBottom: 14 }} 
              />

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Confirm New Password</label>
              <input 
                className="input-field" 
                type="password" 
                placeholder="Re-enter new password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                style={{ marginBottom: 24 }} 
              />

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setCodeSent(false)}>← Back</button>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleResetPassword} disabled={loading || !vc || vc.length !== 4 || !password || !confirmPassword}>
                  {loading ? '⏳ Resetting...' : '🔐 Reset Password'}
                </button>
              </div>
            </>
          )}
        </div>

        {!resetComplete && (
          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-muted)' }}>
            Remembered your password? <Link href="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>Login →</Link>
          </p>
        )}
      </div>
    </>
  );
}
