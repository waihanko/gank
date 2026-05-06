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

  if (user.avatar_url && !error) {
    return (
      <img
        src={user.avatar_url}
        alt={user.username}
        onError={() => setError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius }}
      />
    );
  }

  const initial = (user.telegram_display_name || user.telegram_username || user.username || 'U').replace('@', '').trim().charAt(0).toUpperCase();
  return <span style={{ fontSize: size * 0.4 }}>{initial}</span>;
}

export default function BattleRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user, token, isLoggedIn, loading } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  const [match, setMatch] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [evidenceImages, setEvidenceImages] = useState<{ dataUrl: string; name: string }[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [evidenceSubmitted, setEvidenceSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolvedParams = use(params);
  const matchId = resolvedParams.id;

  // Handle responsive layout detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize Socket and fetch initial data
  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.push('/login');
      return;
    }
    if (!token || !user) return;

    // Fetch Match & Messages
    Promise.all([
      fetch(`${API_URL}/api/matches/${matchId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_URL}/api/battle-room/${matchId}/messages`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ]).then(([matchData, msgData]) => {
      if (matchData.success) {
        setMatch(matchData.data);
      } else {
        showAlert(matchData.error || 'Failed to load match');
        router.push('/matches');
      }
      
      if (msgData.success) {
        setMessages(msgData.data);
      }
    }).catch(err => {
      console.error("Fetch error:", err);
      showAlert("Network error while loading match. Check console.");
      router.push('/matches');
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
      if (!newSocket.connected) return;
      try {
        const res = await fetch(`${API_URL}/api/battle-room/${matchId}/messages/count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.success) return;
        setMessages(prev => {
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
    e.target.value = '';
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
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
      <div className="animate-glow-pulse" style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-primary)' }}>Loading Battle Arena...</div>
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

  // --- UI Components ---
  const renderMatchInfo = (mobile = false) => (
    <div className={mobile ? "" : "glass-card"} style={{ padding: mobile ? 0 : 24, display: 'flex', flexDirection: 'column', gap: mobile ? 16 : 24, height: mobile ? 'auto' : '100%', overflowY: mobile ? 'visible' : 'auto' }}>
      {!mobile && (
        <div>
          <h2 className="font-display gradient-text" style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Match Info</h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>ID: {shortenId(match.id)}</div>
        </div>
      )}

      {/* Opponent Information Card */}
      <div style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
         <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Opponent Info</div>
         {opponent ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
               <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', overflow: 'hidden', flexShrink: 0 }}>
                  <MatchAvatar user={opponent} size={48} />
               </div>
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>{opponent.mlbb_ign || opponent.username || 'Unknown'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                     Server: <span style={{ color: 'white', fontWeight: 600 }}>{opponent.mlbb_server_id || '---'}</span> • 
                     Zone: <span style={{ color: 'white', fontWeight: 600 }}>{opponent.mlbb_zone_id || '---'}</span>
                  </div>
               </div>
            </div>
         ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '2px dashed var(--border-secondary)', flexShrink: 0 }}>?</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>Waiting for opponent...</div>
            </div>
         )}
         
         {opponent && (
           <div style={{ fontSize: 12, color: 'var(--neon-yellow)', background: 'rgba(234,179,8,0.1)', padding: '10px 12px', borderRadius: 8, border: '1px dashed rgba(234,179,8,0.3)', textAlign: 'center', lineHeight: 1.4 }}>
             Please connect to your opponent in MLBB and join Custom Game Room
           </div>
         )}
      </div>
    </div>
  );

  const renderActions = (mobile = false) => (
    <div className={mobile ? "" : "glass-card"} style={{ padding: mobile ? 0 : 24, display: 'flex', flexDirection: 'column', gap: mobile ? 16 : 24, height: mobile ? 'auto' : '100%' }}>
      {!mobile && (
        <div>
          <h2 className="font-display" style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Status & Actions</h2>
          <StatusBadge status={match.status} />
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: mobile ? 'flex-start' : 'center', gap: 16 }}>

        {isReadyCheck && (
          <button 
            onClick={handleReady} 
            disabled={myReady}
            className={myReady ? '' : 'btn-battle btn-battle-pulse'}
            style={{
              width: '100%', padding: mobile ? '16px' : '20px', borderRadius: 16, border: 'none',
              background: myReady ? 'var(--bg-tertiary)' : undefined,
              color: myReady ? 'var(--text-muted)' : undefined,
              fontWeight: 800, fontSize: 16, cursor: myReady ? 'default' : 'pointer'
            }}
          >
            {myReady ? '⏳ Waiting for Opponent...' : '🚀 READY TO PLAY'}
          </button>
        )}

        {isBattle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(234,179,8,0.1)', border: '1px dashed var(--neon-yellow)', borderRadius: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Match Code</div>
              <div className="font-display gradient-text-gold" style={{ fontSize: mobile ? 24 : 28, letterSpacing: 6, fontWeight: 800 }}>{match.match_code || '---'}</div>
            </div>
            
            <div style={{ display: 'flex', gap: 12, flexDirection: mobile ? 'row' : 'column' }}>
              <button 
                onClick={() => handleClaim('WON')}
                disabled={myClaim === 'WON'}
                style={{
                  flex: 1, padding: mobile ? '16px' : '20px', borderRadius: 16, border: 'none',
                  background: myClaim === 'WON' ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: myClaim === 'WON' ? 'var(--text-muted)' : 'white', fontWeight: 800, fontSize: 16, cursor: myClaim === 'WON' ? 'default' : 'pointer',
                  boxShadow: myClaim === 'WON' ? 'none' : '0 8px 30px rgba(34, 197, 94, 0.4)', transition: 'all 0.3s'
                }}
              >
                🏆 I WON
              </button>
              <button 
                onClick={() => handleClaim('LOST')}
                disabled={myClaim === 'LOST'}
                style={{
                  flex: 1, padding: mobile ? '16px' : '20px', borderRadius: 16, border: 'none',
                  background: myClaim === 'LOST' ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: myClaim === 'LOST' ? 'var(--text-muted)' : 'white', fontWeight: 800, fontSize: 16, cursor: myClaim === 'LOST' ? 'default' : 'pointer',
                  boxShadow: myClaim === 'LOST' ? 'none' : '0 8px 30px rgba(239, 68, 68, 0.4)', transition: 'all 0.3s'
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
        <div style={{ textAlign: 'center', padding: 24, background: 'var(--bg-tertiary)', borderRadius: 16, border: '1px solid var(--border-secondary)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {match.status === 'DISPUTED' ? '⚠️' : '❌'}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            {match.status === 'DISPUTED' && 'Match Disputed'}
            {(match.status === 'CANCELLED' || match.status === 'VOIDED') && 'Match Cancelled'}
          </h3>
          {match.status === 'DISPUTED' && (
             <div style={{ color: 'var(--neon-red)', fontSize: 13, marginTop: 12 }}>
               Admin review is required. Please wait for resolution.
             </div>
          )}
        </div>
      )}
      </div>
    </div>
  );

  const renderChat = (mobile = false) => (
    <div className={mobile ? "" : "glass-card"} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%', background: mobile ? 'transparent' : 'rgba(17, 17, 24, 0.6)' }}>
      {/* Chat Header */}
      {!mobile && (
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-secondary)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--neon-green)', boxShadow: '0 0 10px var(--neon-green)' }}></div>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Live Chat</h3>
        </div>
      )}

      {/* Chat Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Mobile: Append Match Info and Actions at the start of chatting content */}
        {mobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 16 }}>
             {renderMatchInfo(true)}
             {renderActions(true)}
             
             {/* Beautiful Divider before actual chat */}
             <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '8px 0' }}>
               <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, var(--border-secondary))' }}></div>
               <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Live Chat</div>
               <div style={{ flex: 1, height: 1, background: 'linear-gradient(-90deg, transparent, var(--border-secondary))' }}></div>
             </div>
          </div>
        )}

        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14, minHeight: 100 }}>
            Say hello to your opponent!
          </div>
        )}
        
        {messages.map((m, i) => {
          if (m.type === 'system') {
            return (
              <div key={m.id || i} style={{ alignSelf: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: 24, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: '80%' }}>
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
              {!isMe && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, marginLeft: 12 }}>{m.sender?.username}</div>}
              <div style={{
                background: isMe ? 'linear-gradient(135deg, var(--accent-primary), #6d28d9)' : 'var(--bg-tertiary)',
                padding: '12px 18px',
                borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                fontSize: 15,
                color: 'white',
                wordBreak: 'break-word',
                boxShadow: isMe ? '0 4px 15px rgba(124, 58, 237, 0.2)' : 'none',
                border: isMe ? 'none' : '1px solid var(--border-secondary)'
              }}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      {!isCompleted && (
        <div style={{ padding: mobile ? '12px 16px' : '20px', borderTop: '1px solid var(--border-secondary)', background: mobile ? 'rgba(10, 10, 15, 0.95)' : 'var(--bg-secondary)', backdropFilter: mobile ? 'blur(20px)' : 'none', paddingBottom: mobile ? 'max(12px, env(safe-area-inset-bottom))' : '20px' }}>
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Message..."
              style={{
                flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
                borderRadius: 24, padding: '14px 20px', color: 'white', outline: 'none', fontSize: 15,
                transition: 'all 0.3s'
              }}
              onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px var(--accent-glow)'}
              onBlur={(e) => e.target.style.boxShadow = 'none'}
            />
            <button type="submit" disabled={!inputText.trim()} style={{
              width: 48, height: 48, borderRadius: 24, border: 'none', flexShrink: 0,
              background: inputText.trim() ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-tertiary)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inputText.trim() ? 'pointer' : 'default',
              transition: 'all 0.3s', boxShadow: inputText.trim() ? '0 4px 20px var(--accent-glow)' : 'none'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* Dispute Evidence Picker */}
      {match?.status === 'DISPUTED' && (
        <div style={{
          padding: mobile ? '12px 16px' : '20px',
          borderTop: '1px solid rgba(239,68,68,0.3)',
          background: mobile ? 'rgba(10,10,15,0.97)' : 'var(--bg-secondary)',
          backdropFilter: mobile ? 'blur(20px)' : 'none',
          paddingBottom: mobile ? 'max(12px, env(safe-area-inset-bottom))' : '20px',
        }}>
          {evidenceSubmitted ? (
            <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 14, color: 'var(--neon-green)', fontWeight: 600 }}>
              ✅ Evidence submitted! Admin will review your images.
            </div>
          ) : (
            <>
              <div style={{
                fontSize: 12, color: 'var(--neon-yellow)', marginBottom: 12, lineHeight: 1.6,
                background: 'rgba(234,179,8,0.08)', borderRadius: 10, padding: '10px 14px',
                border: '1px dashed rgba(234,179,8,0.3)'
              }}>
                📸 Submit up to <strong>2 screenshots</strong> as evidence for the admin dispute review. Accepted: JPG, PNG.
              </div>
              {evidenceImages.length > 0 && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  {evidenceImages.map((img, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={img.dataUrl} alt="evidence" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border-primary)' }} />
                      <button onClick={() => setEvidenceImages(prev => prev.filter((_, j) => j !== i))} style={{
                        position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%',
                        background: 'var(--neon-red)', border: 'none', color: 'white', fontSize: 12,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                {evidenceImages.length < 2 && (
                  <button onClick={() => fileInputRef.current?.click()} style={{
                    flex: 1, padding: '12px', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.2)',
                    background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 14,
                    cursor: 'pointer', fontWeight: 600
                  }}>
                    🖼️ Pick Image ({evidenceImages.length}/2)
                  </button>
                )}
                {evidenceImages.length > 0 && (
                  <button onClick={handleEvidenceSubmit} disabled={uploadingEvidence} style={{
                    flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg, var(--neon-red), #b91c1c)',
                    color: 'white', fontSize: 14, cursor: 'pointer', fontWeight: 700
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top Navbar */}
      <div style={{
        height: isMobile ? 60 : 72, background: 'rgba(10, 10, 15, 0.8)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-secondary)', display: 'flex', alignItems: 'center', padding: isMobile ? '0 16px' : '0 24px', gap: isMobile ? 12 : 24,
        position: 'sticky', top: 0, zIndex: 50, flexShrink: 0
      }}>
        <button onClick={() => router.push('/matches')} style={{ 
          background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)', borderRadius: 12, 
          width: isMobile ? 36 : 40, height: isMobile ? 36 : 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', cursor: 'pointer', transition: 'all 0.2s'
        }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'} onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isMobile && <span className="font-display" style={{ fontSize: 20, fontWeight: 800 }}>BATTLE ARENA</span>}
          {!isMobile && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neon-yellow)', boxShadow: '0 0 10px var(--neon-yellow)' }}></div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 4 : 0 }}>
             {isMobile && <span className="font-display" style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>ARENA</span>}
             {!isMobile ? (
               <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{opponent ? `vs ${opponent.username}` : 'Waiting...'}</span>
             ) : (
               <StatusBadge status={match.status} size="sm" />
             )}
          </div>
        </div>
        {isMobile && (
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
             <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--neon-yellow)' }}>{formatCurrency(match.stake_amount)}</div>
             <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID: {shortenId(match.id)}</div>
           </div>
        )}
      </div>

      {/* Main Layout */}
      {isMobile ? (
        // Mobile Layout: One beautiful scrollable chat view with contextual headers
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
           {renderChat(true)}
        </div>
      ) : (
        // Desktop Layout: 3 Columns
        <div style={{ 
          flex: 1, display: 'flex', flexDirection: 'row', 
          padding: 24, gap: 24, overflow: 'hidden',
          maxWidth: 1600, margin: '0 auto', width: '100%'
        }}>
          {/* Left Column - Match Info */}
          <div style={{ width: 340, height: '100%', flexShrink: 0 }}>
            {renderMatchInfo(false)}
          </div>

          {/* Center Column - Chat */}
          <div style={{ flex: 1, height: '100%', minHeight: 0 }}>
            {renderChat(false)}
          </div>

          {/* Right Column - Actions */}
          <div style={{ width: 380, height: '100%', flexShrink: 0 }}>
            {renderActions(false)}
          </div>
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
