'use client';

import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatRelativeTime, shortenId } from '@/lib/utils';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    const token = localStorage.getItem('gr_admin_token');
    try {
      const [statsRes, matchesRes, disputesRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/admin/matches`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/admin/disputes`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (statsRes.status === 401 || statsRes.status === 403) {
        localStorage.removeItem('gr_admin_token');
        window.location.href = '/admin/login';
        return;
      }

      const statsData = await statsRes.json();
      const matchesData = await matchesRes.json();
      const disputesData = await disputesRes.json();

      if (statsData.success) setStats(statsData.data);
      if (matchesData.success) setRecentMatches(matchesData.data.slice(0, 5));
      if (disputesData.success) setDisputes(disputesData.data.filter((d: any) => d.status === 'PENDING'));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: 40 }}>
        Loading dashboard...
      </div>
    );
  }

  const STAT_CARDS = [
    { label: 'Total Users', value: stats?.totalUsers?.toString() || '0', icon: '👥', color: 'var(--accent-primary)' },
    { label: 'Total Matches', value: stats?.totalMatches?.toString() || '0', icon: '\u2694\ufe0f', color: 'var(--accent-secondary)' },
    { label: 'Active Now', value: stats?.activeMatches?.toString() || '0', icon: '🔥', color: 'var(--neon-red)' },
    { label: 'Total Revenue', value: formatCurrency(stats?.totalRevenue || 0), icon: '💰', color: 'var(--neon-green)' },
    { label: 'Today Matches', value: stats?.todayMatches?.toString() || '0', icon: '📅', color: 'var(--neon-yellow)' },
    { label: 'Today Revenue', value: formatCurrency(stats?.todayRevenue || 0), icon: '💸', color: 'var(--neon-purple)' },
    { label: 'Available Rooms', value: stats?.rooms?.AVAILABLE?.toString() || '0', icon: '💬', color: 'var(--neon-cyan)' },
    { label: 'Pending Disputes', value: stats?.pendingDisputes?.toString() || '0', icon: '\u26a0\ufe0f', color: (stats?.pendingDisputes || 0) > 0 ? 'var(--neon-red)' : 'var(--neon-green)' },
  ];

  return (
    <div className="page-container">
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
          📊 <span className="gradient-text">Dashboard</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Platform overview and real-time metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {STAT_CARDS.map((card) => (
          <div key={card.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  {card.label}
                </div>
                <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: card.color }}>
                  {card.value}
                </div>
              </div>
              <div style={{ fontSize: 28, opacity: 0.6 }}>{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Recent Matches */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>⚔️ Recent Matches</h3>
            <Link href="/admin/matches" className="btn-secondary btn-sm">View All</Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Players</th>
                <th>Stake</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentMatches.map((match) => (
                <tr key={match.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{shortenId(match.id)}</td>
                  <td>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {match.challenger?.username}
                      <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>vs</span>
                      {match.opponent?.username || '—'}
                    </span>
                  </td>
                  <td className="font-display" style={{ fontWeight: 600, color: 'var(--neon-yellow)', fontSize: 13 }}>
                    {formatCurrency(match.stake_amount)}
                  </td>
                  <td><StatusBadge status={match.status} size="sm" /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatRelativeTime(match.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Disputes & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Pending Disputes */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>⚠️ Pending Disputes</h3>
              <span
                style={{
                  background: disputes.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                  color: disputes.length > 0 ? 'var(--neon-red)' : 'var(--neon-green)',
                  padding: '2px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {disputes.length}
              </span>
            </div>
            <div style={{ padding: 16 }}>
              {disputes.map((dispute: any) => (
                <div
                  key={dispute.id}
                  style={{
                    padding: 14,
                    background: 'rgba(244,63,94,0.05)',
                    borderRadius: 10,
                    border: '1px solid rgba(244,63,94,0.15)',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--neon-red)' }}>
                    Match #{dispute.match_id}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                    {dispute.reason}
                  </div>
                  <Link href="/admin/disputes" className="btn-danger btn-sm">
                    Review →
                  </Link>
                </div>
              ))}
              {disputes.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                  ✅ No pending disputes
                </div>
              )}
            </div>
          </div>

          {/* Revenue This Month */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Revenue Breakdown
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total Commissions</span>
                <span className="font-display" style={{ color: 'var(--neon-green)', fontWeight: 700 }}>{formatCurrency(stats?.totalRevenue || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Today</span>
                <span className="font-display" style={{ color: 'var(--neon-yellow)', fontWeight: 700 }}>{formatCurrency(stats?.todayRevenue || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Avg Per Match</span>
                <span className="font-display" style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>{formatCurrency(Math.round((stats?.totalRevenue || 0) / (stats?.totalMatches || 1)))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
