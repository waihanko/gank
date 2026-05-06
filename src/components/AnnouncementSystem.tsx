'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Announcement {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  link_url?: string;
}

export default function AnnouncementSystem() {
  const searchParams = useSearchParams();
  const isMobileView = searchParams.get('ismobile') === 'true';
  
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [current, setCurrent] = useState<Announcement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hideToday, setHideToday] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch(`${API_URL}/api/announcements`);
      const data = await res.json();
      if (data.success) {
        const today = new Date().toISOString().split('T')[0];
        // Filter out hidden ones
        const valid = data.data.filter((a: Announcement) => {
          return !localStorage.getItem(`gank_hide_${a.id}_${today}`);
        });
        setQueue(valid);
      }
    } catch (err) {
      console.error('Announcement fetch failed', err);
    }
  };

  useEffect(() => {
    if (queue.length > 0 && !current) {
      // Show next in queue
      const next = queue[0];
      setCurrent(next);
      setHideToday(false);
      // Small delay for smooth appearance
      setTimeout(() => setIsVisible(true), 100);
    }
  }, [queue, current]);

  const handleClose = () => {
    setIsVisible(false);
    
    // Process "Close for today"
    if (hideToday && current) {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`gank_hide_${current.id}_${today}`, 'true');
    }

    // Wait for transition, then pop from queue
    setTimeout(() => {
      setQueue(prev => prev.slice(1));
      setCurrent(null);
    }, 300); // Wait for fade out/slide down
  };

  if (!current) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: isMobileView ? 'flex-end' : 'center',
        justifyContent: 'center',
        background: isVisible ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0)',
        backdropFilter: isVisible ? 'blur(12px)' : 'none',
        transition: 'all 0.4s ease',
        pointerEvents: isVisible ? 'auto' : 'none',
        padding: isMobileView ? 0 : 20,
      }}
    >
      <div 
        className={`${isMobileView ? 'animate-slide-up' : 'animate-scale-up'}`}
        style={{
          width: '100%',
          maxWidth: isMobileView ? '100%' : 420,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: isMobileView ? '24px 24px 0 0' : 20,
          overflow: 'hidden',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.3s ease',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          maxHeight: isMobileView ? '85vh' : '90vh',
          paddingBottom: isMobileView ? 'max(24px, env(safe-area-inset-bottom))' : 24,
        }}
      >
        {/* Header/Title */}
        <div style={{ textAlign: 'center' }}>
          <h2 className="font-display gradient-text" style={{ fontSize: 20, fontWeight: 900, marginBottom: 4, textTransform: 'uppercase' }}>
            {current.title}
          </h2>
        </div>

        {/* Image if exists */}
        {current.image_url && (
          <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}>
            <img src={current.image_url} alt="Promo" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
          </div>
        )}

        {/* Content */}
        <div 
          className="announcement-markdown"
          style={{ 
            color: 'var(--text-secondary)', 
            fontSize: 15, 
            lineHeight: 1.6, 
            textAlign: 'left',
            overflowY: 'auto',
            padding: '4px 0'
          }}
        >
          <ReactMarkdown
            components={{
              h1: ({node, ...props}) => <h1 style={{fontSize: '1.2em', color: 'var(--text-primary)', margin: '12px 0 8px'}} {...props} />,
              h2: ({node, ...props}) => <h2 style={{fontSize: '1.1em', color: 'var(--text-primary)', margin: '10px 0 6px'}} {...props} />,
              p: ({node, ...props}) => <p style={{marginBottom: '10px'}} {...props} />,
              ul: ({node, ...props}) => <ul style={{paddingLeft: '20px', marginBottom: '10px'}} {...props} />,
              li: ({node, ...props}) => <li style={{marginBottom: '4px'}} {...props} />,
              strong: ({node, ...props}) => <strong style={{color: 'var(--accent-secondary)', fontWeight: 700}} {...props} />,
            }}
          >
            {current.content}
          </ReactMarkdown>
        </div>

        {/* Footer Actions */}
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {current.link_url && (
            <a 
              href={current.link_url} 
              className="btn-primary" 
              style={{ textAlign: 'center', textDecoration: 'none', justifyContent: 'center' }}
              onClick={handleClose}
            >
              Learn More
            </a>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '8px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
              <input 
                type="checkbox" 
                checked={hideToday} 
                onChange={(e) => setHideToday(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)' }}
              />
              Don't show again today
            </label>
          </div>

          <button 
            className="btn-primary" 
            style={{ width: '100%', padding: '14px', justifyContent: 'center' }}
            onClick={handleClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
