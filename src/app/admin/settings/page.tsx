'use client';

import { useState, useEffect } from 'react';
import { useDialog } from '@/lib/dialog-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminSettingsPage() {
  const { showAlert } = useDialog();
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [commission, setCommission] = useState('5'); // Percent

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setSettings(json.data);
        const comm = json.data.find((s: any) => s.key === 'commission_rate');
        if (comm) {
          setCommission((parseFloat(comm.value) * 100).toString());
        }
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function saveSetting(key: string, value: string) {
    setSaving(true);
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key, value })
      });
      const json = await res.json();
      if (json.success) {
        showAlert('Setting updated successfully!', { icon: '✅' });
        fetchSettings();
      } else {
        showAlert(json.error || 'Failed to update setting', { icon: '❌' });
      }
    } catch (err) {
      showAlert('Network error', { icon: '❌' });
    }
    setSaving(false);
  }

  const handleCommissionSave = () => {
    const rate = parseFloat(commission) / 100;
    if (isNaN(rate) || rate < 0 || rate > 1) {
      showAlert('Invalid commission rate. Must be between 0 and 100.', { icon: '⚠️' });
      return;
    }
    saveSetting('commission_rate', rate.toString());
  };

  if (loading) return <div className="page-container">Loading settings...</div>;

  return (
    <div className="page-container">
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
          ⚙️ <span className="gradient-text">System Setting</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Manage global platform parameters and financial rules
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 24 }}>
        {/* Commission Setting */}
        <div className="glass-card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              💎
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Platform Commission</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Percentage taken from the total match pot</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Commission Rate (%)
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input 
                    type="number"
                    className="input-field"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    placeholder="5"
                    step="0.1"
                    min="0"
                    max="100"
                  />
                  <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>%</span>
                </div>
                <button 
                  className="btn-primary" 
                  style={{ minWidth: 100 }}
                  onClick={handleCommissionSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border-secondary)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Preview with {commission}%:</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span>Stake Amount:</span>
                <span style={{ color: 'var(--text-primary)' }}>5,000 MMK</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 4 }}>
                <span>Total Pot:</span>
                <span style={{ color: 'var(--text-primary)' }}>10,000 MMK</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 4, color: 'var(--neon-purple)', fontWeight: 700 }}>
                <span>Platform Fee:</span>
                <span>{(10000 * (parseFloat(commission) || 0) / 100).toLocaleString()} MMK</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 4, color: 'var(--neon-green)', fontWeight: 700 }}>
                <span>Winner Payout:</span>
                <span>{(10000 * (1 - (parseFloat(commission) || 0) / 100)).toLocaleString()} MMK</span>
              </div>
            </div>
          </div>
        </div>

        {/* Future Settings Placeholder */}
        <div className="glass-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: 0.6 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>➕</div>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>More Settings Soon</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 250 }}>
            Minimum stake, timeout durations, and automated withdrawal limits will be added here.
          </p>
        </div>
      </div>
    </div>
  );
}
