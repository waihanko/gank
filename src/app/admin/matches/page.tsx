'use client';

import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDate, formatRelativeTime, shortenId } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const matchesPerPage = 20;
  const router = useRouter();
  const statuses = ['All', 'OPEN', 'ACCEPTED', 'BATTLE', 'COMPLETED', 'DISPUTED'];

  // Set default dates to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFromDate(today);
    setToDate(today);
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [statusFilter, fromDate, toDate, currentPage]);

  async function fetchMatches() {
    setLoading(true);
    const token = localStorage.getItem('gr_admin_token');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      params.append('page', currentPage.toString());
      params.append('limit', matchesPerPage.toString());
      
      const url = `${API_URL}/api/admin/matches?${params.toString()}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('gr_admin_token');
        window.location.href = '/admin/login';
        return;
      }
      
      const data = await res.json();
      if (data.success) {
        setMatches(data.data);
        setTotalPages(Math.ceil(data.total / matchesPerPage));
      }
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    }
    setLoading(false);
  }

  const filtered = matches.filter((m) => {
    const matchesSearch = search === '' || m.id.includes(search) || m.challenger?.username?.toLowerCase().includes(search.toLowerCase()) || m.opponent?.username?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="page-container">
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
          ⚔️ <span className="gradient-text">Match Management</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          View, monitor, and manage all matches
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input-field"
          placeholder="🔍 Search by ID, username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <select
          className="input-field"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ maxWidth: 200 }}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>From:</label>
          <input
            type="date"
            className="input-field"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setCurrentPage(1);
            }}
            style={{ maxWidth: 150 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>To:</label>
          <input
            type="date"
            className="input-field"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setCurrentPage(1);
            }}
            style={{ maxWidth: 150 }}
          />
        </div>
      </div>

      {/* Matches Table */}
      <div className="glass-card" style={{ overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading matches...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Match ID</th>
                <th>Challenger</th>
                <th>Opponent</th>
                <th>Stake</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((match) => (
                <tr key={match.id}>
                  <td 
                    style={{ 
                      fontFamily: 'monospace', 
                      fontSize: 12, 
                      fontWeight: 600, 
                      cursor: 'pointer',
                      color: 'var(--text-primary)' 
                    }}
                    title="Click to copy full ID"
                    onClick={() => {
                      navigator.clipboard.writeText(match.id);
                      // Minimal visual feedback
                      const cell = document.getElementById(`id-cell-${match.id}`);
                      if (cell) {
                        const original = cell.innerText;
                        cell.innerText = 'Copied!';
                        setTimeout(() => { cell.innerText = original; }, 1000);
                      }
                    }}
                  >
                    <span id={`id-cell-${match.id}`}>{shortenId(match.id)}</span>
                  </td>
                  <td>
                    <div style={{ 
                      fontWeight: 600, 
                      fontSize: 13, 
                      color: match.winner_id === match.challenger_id ? 'var(--neon-yellow)' : 'var(--text-primary)' 
                    }}>
                      {match.winner_id === match.challenger_id && '🏆 '}{match.challenger?.username}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{match.challenger?.mlbb_ign}</div>
                  </td>
                  <td>
                    {match.opponent ? (
                      <>
                        <div style={{ 
                          fontWeight: 600, 
                          fontSize: 13, 
                          color: match.winner_id === match.opponent_id ? 'var(--neon-yellow)' : 'var(--text-primary)' 
                        }}>
                          {match.winner_id === match.opponent_id && '🏆 '}{match.opponent?.username}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{match.opponent?.mlbb_ign}</div>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                    )}
                  </td>
                  <td className="font-display" style={{ fontWeight: 600, color: 'var(--neon-yellow)', fontSize: 13 }}>
                    {formatCurrency(match.stake_amount)}
                  </td>
                  <td><StatusBadge status={match.status} size="sm" /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatRelativeTime(match.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {match.status === 'DISPUTED' && (
                        <button className="btn-danger btn-sm">Resolve</button>
                      )}
                      {(match.status === 'OPEN' || match.status === 'WAITING') && (
                        <button className="btn-secondary btn-sm" style={{ fontSize: 11 }}>Void</button>
                      )}
                      <button 
                        className="btn-secondary btn-sm" 
                        style={{ fontSize: 11 }}
                        onClick={() => router.push(`/admin/matches/${match.id}`)}
                      >
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No matches found</div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 }}>
          <button
            className="btn-secondary btn-sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 12px' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn-secondary btn-sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
