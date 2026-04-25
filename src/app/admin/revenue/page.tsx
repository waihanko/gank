'use client';

import { mockMatches, mockDashboardStats } from '@/lib/mock-data';
import { formatCurrency } from '@/lib/utils';

export default function AdminRevenuePage() {
  const completedMatches = mockMatches.filter((m) => m.status === 'COMPLETED');
  const totalCommission = completedMatches.reduce((s, m) => s + m.commission, 0);
  const avgCommission = completedMatches.length > 0 ? totalCommission / completedMatches.length : 0;

  // Simulated daily revenue data
  const dailyData = [
    { day: 'Mon', revenue: 4200, matches: 8 },
    { day: 'Tue', revenue: 3800, matches: 7 },
    { day: 'Wed', revenue: 5100, matches: 10 },
    { day: 'Thu', revenue: 4500, matches: 9 },
    { day: 'Fri', revenue: 6200, matches: 12 },
    { day: 'Sat', revenue: 8100, matches: 16 },
    { day: 'Sun', revenue: 7300, matches: 14 },
  ];

  const maxRevenue = Math.max(...dailyData.map((d) => d.revenue));

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
            {formatCurrency(mockDashboardStats.totalRevenue)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Lifetime earnings</div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Today&apos;s Revenue</div>
          <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: 'var(--neon-green)' }}>
            {formatCurrency(mockDashboardStats.todayRevenue)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>From {mockDashboardStats.todayMatches} matches</div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Avg Per Match</div>
          <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: 'var(--neon-cyan)' }}>
            {formatCurrency(Math.round(avgCommission || mockDashboardStats.totalRevenue / mockDashboardStats.totalMatches))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>5% commission rate</div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>This Week</div>
          <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: 'var(--neon-purple)' }}>
            {formatCurrency(dailyData.reduce((s, d) => s + d.revenue, 0))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{dailyData.reduce((s, d) => s + d.matches, 0)} matches</div>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="glass-card" style={{ padding: 28, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>📊 This Week&apos;s Revenue</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 200 }}>
          {dailyData.map((d) => {
            const height = (d.revenue / maxRevenue) * 160;
            return (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--neon-green)', fontWeight: 600 }}>
                  {formatCurrency(d.revenue)}
                </div>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 60,
                    height: height,
                    borderRadius: '8px 8px 4px 4px',
                    background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-secondary))',
                    transition: 'height 0.5s ease',
                    position: 'relative',
                    opacity: 0.85,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 'inherit',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.1), transparent)',
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{d.day}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.matches} games</div>
              </div>
            );
          })}
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
