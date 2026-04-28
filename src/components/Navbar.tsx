'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { PUBLIC_NAV_ITEMS, PLATFORM_NAME } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { isLoggedIn, user, token, syncProfile, logout } = useAuth();

  useEffect(() => {
    if (isLoggedIn && token) {
      fetchNotifications();
      const int = setInterval(fetchNotifications, 15000);
      return () => clearInterval(int);
    }
  }, [isLoggedIn, token]);

  async function fetchNotifications() {
    try {
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data);
        setUnreadCount(data.unreadCount);
      }
    } catch {}
  }

  async function handleNotificationClick(n: any) {
    if (!n.is_read) {
      try {
        await fetch(`${API_URL}/api/notifications/${n.id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchNotifications();
      } catch {}
    }
  }

  async function markAllRead() {
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotifications();
    } catch {}
  }

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(10, 10, 15, 0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-secondary)',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 72,
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            👻
          </div>
          <span
            className="font-display"
            style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2 }}
          >
            <span className="gradient-text">{PLATFORM_NAME.toUpperCase()}</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          className="desktop-nav"
        >
          {PUBLIC_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '8px 16px',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 8,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.background = 'var(--glass-highlight)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {item.label}
            </Link>
          ))}

          {isLoggedIn && user?.wallet && (
            <div style={{
              padding: '6px 12px',
              color: 'var(--neon-yellow)',
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 8,
              marginLeft: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              💰 {new Intl.NumberFormat('en-US').format(Number(user.wallet.balance) || 0)} MMK
            </div>
          )}

          {isLoggedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 8 }}>
              {/* Notification Bell */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setShowNotifications(!showNotifications); setDropdownOpen(false); }}
                  style={{
                    background: 'none', border: 'none', padding: 8, cursor: 'pointer',
                    fontSize: 20, position: 'relative', display: 'flex'
                  }}
                >
                  🔔
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: 4, right: 4, background: 'var(--neon-red)',
                      color: 'white', fontSize: 10, fontWeight: 800, padding: '2px 6px',
                      borderRadius: 10, border: '2px solid var(--bg-primary)'
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div
                    style={{
                      position: 'absolute', top: 50, right: 0, width: 320,
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)',
                      borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.8)', zIndex: 100,
                      maxHeight: 400, display: 'flex', flexDirection: 'column'
                    }}
                  >
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 12, cursor: 'pointer' }}>Mark all read</button>
                      )}
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No notifications</div>
                      ) : (
                        notifications.map(n => (
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            style={{
                              padding: '12px 16px', borderBottom: '1px solid var(--border-secondary)',
                              background: n.is_read ? 'transparent' : 'rgba(124,58,237,0.05)',
                              cursor: 'pointer', transition: 'background 0.2s'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: n.is_read ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{n.title}</span>
                              {!n.is_read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0, marginTop: 4 }}></span>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{n.message}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Dropdown */}
              <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setDropdownOpen(!dropdownOpen);
                  setShowNotifications(false);
                  if (!dropdownOpen) syncProfile();
                }}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="Avatar"
                    style={{
                      width: 40, height: 40, borderRadius: '50%', objectFit: 'cover',
                      border: '2px solid var(--accent-primary)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 700, color: 'white', border: '2px solid var(--accent-primary)',
                    }}
                  >
                    {(user?.telegram_display_name || user?.telegram_username?.replace('@', '') || user?.username || 'U').trim().charAt(0).toUpperCase()}
                  </div>
                )}
              </button>

              {dropdownOpen && (
                <div
                  style={{
                    position: 'absolute', top: 50, right: 0, width: 220,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-secondary)',
                    borderRadius: 12, padding: 8,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    zIndex: 100, display: 'flex', flexDirection: 'column', gap: 4,
                  }}
                >
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-secondary)', marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.username}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user?.telegram_username}</div>
                  </div>
                  <Link href="/profile" className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '8px 12px' }} onClick={() => setDropdownOpen(false)}>
                    👻 Profile
                  </Link>
                  <Link href="/battle-history" className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '8px 12px' }} onClick={() => setDropdownOpen(false)}>
                    ⚔️ Battle History
                  </Link>
                  <Link href="/wallet" className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '8px 12px' }} onClick={() => setDropdownOpen(false)}>
                    💰 Wallet
                  </Link>
                  <button className="btn-danger" onClick={() => { setDropdownOpen(false); logout(); }} style={{ justifyContent: 'flex-start', padding: '8px 12px', width: '100%', textAlign: 'left' }}>
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>
          ) : (
            <>
              <Link href="/login" className="btn-secondary btn-sm" style={{ marginLeft: 8 }}>
                Login
              </Link>
              <Link href="/register" className="btn-primary btn-sm" style={{ marginLeft: 4 }}>
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: 24,
            cursor: 'pointer',
          }}
          className="mobile-toggle"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {PUBLIC_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              style={{
                padding: '12px 16px',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontSize: 15,
                borderRadius: 8,
              }}
            >
              {item.label}
            </Link>
          ))}
          {isLoggedIn && user?.wallet && (
            <div style={{
              padding: '12px 16px',
              color: 'var(--neon-yellow)',
              fontSize: 15,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(234, 179, 8, 0.1)',
              borderRadius: 8,
            }}>
              💰 {new Intl.NumberFormat('en-US').format(Number(user.wallet.balance) || 0)} MMK
            </div>
          )}
          {isLoggedIn ? (
            <>
              <Link href="/profile" className="btn-secondary" onClick={() => setMobileOpen(false)}>👻 Profile</Link>
              <Link href="/battle-history" className="btn-secondary" onClick={() => setMobileOpen(false)}>⚔️ Battle History</Link>
              <Link href="/wallet" className="btn-secondary" onClick={() => setMobileOpen(false)}>💰 Wallet</Link>
              <Link href="/profile" className="btn-primary" onClick={() => setMobileOpen(false)}>👻 Profile</Link>
              <button className="btn-danger" onClick={() => { setMobileOpen(false); logout(); }} style={{ textAlign: 'left' }}>🚪 Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary" onClick={() => setMobileOpen(false)}>Login</Link>
              <Link href="/register" className="btn-primary" onClick={() => setMobileOpen(false)}>Register</Link>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-toggle {
            display: block !important;
          }
        }
      `}</style>
    </nav>
  );
}
