'use client';

import { useEffect, useState } from 'react';
import StatusBadge from '@/components/StatusBadge';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface DisputeMatch {
  id: string;
  challenger_id: string;
  opponent_id: string | null;
  stake_amount: string;
  total_pot: string;
  commission: string;
  status: string;
  challenger_claim: string | null;
  opponent_claim: string | null;
  created_at: string;
  challenger: { id: string; username: string; mlbb_ign: string };
  opponent: { id: string; username: string; mlbb_ign: string } | null;
}

interface Dispute {
  id: string;
  match_id: string;
  reported_by_id: string;
  reason: string;
  status: string;
  resolution: string | null;
  created_at: string;
  match: DisputeMatch;
  reporter: { id: string; username: string };
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  async function fetchDisputes() {
    try {
      const token = localStorage.getItem('gr_admin_token');
      const res = await fetch(`${API_URL}/api/admin/disputes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('gr_admin_token');
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (data.success) {
        setDisputes(data.data);
      } else {
        setError(data.error || 'Failed to load disputes');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDisputes(); }, []);

  async function handleResolve(disputeId: string, winnerId: string | null, resolution: string, action?: string) {
    setResolving(disputeId);
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('gr_admin_token');
      const res = await fetch(`${API_URL}/api/admin/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ winner_id: winnerId, resolution, action }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Dispute resolved: ${resolution}`);
        await fetchDisputes();
        setSelectedDispute(null);
      } else {
        setError(data.error || 'Resolution failed');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setResolving(null);
    }
  }

  const pendingCount = disputes.filter(d => d.status === 'PENDING').length;
  const resolvedCount = disputes.filter(d => d.status === 'RESOLVED').length;

  return (
    <div className="page-container">
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
          ⚠️ <span className="gradient-text">Dispute Resolution</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Review and resolve flagged matches
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div className="stat-card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: pendingCount > 0 ? 'var(--neon-red)' : 'var(--text-muted)' }}>{pendingCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 4 }}>Pending</div>
        </div>
        <div className="stat-card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--neon-green)' }}>{resolvedCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 4 }}>Resolved</div>
        </div>
        <div className="stat-card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{disputes.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 4 }}>Total</div>
        </div>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '12px 20px', marginBottom: 16, color: 'var(--neon-green)', fontSize: 14, fontWeight: 600 }}>
          ✅ {successMsg}
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 20px', marginBottom: 16, color: 'var(--neon-red)', fontSize: 14 }}>
          ❌ {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 18, color: 'var(--text-muted)' }}>Loading disputes...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {disputes.map((dispute) => {
            const match = dispute.match;
            const isExpanded = selectedDispute === dispute.id;

            return (
              <div
                key={dispute.id}
                className="glass-card"
                style={{
                  padding: 0,
                  borderColor: dispute.status === 'PENDING' ? 'rgba(239,68,68,0.3)' : undefined,
                  overflow: 'hidden',
                }}
              >
                {/* Header */}
                <div
                  onClick={() => setSelectedDispute(isExpanded ? null : dispute.id)}
                  style={{
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderBottom: isExpanded ? '1px solid var(--border-secondary)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: dispute.status === 'PENDING' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                      }}
                    >
                      {dispute.status === 'PENDING' ? '🔴' : '✅'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {match.challenger?.username || '?'} vs {match.opponent?.username || '?'}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{dispute.reason}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--neon-gold)' }}>
                      {Number(match.stake_amount).toLocaleString()} MMK
                    </span>
                    <span
                      style={{
                        background: dispute.status === 'PENDING' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                        color: dispute.status === 'PENDING' ? 'var(--neon-red)' : 'var(--neon-green)',
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      {dispute.status}
                    </span>
                    <span style={{ fontSize: 18, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && match && (
                  <div style={{ padding: 24 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
                      {/* Challenger */}
                      <div className="stat-card">
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Challenger</div>
                        <div style={{ fontWeight: 700 }}>{match.challenger?.username}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{match.challenger?.mlbb_ign}</div>
                        <div style={{ marginTop: 8 }}>
                          <span style={{
                            fontSize: 12,
                            color: match.challenger_claim === 'WON' ? 'var(--neon-green)' : match.challenger_claim === 'LOST' ? 'var(--neon-red)' : 'var(--text-muted)',
                            fontWeight: 600,
                            background: match.challenger_claim === 'WON' ? 'rgba(34,197,94,0.15)' : match.challenger_claim === 'LOST' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                            padding: '3px 10px',
                            borderRadius: 12,
                          }}>
                            Claims: {match.challenger_claim || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Match Info */}
                      <div className="stat-card" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Match Info</div>
                        <div className="font-display gradient-text-gold" style={{ fontSize: 22, fontWeight: 700 }}>
                          {Number(match.total_pot).toLocaleString()} MMK
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          Stake: {Number(match.stake_amount).toLocaleString()} each
                        </div>
                        <div style={{ marginTop: 6 }}><StatusBadge status={match.status} size="sm" /></div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                          {new Date(match.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Opponent */}
                      <div className="stat-card">
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Opponent</div>
                        <div style={{ fontWeight: 700 }}>{match.opponent?.username || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{match.opponent?.mlbb_ign || '—'}</div>
                        <div style={{ marginTop: 8 }}>
                          <span style={{
                            fontSize: 12,
                            color: match.opponent_claim === 'WON' ? 'var(--neon-green)' : match.opponent_claim === 'LOST' ? 'var(--neon-red)' : 'var(--text-muted)',
                            fontWeight: 600,
                            background: match.opponent_claim === 'WON' ? 'rgba(34,197,94,0.15)' : match.opponent_claim === 'LOST' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                            padding: '3px 10px',
                            borderRadius: 12,
                          }}>
                            Claims: {match.opponent_claim || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Resolution Actions — only show for PENDING disputes */}
                    {dispute.status === 'PENDING' && (
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>🧑‍⚖️ Resolution Actions</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <button
                            className="btn-success"
                            disabled={resolving === dispute.id}
                            onClick={() => handleResolve(dispute.id, match.challenger_id, `Awarded to ${match.challenger?.username}`)}
                          >
                            {resolving === dispute.id ? '...' : `🏆 Award to ${match.challenger?.username}`}
                          </button>
                          {match.opponent && (
                            <button
                              className="btn-success"
                              disabled={resolving === dispute.id}
                              onClick={() => handleResolve(dispute.id, match.opponent!.id, `Awarded to ${match.opponent!.username}`)}
                            >
                              {resolving === dispute.id ? '...' : `🏆 Award to ${match.opponent?.username}`}
                            </button>
                          )}
                          <button
                            className="btn-secondary"
                            disabled={resolving === dispute.id}
                            onClick={() => handleResolve(dispute.id, null, 'Voided and refunded both players')}
                          >
                            ↩️ Void &amp; Refund Both
                          </button>
                          <button
                            disabled={resolving === dispute.id}
                            onClick={() => handleResolve(dispute.id, null, 'Voided — stakes collected by platform', 'void_collect')}
                            style={{
                              background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(239,68,68,0.2))',
                              border: '1px solid rgba(234,179,8,0.4)',
                              color: '#f59e0b',
                              padding: '10px 20px',
                              borderRadius: 10,
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: resolving === dispute.id ? 'not-allowed' : 'pointer',
                              opacity: resolving === dispute.id ? 0.5 : 1,
                              transition: 'all 0.2s',
                            }}
                          >
                            {resolving === dispute.id ? '...' : '💰 Void & Collect'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Show resolution if resolved */}
                    {dispute.status === 'RESOLVED' && dispute.resolution && (
                      <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid rgba(34,197,94,0.2)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neon-green)', marginBottom: 4 }}>✅ Resolved</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{dispute.resolution}</div>
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      💡 Review screenshots and chat archives before resolving. Malicious lying results in permanent ban per platform policy.
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {disputes.length === 0 && (
            <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>No Disputes</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>All matches are running smoothly</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
