'use client';

import { formatCurrency, formatDate } from '@/lib/utils';
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminRevenuePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRevenue();
  }, []);

  async function fetchRevenue() {
    setLoading(true);
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/revenue`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('gr_admin_token');
        window.location.href = '/admin/login';
        return;
      }
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error(e);
      window.location.href = '/admin/error?message=The revenue analytics service is currently unavailable. Please check your network connection.';
    }
    setLoading(false);
  }

  if (loading) return <div className="page-container">Loading revenue data...</div>;

  const items = data?.items || [];
  const totalRevenue = data?.total || 0;
  const avgCommission = items.length > 0 ? totalRevenue / items.length : 0;


  return (
    <div className="page-container">
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
          💰 <span className="gradient-text">Revenue Analytics</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Platform earnings from the 5% commission model
        </p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div className="stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Total Revenue</div>
          <div className="font-display gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>
            {formatCurrency(totalRevenue)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Lifetime earnings</div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Avg Per Match</div>
          <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: 'var(--neon-cyan)' }}>
            {formatCurrency(Math.round(avgCommission))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>5% commission rate</div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Transactions</div>
          <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: 'var(--neon-purple)' }}>
            {items.length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Total commission entries</div>
        </div>
      </div>

      {/* Recent Revenue List */}
      <div className="glass-card" style={{ padding: 28, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>💸 Recent Revenue Transactions</h3>
        <div className="glass-card" style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Match ID</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 20).map((item: any) => (
                <tr key={item.id}>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatDate(item.created_at)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--neon-yellow)' }}>{item.match_id}</td>
                  <td className="font-display" style={{ fontWeight: 800, color: 'var(--neon-green)', fontSize: 14 }}>
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No revenue data yet</div>
          )}
        </div>
      </div>

      {/* Commission Breakdown */}
      <div className="glass-card" style={{ padding: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>💎 Commission Model</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>How it works</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <span>1.</span>
                <span>Two players each stake an equal amount (e.g. 5,000 MMK each)</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <span>2.</span>
                <span>Total pot = 10,000 MMK</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <span>3.</span>
                <span>Platform takes 5% commission = 500 MMK</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <span>4.</span>
                <span>Winner receives 95% = 9,500 MMK</span>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Penalty Fees</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <div>
                <span style={{ color: 'var(--neon-green)' }}>No Ready Click:</span> 100% refund, no fee
              </div>
              <div>
                <span style={{ color: 'var(--neon-yellow)' }}>No Submission (15min timeout):</span> Room Occupancy Fee of 500 MMK each
              </div>
              <div>
                <span style={{ color: 'var(--neon-red)' }}>Malicious Lying:</span> Permanent ban + full payout to honest player
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
