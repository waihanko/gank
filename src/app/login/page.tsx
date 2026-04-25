'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function LoginPage() {
  const [method, setMethod] = useState<'telegram' | 'mlbb'>('telegram');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Telegram login
  const [tgUsername, setTgUsername] = useState('');
  // MLBB login
  const [serverId, setServerId] = useState('');
  const [zoneId, setZoneId] = useState('');
  // Shared
  const [password, setPassword] = useState('');

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      const endpoint = method === 'telegram' ? '/api/auth/login/telegram' : '/api/auth/login/mlbb';
      const body = method === 'telegram'
        ? { telegram_username: tgUsername.startsWith('@') ? tgUsername : `@${tgUsername}`, password }
        : { server_id: serverId, zone_id: zoneId, password };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }

      localStorage.setItem('gr_token', data.data.token);
      localStorage.setItem('gr_user', JSON.stringify(data.data.user));
      window.location.href = '/matches';
    } catch {
      setError('Login failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 440, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👻</div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
            <span className="gradient-text">Welcome Back</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>Login to Ghost Referee</p>
        </div>

        <div className="glass-card" style={{ padding: 28 }}>
          {/* Method Toggle */}
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-secondary)', marginBottom: 24 }}>
            <button
              onClick={() => setMethod('telegram')}
              style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: method === 'telegram' ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'transparent',
                color: method === 'telegram' ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              📱 Telegram
            </button>
            <button
              onClick={() => setMethod('mlbb')}
              style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: method === 'mlbb' ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'transparent',
                color: method === 'mlbb' ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              🎮 MLBB ID
            </button>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--neon-red)' }}>
              ⚠️ {error}
            </div>
          )}

          {method === 'telegram' && (
            <>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Telegram Username</label>
              <input className="input-field" placeholder="@your_username" value={tgUsername} onChange={(e) => setTgUsername(e.target.value)} style={{ marginBottom: 14 }} />
            </>
          )}

          {method === 'mlbb' && (
            <>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Server ID</label>
              <input className="input-field" placeholder="e.g. 123456789" value={serverId} onChange={(e) => setServerId(e.target.value)} style={{ marginBottom: 14 }} />

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Zone ID</label>
              <input className="input-field" placeholder="e.g. 2001" value={zoneId} onChange={(e) => setZoneId(e.target.value)} style={{ marginBottom: 14 }} />
            </>
          )}

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Password</label>
          <input className="input-field" type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 24 }} />

          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14 }} onClick={handleLogin} disabled={loading}>
            {loading ? '⏳ Logging in...' : '🚀 Login'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-muted)' }}>
          Don&apos;t have an account? <Link href="/register" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>Register →</Link>
        </p>
      </div>
    </>
  );
}
