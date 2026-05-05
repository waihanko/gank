'use client';

import { useEffect, useState, use } from 'react';
import { formatDate } from '@/lib/utils';
import { useDialog } from '@/lib/dialog-context';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showAlert, showConfirm } = useDialog();
  
  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showSendMessageModal, setShowSendMessageModal] = useState(false);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files ? e.target.files[0] : null;
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  }

  // Edit group form
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editChatId, setEditChatId] = useState('');
  const [editInviteLink, setEditInviteLink] = useState('');

  useEffect(() => {
    fetchGroup();
    fetchMessages();
  }, [id]);

  async function fetchGroup() {
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/groups/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('gr_admin_token');
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (data.success) {
        const found = data.data;
        setGroup(found);
        setEditTitle(found.title);
        setEditChatId(found.chat_id);
        setEditInviteLink(found.invite_link);
      }
    } catch {
      window.location.href = '/admin/error?message=The specified group record could not be fetched from the registry.';
    }
    setLoading(false);
  }

  async function fetchMessages() {
    setLoadingMessages(true);
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/groups/${id}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setMessages(data.data);
    } catch {}
    setLoadingMessages(false);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() && !imageFile) return;
    
    setSendingMessage(true);
    const token = localStorage.getItem('gr_admin_token');
    
    try {
      let base64Image = undefined;
      if (imageFile) {
        base64Image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
          reader.readAsDataURL(imageFile);
        });
      }

      const res = await fetch(`${API_URL}/api/admin/groups/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: newMessage, image: base64Image }),
      });
      const data = await res.json();
      if (data.success) {
        setNewMessage('');
        setImageFile(null);
        setImagePreview(null);
        setShowSendMessageModal(false);
        fetchMessages();
        showAlert('Message sent successfully!');
      } else {
        showAlert(data.error || 'Failed to send message.');
      }
    } catch {
      showAlert('Network error while sending message.');
    }
    setSendingMessage(false);
  }

  async function handleEditSave() {
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: editTitle, chat_id: editChatId, invite_link: editInviteLink }),
      });
      const data = await res.json();
      if (data.success) {
        setGroup({ ...group, title: editTitle, chat_id: editChatId, invite_link: editInviteLink });
        setShowEdit(false);
        showAlert('Group updated successfully');
      } else {
        showAlert(data.error);
      }
    } catch {
      showAlert('Failed to update group');
    }
  }

  async function handleDelete() {
    showConfirm(`Are you sure you want to delete this group? This action cannot be undone.`, async () => {
      const token = localStorage.getItem('gr_admin_token');
      try {
        const res = await fetch(`${API_URL}/api/admin/groups/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          router.push('/admin/groups');
        } else {
          showAlert(data.error);
        }
      } catch {
        showAlert('Failed to delete group');
      }
    });
  }

  if (loading) return <div className="page-container">Loading...</div>;
  if (!group) return <div className="page-container">Group not found</div>;

  return (
    <div className="page-container">
      <button 
        className="btn-secondary btn-sm" 
        style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}
        onClick={() => router.push('/admin/groups')}
      >
        ← Back to Group List
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Group Info Section */}
        <div className="glass-card animate-fade-in" style={{ padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                }}
              >
                💬
              </div>
              <div>
                <h1 className="font-display" style={{ fontSize: 24, fontWeight: 800 }}>{group.title}</h1>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, fontFamily: 'monospace' }}>{group.chat_id}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-primary" onClick={() => setShowEdit(true)}>✏️ Edit Group</button>
              <button className="btn-danger" onClick={handleDelete}>🗑️ Delete</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
             <div className="stat-card">
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Telegram Link</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--neon-yellow)', wordBreak: 'break-all' }}>{group.invite_link}</div>
             </div>
             <div className="stat-card">
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Created At</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(group.created_at)}</div>
             </div>
          </div>
        </div>

        {/* Custom Message Feature */}
        <div className="glass-card animate-fade-in" style={{ padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800 }}>💬 Message History</h2>
            <button className="btn-primary" onClick={() => setShowSendMessageModal(true)}>
              + New Message
            </button>
          </div>
          
          {loadingMessages ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>Loading messages...</div>
          ) : messages.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
              No custom messages have been sent to this group yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-secondary)', color: 'var(--text-muted)', fontSize: 12 }}>
                    <th style={{ padding: '16px 8px', width: '20%' }}>DATE</th>
                    <th style={{ padding: '16px 8px', width: '20%' }}>SENT BY</th>
                    <th style={{ padding: '16px 8px', width: '60%' }}>MESSAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-secondary)', fontSize: 14 }}>
                      <td style={{ padding: '16px 8px' }}>{formatDate(m.created_at)}</td>
                      <td style={{ padding: '16px 8px', fontWeight: 600 }}>{m.sent_by}</td>
                      <td style={{ padding: '16px 8px', wordBreak: 'break-word' }}>{m.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="glass-card animate-scale-in" style={{ maxWidth: 450, width: '100%', padding: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>Edit Battle Group</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Group Title</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="input-field" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Chat ID</label>
                <input type="text" value={editChatId} onChange={e => setEditChatId(e.target.value)} className="input-field" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Invite Link</label>
                <input type="url" value={editInviteLink} onChange={e => setEditInviteLink(e.target.value)} className="input-field" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleEditSave()}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Send Message Modal */}
      {showSendMessageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="glass-card animate-scale-in" style={{ maxWidth: 500, width: '100%', padding: 32, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>💬 New Bot Message</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Send a custom message or announcement to the Telegram group.</p>
            
            <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Message Input */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Message Text</label>
                <textarea
                  className="input-field"
                  placeholder="Type your message here..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  style={{ minHeight: 120, resize: 'vertical' }}
                />
              </div>

              {/* Image Picker */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Attachment (Optional)</label>
                
                {!imagePreview ? (
                  <label 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      height: 100, 
                      border: '2px dashed var(--border-secondary)', 
                      borderRadius: 12, 
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.02)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-secondary)'}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click to attach an image</div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                ) : (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-secondary)' }}>
                    <img src={imagePreview} alt="Preview" style={{ width: '100%', display: 'block', maxHeight: 250, objectFit: 'contain', background: '#000' }} />
                    <button 
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); }}
                      style={{ 
                        position: 'absolute', top: 8, right: 8, 
                        background: 'rgba(0,0,0,0.7)', color: 'white', 
                        border: 'none', borderRadius: '50%', 
                        width: 28, height: 28, 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        cursor: 'pointer', fontSize: 14 
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowSendMessageModal(false); setImageFile(null); setImagePreview(null); setNewMessage(''); }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={sendingMessage || (!newMessage.trim() && !imageFile)}>
                  {sendingMessage ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
