'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PLATFORM_NAME } from '@/lib/constants';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [serverId, setServerId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login/mlbb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: serverId, zone_id: zoneId, password }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }

      localStorage.setItem('gr_token', data.data.token);
      localStorage.setItem('gr_user', JSON.stringify(data.data.user));
      if (window.innerWidth < 768) {
        window.location.href = '/m';
      } else {
        window.location.href = '/matches';
      }
    } catch {
      setError('Login failed. Try again.');
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
          <div style={{ fontSize: 48, marginBottom: 12 }}>👻</div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
            <span className="gradient-text">Welcome Back</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>Login to Good Game with your MLBB Account</p>
        </div>

        <div className="glass-card" style={{ padding: 28 }}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--neon-red)' }}>
              ⚠️ {error}
            </div>
          )}

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>MLBB Server ID</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. 123456789"
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            style={{ marginBottom: 16 }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>MLBB Zone ID</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. 2001"
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            style={{ marginBottom: 16 }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />

          <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            <span>Password</span>
            <Link href="/forgot-password" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Forgot Password?</Link>
          </label>
          <input
            type="password"
            className="input-field"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: 24 }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />

          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleLogin} disabled={loading || !serverId || !zoneId || !password}>
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
