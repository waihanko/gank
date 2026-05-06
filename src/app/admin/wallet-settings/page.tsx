'use client';

import { useState, useEffect } from 'react';
import { useDialog } from '@/lib/dialog-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface AdminWallet {
  id: string;
  type: string;
  account_number: string;
  holder_name: string;
  transaction_type: 'DEPOSIT' | 'WITHDRAWAL' | 'BOTH';
  is_active: boolean;
}

export default function WalletSettingsPage() {
  const { showAlert, showConfirm } = useDialog();
  const [wallets, setWallets] = useState<AdminWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<AdminWallet | null>(null);

  // Form State
  const [type, setType] = useState('Kpay');
  const [accountNumber, setAccountNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [transactionType, setTransactionType] = useState<'DEPOSIT' | 'WITHDRAWAL' | 'BOTH'>('BOTH');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, []);

  async function fetchWallets() {
    setLoading(true);
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/wallets`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (res.status === 401 || res.status === 403) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (data.success) setWallets(data.data);
    } catch (error) {
      console.error('Failed to fetch wallets:', error);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingWallet(null);
    setType('Kpay');
    setAccountNumber('');
    setHolderName('');
    setTransactionType('BOTH');
    setIsActive(true);
    setShowModal(true);
  }

  function openEditModal(wallet: AdminWallet) {
    setEditingWallet(wallet);
    setType(wallet.type);
    setAccountNumber(wallet.account_number);
    setHolderName(wallet.holder_name);
    setTransactionType(wallet.transaction_type);
    setIsActive(wallet.is_active);
    setShowModal(true);
  }

  async function handleSave() {
    // Validation
    if (!accountNumber.match(/^\d+$/)) return showAlert('Account number must contain only digits.');
    if (!holderName.trim()) return showAlert('Holder name is required.');
    if (!holderName.match(/^[a-zA-Z\s]+$/)) return showAlert('Holder name must contain only letters and spaces.');

    setSaving(true);
    const token = localStorage.getItem('gr_admin_token');
    const payload = {
      type,
      account_number: accountNumber,
      holder_name: holderName,
      transaction_type: transactionType,
      is_active: isActive,
    };

    try {
      const url = editingWallet ? `${API_URL}/api/admin/wallets/${editingWallet.id}` : `${API_URL}/api/admin/wallets`;
      const method = editingWallet ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchWallets();
        showAlert(editingWallet ? 'Wallet updated successfully!' : 'Wallet added successfully!');
      } else {
        showAlert(data.error || 'Failed to save wallet.');
      }
    } catch (error) {
      showAlert('Network error.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    showConfirm('Are you sure you want to delete this wallet?', async () => {
      const token = localStorage.getItem('gr_admin_token');
      try {
        const res = await fetch(`${API_URL}/api/admin/wallets/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          fetchWallets();
          showAlert('Wallet deleted.');
        } else {
          showAlert('Failed to delete.');
        }
      } catch (error) {
        showAlert('Network error.');
      }
    });
  }

  async function toggleStatus(wallet: AdminWallet) {
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/wallets/${wallet.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ is_active: !wallet.is_active }),
      });
      const data = await res.json();
      if (data.success) {
        setWallets(wallets.map(w => w.id === wallet.id ? { ...w, is_active: !wallet.is_active } : w));
      }
    } catch (error) {}
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
            💳 <span className="gradient-text">Wallet Settings</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Manage platform payment accounts for deposits and withdrawals
          </p>
        </div>
        <button className="btn-primary" onClick={openAddModal}>
          + Add New Wallet
        </button>
      </div>

      {/* Data Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-secondary)' }}>
            <tr>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Account Number</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Holder Name</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Transaction Type</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading wallets...</td></tr>
            ) : wallets.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No wallets configured yet.</td></tr>
            ) : wallets.map((wallet) => (
              <tr key={wallet.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} className="table-row-hover">
                <td style={{ padding: '16px 24px' }}>
                  <span style={{ 
                    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: wallet.type === 'Kpay' ? 'rgba(59,130,246,0.1)' : 'rgba(234,179,8,0.1)',
                    color: wallet.type === 'Kpay' ? '#60a5fa' : '#facc15',
                    border: `1px solid ${wallet.type === 'Kpay' ? 'rgba(59,130,246,0.2)' : 'rgba(234,179,8,0.2)'}`
                  }}>
                    {wallet.type}
                  </span>
                </td>
                <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600 }}>{wallet.account_number}</td>
                <td style={{ padding: '16px 24px', fontSize: 14 }}>{wallet.holder_name}</td>
                <td style={{ padding: '16px 24px' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{wallet.transaction_type}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div 
                    onClick={() => toggleStatus(wallet)}
                    style={{ 
                      width: 40, height: 20, borderRadius: 10, cursor: 'pointer',
                      background: wallet.is_active ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                      position: 'relative', transition: 'all 0.3s'
                    }}
                  >
                    <div style={{ 
                      width: 16, height: 16, borderRadius: '50%', background: 'white',
                      position: 'absolute', top: 2, left: wallet.is_active ? 22 : 2,
                      transition: 'all 0.3s'
                    }} />
                  </div>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => openEditModal(wallet)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>✏️ Edit</button>
                    <button onClick={() => handleDelete(wallet.id)} style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#ef4444' }}>🗑️ Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={() => setShowModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} />
          <div className="glass-card" style={{ position: 'relative', width: '100%', maxWidth: 450, padding: 32, animation: 'modalIn 0.3s ease' }}>
            <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>
              {editingWallet ? '✏️ Edit Wallet' : '➕ Add New Wallet'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Wallet Type</label>
                <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="Kpay">Kpay</option>
                  <option value="Wave Pay">Wave Pay</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Account Number (Digits Only)</label>
                <input 
                  className="input-field" 
                  placeholder="e.g. 09123456789" 
                  value={accountNumber} 
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Holder Name</label>
                <input 
                  className="input-field" 
                  placeholder="e.g. John Doe" 
                  value={holderName} 
                  onChange={(e) => setHolderName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Transaction Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(['DEPOSIT', 'WITHDRAWAL', 'BOTH'] as const).map((t) => (
                    <button 
                      key={t}
                      onClick={() => setTransactionType(t)}
                      style={{
                        padding: '10px 4px', borderRadius: 10, border: '1px solid', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        borderColor: transactionType === t ? 'var(--accent-primary)' : 'var(--border-secondary)',
                        background: transactionType === t ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.03)',
                        color: transactionType === t ? 'var(--accent-primary)' : 'var(--text-muted)',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Active Status</span>
                <div 
                  onClick={() => setIsActive(!isActive)}
                  style={{ 
                    width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                    background: isActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                    position: 'relative', transition: 'all 0.3s'
                  }}
                >
                  <div style={{ 
                    width: 20, height: 20, borderRadius: '50%', background: 'white',
                    position: 'absolute', top: 2, left: isActive ? 22 : 2,
                    transition: 'all 0.3s'
                  }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowModal(false)} 
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSave} 
                disabled={saving} 
                style={{ flex: 2, justifyContent: 'center' }}
              >
                {saving ? 'Saving...' : (editingWallet ? 'Update Wallet' : 'Create Wallet')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .table-row-hover:hover { background: rgba(255,255,255,0.02); }
        @keyframes modalIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
