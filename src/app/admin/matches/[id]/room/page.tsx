'use client';

import { useEffect, useState, use } from 'react';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminMatchRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = use(params);
  const router = useRouter();
  
  const [match, setMatch] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [matchId]);

  async function fetchData() {
    const token = localStorage.getItem('gr_admin_token');
    try {
      // 1. Fetch match details
      const matchRes = await fetch(`${API_URL}/api/admin/matches`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (matchRes.status === 401 || matchRes.status === 403) {
        localStorage.removeItem('gr_admin_token');
        window.location.href = '/admin/login';
        return;
      }
      const matchData = await matchRes.json();
      if (matchData.success) {
        const found = matchData.data.find((m: any) => m.id === matchId);
        if (found) setMatch(found);
      }

      // 2. Fetch messages
      const msgRes = await fetch(`${API_URL}/api/admin/matches/${matchId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const msgData = await msgRes.json();
      if (msgData.success) setMessages(msgData.data);

      // 3. Fetch evidence screenshots
      const ssRes = await fetch(`${API_URL}/api/admin/matches/${matchId}/screenshots`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const ssData = await ssRes.json();
      if (ssData.success) setScreenshots(ssData.data);
    } catch (err) {
      console.error('Failed to fetch battle room data:', err);
      window.location.href = '/admin/error?message=The battle room logs are currently inaccessible. Please check your network connection.';
    }
    setLoading(false);
  }

  async function handleResolve(disputeId: string, winnerId: string | null, resolution: string, action?: string) {
    setResolving(disputeId);
    setSuccessMsg('');
    setError('');
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
        await fetchData();
      } else {
        setError(data.error || 'Resolution failed');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setResolving(null);
    }
  }

  if (loading) return <div className="page-container">Loading room record...</div>;
  if (!match) return <div className="page-container">Match not found</div>;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'DISPUTED':
        return { 
          color: 'var(--neon-red)', 
          background: 'rgba(239, 68, 68, 0.15)', 
          border: '1px solid var(--neon-red)',
          textShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
          padding: '4px 12px',
          borderRadius: '20px',
          fontWeight: 900,
          animation: 'pulse 2s infinite'
        };
      case 'COMPLETED':
        return { color: 'var(--neon-green)', fontWeight: 700 };
      case 'VOIDED':
      case 'CANCELLED':
        return { color: 'var(--text-muted)', fontWeight: 700 };
      default:
        return { color: 'var(--neon-cyan)', fontWeight: 700 };
    }
  };

  return (
    <div className="page-container">
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <button 
          className="btn-secondary btn-sm" 
          onClick={() => router.push(`/admin/matches/${matchId}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          ← Back to Match
        </button>
        <div style={{ textAlign: 'right' }}>
          <h1 className="font-display" style={{ fontSize: 24, fontWeight: 900 }}>Battle Room Record</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'monospace' }}>INST_ID: {matchId}</p>
        </div>
      </div>

      {/* Lightbox for evidence images */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, cursor: 'zoom-out'
          }}
        >
          <img src={`${API_URL}${lightbox}`} alt="Evidence" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 16, boxShadow: '0 0 80px rgba(0,0,0,0.8)' }} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, alignItems: 'stretch' }}>
        {/* Chat History */}
        <div style={{ position: 'relative', height: '100%' }}>
          <div className="glass-card" style={{ position: 'absolute', inset: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-secondary)', background: 'rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 16, fontWeight: 800 }}>Conversation Log</h2>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>
              {messages.length} Messages
            </span>
          </div>
          
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
                  <div style={{ color: 'var(--text-muted)' }}>No messages recorded for this match.</div>
                </div>
              ) : (
                messages.map((msg) => {
                const isSystem = msg.type === 'system';
                const isChallenger = msg.sender_id === match.challenger_id;
                
                if (isSystem) {
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
                      <div style={{ 
                        background: 'rgba(255,255,255,0.03)', 
                        padding: '8px 20px', 
                        borderRadius: 30, 
                        fontSize: 12, 
                        color: 'var(--text-muted)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        textAlign: 'center',
                        fontStyle: 'italic'
                      }}>
                        ⚙️ {msg.content}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: isChallenger ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    alignSelf: isChallenger ? 'flex-start' : 'flex-end'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexDirection: isChallenger ? 'row' : 'row-reverse' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: isChallenger ? 'var(--accent-primary)' : 'var(--accent-secondary)' }}>
                        {msg.sender?.mlbb_ign || 'Unknown'}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatRelativeTime(msg.created_at)}</span>
                    </div>
                    <div style={{ 
                      padding: '14px 18px', 
                      borderRadius: 20, 
                      background: isChallenger ? 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.05))' : 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(6,182,212,0.05))',
                      border: `1px solid ${isChallenger ? 'rgba(124,58,237,0.3)' : 'rgba(6,182,212,0.3)'}`,
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: 'var(--text-primary)',
                      borderTopLeftRadius: isChallenger ? 4 : 20,
                      borderTopRightRadius: isChallenger ? 20 : 4,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      {msg.content}
                      {msg.media_url && (
                        <div style={{ marginTop: 12 }}>
                          <img src={msg.media_url} alt="Evidence" style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>
          </div>
        </div>

        {/* Room State Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Match Summary Card */}
          <div className="glass-card" style={{ padding: 24, border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent-primary)' }}>■</span> Match Summary
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>STATUS</div>
                <div style={getStatusStyle(match.status)}>{match.status}</div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>STAKE</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--neon-yellow)', fontFamily: 'var(--font-display)' }}>{Number(match.stake_amount).toLocaleString()} <span style={{ fontSize: 11 }}>MMK</span></div>
              </div>

              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--border-secondary), transparent)', margin: '4px 0' }} />
              
              {/* Challenger Info */}
              <div style={{ padding: 16, background: 'rgba(124,58,237,0.05)', borderRadius: 16, border: '1px solid rgba(124,58,237,0.1)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 800, textTransform: 'uppercase' }}>Challenger</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{match.challenger?.mlbb_ign || '---'}</div>
                <div style={{ 
                  fontSize: 10, 
                  color: match.challenger_ready ? 'var(--neon-green)' : 'var(--neon-red)', 
                  marginTop: 8,
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: match.challenger_ready ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  padding: '2px 8px',
                  borderRadius: 4
                }}>
                  {match.challenger_ready ? '✓ READY' : '⏳ NOT READY'}
                </div>
              </div>

              {/* Opponent Info */}
              <div style={{ padding: 16, background: 'rgba(6,182,212,0.05)', borderRadius: 16, border: '1px solid rgba(6,182,212,0.1)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 800, textTransform: 'uppercase' }}>Opponent</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{match.opponent?.mlbb_ign || '---'}</div>
                <div style={{ 
                  fontSize: 10, 
                  color: match.opponent_ready ? 'var(--neon-green)' : 'var(--neon-red)', 
                  marginTop: 8,
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: match.opponent_ready ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  padding: '2px 8px',
                  borderRadius: 4
                }}>
                  {match.opponent_ready ? '✓ READY' : '⏳ NOT READY'}
                </div>
              </div>
            </div>
          </div>

          {/* Claims Card */}
          <div className="glass-card" style={{ padding: 24, border: '1px solid rgba(234,179,8,0.2)', background: 'linear-gradient(180deg, rgba(234,179,8,0.05) 0%, transparent 100%)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 900, color: 'var(--neon-yellow)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚔️</span> Match Claims
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Challenger Claim */}
              <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>{match.challenger?.mlbb_ign}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: match.challenger_claim === 'WON' ? 'var(--neon-green)' : match.challenger_claim === 'LOST' ? 'var(--neon-red)' : 'var(--text-muted)' }}>
                  {match.challenger_claim || 'NO CLAIM'}
                </div>
                {match.challenger_claim_at && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'monospace' }}>
                    🕒 {formatDate(match.challenger_claim_at)}
                  </div>
                )}
              </div>

              {/* Opponent Claim */}
              <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>{match.opponent?.mlbb_ign || 'Opponent'}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: match.opponent_claim === 'WON' ? 'var(--neon-green)' : match.opponent_claim === 'LOST' ? 'var(--neon-red)' : 'var(--text-muted)' }}>
                  {match.opponent_claim || 'NO CLAIM'}
                </div>
                {match.opponent_claim_at && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'monospace' }}>
                    🕒 {formatDate(match.opponent_claim_at)}
                  </div>
                )}
              </div>
            </div>

            {match.status === 'DISPUTED' && (
              <div style={{ marginTop: 24, padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 12, border: '1px dashed var(--neon-red)', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--neon-red)', fontWeight: 800 }}>⚠️ CONFLICT DETECTED</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Both players claimed victory or both conceded.</div>
              </div>
            )}
          </div>

          {/* Resolution Actions */}
          {match.disputes && match.disputes.length > 0 && match.disputes[0].status === 'PENDING' && (
            <div className="glass-card" style={{ padding: 24, border: '1px solid rgba(168,85,247,0.3)', background: 'linear-gradient(180deg, rgba(168,85,247,0.08) 0%, transparent 100%)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#a855f7', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🧑‍⚖️</span> Resolution Actions
              </h3>
              
              {error && <div style={{ marginBottom: 16, padding: 12, background: 'rgba(239,68,68,0.1)', color: 'var(--neon-red)', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{error}</div>}
              {successMsg && <div style={{ marginBottom: 16, padding: 12, background: 'rgba(34,197,94,0.1)', color: 'var(--neon-green)', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{successMsg}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  className="btn-success"
                  disabled={resolving === match.disputes[0].id}
                  onClick={() => handleResolve(match.disputes[0].id, match.challenger_id, `Awarded to ${match.challenger?.mlbb_ign}`)}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {resolving === match.disputes[0].id ? '...' : `🏆 Award to ${match.challenger?.mlbb_ign}`}
                </button>
                {match.opponent && (
                  <button
                    className="btn-success"
                    disabled={resolving === match.disputes[0].id}
                    onClick={() => handleResolve(match.disputes[0].id, match.opponent!.id, `Awarded to ${match.opponent!.mlbb_ign}`)}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {resolving === match.disputes[0].id ? '...' : `🏆 Award to ${match.opponent?.mlbb_ign}`}
                  </button>
                )}
                <button
                  className="btn-secondary"
                  disabled={resolving === match.disputes[0].id}
                  onClick={() => handleResolve(match.disputes[0].id, null, 'Voided and refunded both players')}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                >
                  ↩️ Void &amp; Refund Both
                </button>
                <button
                  disabled={resolving === match.disputes[0].id}
                  onClick={() => handleResolve(match.disputes[0].id, null, 'Voided — stakes collected by platform', 'void_collect')}
                  style={{
                    background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(239,68,68,0.2))',
                    border: '1px solid rgba(234,179,8,0.4)',
                    color: '#f59e0b',
                    padding: '12px 20px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: resolving === match.disputes[0].id ? 'not-allowed' : 'pointer',
                    opacity: resolving === match.disputes[0].id ? 0.5 : 1,
                    transition: 'all 0.2s',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  {resolving === match.disputes[0].id ? '...' : '💰 Void & Collect'}
                </button>
              </div>
            </div>
          )}

          {match.disputes && match.disputes.length > 0 && match.disputes[0].status === 'RESOLVED' && (
            <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: 12, padding: 16, border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neon-green)', marginBottom: 4 }}>✅ Resolved</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{match.disputes[0].resolution}</div>
            </div>
          )}
        </div>


        {/* Evidence Screenshots Panel */}
        {screenshots.length > 0 && (
          <div className="glass-card" style={{ padding: 24, border: '1px solid rgba(239,68,68,0.25)', background: 'linear-gradient(135deg, rgba(239,68,68,0.04), transparent)', marginTop: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--neon-red)', marginBottom: 16 }}>📸 Dispute Evidence ({screenshots.length} image{screenshots.length > 1 ? 's' : ''})</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {screenshots.map((ss: any) => (
                <div key={ss.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <img
                    src={`${API_URL}${ss.file_url}`}
                    alt="Evidence"
                    onClick={() => setLightbox(ss.file_url)}
                    style={{
                      width: 160, height: 120, objectFit: 'cover', borderRadius: 12,
                      border: '2px solid rgba(239,68,68,0.3)', cursor: 'zoom-in',
                      transition: 'transform 0.2s, border-color 0.2s',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                    }}
                    onMouseEnter={e => { (e.target as HTMLImageElement).style.transform = 'scale(1.04)'; (e.target as HTMLImageElement).style.borderColor = 'var(--neon-red)'; }}
                    onMouseLeave={e => { (e.target as HTMLImageElement).style.transform = 'scale(1)'; (e.target as HTMLImageElement).style.borderColor = 'rgba(239,68,68,0.3)'; }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                    by {ss.uploader?.mlbb_ign || ss.uploader?.username || 'Unknown'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
