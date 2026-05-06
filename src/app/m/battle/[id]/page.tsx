'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useDialog } from '@/lib/dialog-context';
import { io, Socket } from 'socket.io-client';
import { formatCurrency, getWinRate } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function MatchAvatar({ user, size, borderRadius = 14 }: { user: any, size: number, borderRadius?: number }) {
  const [error, setError] = useState(false);
  if (!user) return <span style={{ fontSize: size * 0.4 }}>?</span>;

  const avatar = user.avatar_url || user.mlbb_avatar_url;
  if (avatar && !error) {
    return (
      <img
        src={avatar}
        alt={user.username}
        onError={() => setError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius }}
      />
    );
  }

  const initial = (user.telegram_display_name || user.telegram_username || user.username || 'U').replace('@', '').trim().charAt(0).toUpperCase();
  return <span style={{ fontSize: size * 0.4 }}>{initial}</span>;
}

export default function MobileBattleRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user, token, isLoggedIn, loading } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  const [match, setMatch] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [evidenceImages, setEvidenceImages] = useState<{ dataUrl: string; name: string }[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [evidenceSubmitted, setEvidenceSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolvedParams = use(params);
  const matchId = resolvedParams.id;

  // Initialize Socket and fetch initial data
  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.push('/login');
      return;
    }
    if (!token || !user) return;

    Promise.all([
      fetch(`${API_URL}/api/matches/${matchId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_URL}/api/battle-room/${matchId}/messages`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ]).then(([matchData, msgData]) => {
      if (matchData.success) {
        setMatch(matchData.data);
      } else {
        showAlert(matchData.error || 'Failed to load match');
        router.push('/m'); // Redirect back if match fails to load
      }
      
      if (msgData.success) {
        setMessages(msgData.data);
      }
    }).catch(err => {
      console.error("Fetch error:", err);
      showAlert("Network error while loading match. Check console.");
      router.push('/m');
    });

    // 1. Force websocket-first (skip slow polling upgrade)
    const newSocket = io(API_URL || window.location.origin, {
      auth: { token },
      transports: ['websocket'],       // Skip polling entirely
      reconnectionAttempts: Infinity,  // Keep trying forever
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      newSocket.emit('join-match', matchId);
    });

    // 2. Re-join the match room automatically on every reconnect
    newSocket.on('reconnect', () => {
      newSocket.emit('join-match', matchId);
    });

    newSocket.on('new-message', (msg) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(() => scrollToBottom(), 100);
    });

    newSocket.on('match-update', (updateData) => {
      setMatch((prev: any) => ({ ...prev, ...updateData }));
    });

    setSocket(newSocket);

    // 3. Heartbeat: every 10s, check if we missed any messages
    const heartbeatId = setInterval(async () => {
      // Only run if socket is connected — avoids hammering a dead server
      if (!newSocket.connected) return;
      try {
        const res = await fetch(`${API_URL}/api/battle-room/${matchId}/messages/count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.success) return;
        setMessages(prev => {
          // If server has more messages than we have, pull the ones we're missing
          if (data.count > prev.length) {
            fetch(`${API_URL}/api/battle-room/${matchId}/messages?after=${prev[prev.length - 1]?.id || ''}`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json()).then(full => {
              if (full.success) setMessages(full.data);
            }).catch(() => {});
          }
          return prev;
        });
      } catch {}
    }, 10000);

    return () => {
      clearInterval(heartbeatId);
      newSocket.disconnect();
    };
  }, [matchId, token, isLoggedIn, loading]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socket) return;

    socket.emit('send-message', {
      matchId,
      type: 'text',
      content: inputText.trim()
    });
    setInputText('');
  };

  const handleEvidenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 2 - evidenceImages.length;
    const toAdd = files.slice(0, remaining);
    toAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setEvidenceImages(prev => [...prev, { dataUrl: reader.result as string, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = ''; // reset input
  };

  const handleEvidenceSubmit = async () => {
    if (evidenceImages.length === 0) return showAlert('Please pick at least 1 image.');
    setUploadingEvidence(true);
    try {
      const res = await fetch(`${API_URL}/api/battle-room/${matchId}/dispute-evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ images: evidenceImages.map(img => ({ dataUrl: img.dataUrl })) })
      });
      const data = await res.json();
      if (data.success) {
        setEvidenceSubmitted(true);
        setEvidenceImages([]);
      } else {
        showAlert(data.error || 'Upload failed');
      }
    } catch {
      showAlert('Network error during upload.');
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleReady = async () => {
    try {
      const res = await fetch(`${API_URL}/api/battle-room/${matchId}/ready`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) showAlert(data.error);
    } catch {
      showAlert('Network error');
    }
  };

  const handleClaim = async (claim: 'WON' | 'LOST') => {
    const isWin = claim === 'WON';
    const claimVerb = isWin ? 'winning' : 'losing';
    const message = `⚠️ Final Submission: You are about to confirm ${claimVerb} this match. This action is irreversible and cannot be changed later. Do you confirm this result?`;
    
    showConfirm(message, async () => {
      try {
        const res = await fetch(`${API_URL}/api/battle-room/${matchId}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ claim })
        });
        const data = await res.json();
        if (!data.success) showAlert(data.error);
      } catch {
        showAlert('Network error');
      }
    }, {
      title: claim,
      titleColor: isWin ? 'var(--neon-green)' : 'var(--neon-red)',
      icon: isWin ? '🏆' : '💀'
    });
  };

  if (!match || !user) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-primary)' }}>
      <div className="animate-glow-pulse" style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-primary)' }}>Loading Arena...</div>
    </div>
  );

  const isChallenger = match.challenger_id === user.id;
  const opponent = isChallenger ? match.opponent : match.challenger;
  
  // Phase logic
  const isNegotiation = match.status === 'PENDING_JOIN' || match.status === 'ACTIVE' || match.status === 'ACCEPTED' || match.status === 'WAITING';
  const isReadyCheck = match.status === 'READY_CHECK';
  const isBattle = match.status === 'BATTLE' || match.status === 'SUBMISSION';
  const isCompleted = match.status === 'COMPLETED' || match.status === 'CANCELLED' || match.status === 'VOIDED' || match.status === 'DISPUTED';

  const myReady = isChallenger ? match.challenger_ready : match.opponent_ready;
  const myClaim = isChallenger ? match.challenger_claim : match.opponent_claim;

  // --- Header Component that scrolls INSIDE the chat ---
  const MatchInfoHeader = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
      
      {/* Opponent Information Card */}
      <div style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
         <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Opponent Info</div>
         {opponent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', textAlign: 'center' }}>
               <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', overflow: 'hidden', flexShrink: 0 }}>
                  <MatchAvatar user={opponent} size={64} />
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>{opponent.mlbb_ign || opponent.username || 'Unknown'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                     Server: <span style={{ color: 'white', fontWeight: 600 }}>{opponent.mlbb_server_id || '---'}</span> • 
                     Zone: <span style={{ color: 'white', fontWeight: 600 }}>{opponent.mlbb_zone_id || '---'}</span>
                  </div>
               </div>
            </div>
         ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: '2px dashed var(--border-secondary)', flexShrink: 0 }}>?</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>Waiting for opponent...</div>
            </div>
         )}
         
         {opponent && (
           <div style={{ fontSize: 12, color: 'var(--neon-yellow)', background: 'rgba(234,179,8,0.1)', padding: '10px 12px', borderRadius: 8, border: '1px dashed rgba(234,179,8,0.3)', textAlign: 'center', lineHeight: 1.4 }}>
             Please connect to your opponent in MLBB and join Custom Game Room
           </div>
         )}
      </div>

      {isReadyCheck && (
        <button 
          onClick={handleReady} 
          disabled={myReady}
          className={myReady ? '' : 'btn-battle btn-battle-pulse'}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none',
            background: myReady ? 'var(--bg-tertiary)' : undefined,
            color: myReady ? 'var(--text-muted)' : undefined,
            fontWeight: 800, fontSize: 16, cursor: myReady ? 'default' : 'pointer'
          }}
        >
          {myReady ? '⏳ Waiting for Opponent...' : '🚀 READY TO PLAY'}
        </button>
      )}

      {isBattle && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(234,179,8,0.1)', border: '1px dashed var(--neon-yellow)', borderRadius: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Match Code</div>
            <div className="font-display gradient-text-gold" style={{ fontSize: 24, letterSpacing: 4, fontWeight: 800 }}>{match.match_code || '---'}</div>
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              onClick={() => handleClaim('WON')}
              disabled={myClaim === 'WON'}
              style={{
                flex: 1, padding: '16px', borderRadius: 16, border: 'none',
                background: myClaim === 'WON' ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: myClaim === 'WON' ? 'var(--text-muted)' : 'white', fontWeight: 800, fontSize: 15, cursor: myClaim === 'WON' ? 'default' : 'pointer',
                boxShadow: myClaim === 'WON' ? 'none' : '0 8px 25px rgba(34, 197, 94, 0.4)'
              }}
            >
              🏆 I WON
            </button>
            <button 
              onClick={() => handleClaim('LOST')}
              disabled={myClaim === 'LOST'}
              style={{
                flex: 1, padding: '16px', borderRadius: 16, border: 'none',
                background: myClaim === 'LOST' ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: myClaim === 'LOST' ? 'var(--text-muted)' : 'white', fontWeight: 800, fontSize: 15, cursor: myClaim === 'LOST' ? 'default' : 'pointer',
                boxShadow: myClaim === 'LOST' ? 'none' : '0 8px 25px rgba(239, 68, 68, 0.4)'
              }}
            >
              💀 I LOST
            </button>
          </div>
        </div>
      )}

      {isCompleted && match.status === 'COMPLETED' && match.winner_id && (
        <div style={{ 
          textAlign: 'center', padding: '24px 20px', borderRadius: 16, 
          background: match.winner_id === user.id ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', 
          border: `1px solid ${match.winner_id === user.id ? 'var(--neon-green)' : 'var(--neon-red)'}`,
          boxShadow: `0 0 20px ${match.winner_id === user.id ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>
            {match.winner_id === user.id ? '🏆' : '💀'}
          </div>
          <h3 className="font-display" style={{ 
            fontSize: 28, fontWeight: 800, marginBottom: 8, 
            color: match.winner_id === user.id ? 'var(--neon-green)' : 'var(--neon-red)' 
          }}>
            {match.winner_id === user.id ? 'VICTORY' : 'DEFEAT'}
          </h3>
          <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>
            {match.winner_id === user.id 
              ? `You won ${formatCurrency(match.stake_amount * 2 * 0.95)}!` 
              : `Winner: ${match.winner_id === match.challenger_id ? match.challenger?.username : match.opponent?.username}`}
          </div>
        </div>
      )}

      {isCompleted && match.status !== 'COMPLETED' && (
        <div style={{ textAlign: 'center', padding: 20, background: 'var(--bg-tertiary)', borderRadius: 16, border: '1px solid var(--border-secondary)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>
            {match.status === 'DISPUTED' ? '⚠️' : '❌'}
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
            {match.status === 'DISPUTED' && 'Match Disputed'}
            {(match.status === 'CANCELLED' || match.status === 'VOIDED') && 'Match Cancelled'}
          </h3>
          {match.status === 'DISPUTED' && (
             <div style={{ color: 'var(--neon-red)', fontSize: 12, marginTop: 8 }}>
               Admin review is required. Please wait for resolution.
             </div>
          )}
        </div>
      )}

      {/* Divider Before Chat */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, var(--border-secondary))' }}></div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Live Chat</div>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(-90deg, transparent, var(--border-secondary))' }}></div>
      </div>
    </div>
  );

  return (
    <div className="mobile-battle-room" style={{ 
      position: 'fixed', 
      top: 64, 
      bottom: 65, 
      left: '50%', 
      transform: 'translateX(-50%)', 
      width: '100%', 
      maxWidth: 480, 
      display: 'flex', 
      flexDirection: 'column', 
      background: 'var(--bg-primary)', 
      overflow: 'hidden',
      zIndex: 40
    }}>
      {/* Top Navbar - Locked inside fixed container */}
      <div style={{
        height: 60, background: 'rgba(10, 10, 15, 0.8)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-secondary)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
        flexShrink: 0, zIndex: 10
      }}>
        <button onClick={() => router.back()} style={{ 
          background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)', borderRadius: 12, 
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', cursor: 'pointer'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
             <span className="font-display" style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>ARENA</span>
             <StatusBadge status={match.status} size="sm" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
           <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--neon-yellow)' }}>{formatCurrency(match.stake_amount)}</div>
           <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID: {shortenId(match.id)}</div>
        </div>
      </div>

      {/* Scrollable Main View (Chat + Appended Context) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: isCompleted ? '80px' : '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        {/* Render Match Info at the start of chatting content */}
        <MatchInfoHeader />

        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, minHeight: 80 }}>
            Say hello to your opponent!
          </div>
        )}
        
        {/* Chat Messages */}
        {messages.map((m, i) => {
          if (m.type === 'system') {
            return (
              <div key={m.id || i} style={{ alignSelf: 'center', background: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: 20, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: '85%' }}>
                {m.content}
              </div>
            );
          }

          const isMe = m.sender_id === user.id;
          return (
            <div key={m.id || i} style={{
              alignSelf: isMe ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: isMe ? 'flex-end' : 'flex-start'
            }}>
              {!isMe && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, marginLeft: 10 }}>{m.sender?.username}</div>}
              <div style={{
                background: isMe ? 'linear-gradient(135deg, var(--accent-primary), #6d28d9)' : 'var(--bg-tertiary)',
                padding: '10px 16px',
                borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                fontSize: 14,
                color: 'white',
                wordBreak: 'break-word',
                boxShadow: isMe ? '0 4px 12px rgba(124, 58, 237, 0.2)' : 'none',
                border: isMe ? 'none' : '1px solid var(--border-secondary)'
              }}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed Chat Input / Evidence Picker at Bottom */}
      {!isCompleted && (
        <div style={{ 
          padding: '12px 16px', borderTop: '1px solid var(--border-secondary)', 
          background: 'rgba(10, 10, 15, 0.95)', backdropFilter: 'blur(20px)',
          flexShrink: 0 
        }}>
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Message..."
              style={{
                flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
                borderRadius: 24, padding: '12px 16px', color: 'white', outline: 'none', fontSize: 14,
                transition: 'all 0.3s'
              }}
              onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px var(--accent-glow)'}
              onBlur={(e) => e.target.style.boxShadow = 'none'}
            />
            <button type="submit" disabled={!inputText.trim()} style={{
              width: 44, height: 44, borderRadius: 22, border: 'none', flexShrink: 0,
              background: inputText.trim() ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-tertiary)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inputText.trim() ? 'pointer' : 'default',
              transition: 'all 0.3s', boxShadow: inputText.trim() ? '0 4px 15px var(--accent-glow)' : 'none'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* Dispute Evidence Picker — shows only when DISPUTED */}
      {match.status === 'DISPUTED' && (
        <div style={{
          padding: '12px 16px', borderTop: '1px solid rgba(239,68,68,0.3)',
          background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(20px)',
          flexShrink: 0,
        }}>
          {evidenceSubmitted ? (
            <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 13, color: 'var(--neon-green)' }}>
              ✅ Evidence submitted! Admin will review your images.
            </div>
          ) : (
            <>
              <div style={{
                fontSize: 11, color: 'var(--neon-yellow)', marginBottom: 10, lineHeight: 1.5,
                background: 'rgba(234,179,8,0.08)', borderRadius: 10, padding: '8px 12px',
                border: '1px dashed rgba(234,179,8,0.3)'
              }}>
                📸 Submit up to <strong>2 screenshots</strong> as evidence for admin review. Accepted formats: JPG, PNG.
              </div>

              {/* Preview thumbnails */}
              {evidenceImages.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {evidenceImages.map((img, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={img.dataUrl} alt="evidence" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border-primary)' }} />
                      <button onClick={() => setEvidenceImages(prev => prev.filter((_, j) => j !== i))} style={{
                        position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                        background: 'var(--neon-red)', border: 'none', color: 'white', fontSize: 11,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                {evidenceImages.length < 2 && (
                  <button onClick={() => fileInputRef.current?.click()} style={{
                    flex: 1, padding: '11px', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.2)',
                    background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 13,
                    cursor: 'pointer', fontWeight: 600
                  }}>
                    🖼️ Pick Image ({evidenceImages.length}/2)
                  </button>
                )}
                {evidenceImages.length > 0 && (
                  <button onClick={handleEvidenceSubmit} disabled={uploadingEvidence} style={{
                    flex: 1, padding: '11px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg, var(--neon-red), #b91c1c)',
                    color: 'white', fontSize: 13, cursor: 'pointer', fontWeight: 700
                  }}>
                    {uploadingEvidence ? '⏳ Uploading...' : '📤 Submit Evidence'}
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleEvidenceFileChange} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Helper to shorten ID
function shortenId(id: string): string {
  if (!id) return '';
  if (id.length <= 12) return '#' + id;
  return `#${id.substring(0, 5)}...${id.substring(id.length - 4)}`;
}
