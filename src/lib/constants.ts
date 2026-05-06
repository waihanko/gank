// ========================
// Platform Constants
// ========================

export const PLATFORM_NAME = 'Good Game';
export const PLATFORM_TAGLINE = 'Automated MLBB Escrow & Matchmaking';
export const PLATFORM_COMMISSION_RATE = 0.05; // 5%
export const PLATFORM_CURRENCY = 'MMK';

// ========================
// Match Timers (in seconds)
// ========================

export const READY_CHECK_TIMEOUT = 120; // 2 minutes
export const NEGOTIATION_TIMEOUT = 300; // 5 minutes
export const NOSHOW_WARNING_TIMEOUT = 180; // 3 minutes
export const BATTLE_MINIMUM_DURATION = 600; // 10 minutes
export const SUBMISSION_TIMEOUT = 900; // 15 minutes
export const ROOM_OCCUPANCY_FEE = 500; // MMK

// ========================
// Match Status Labels & Colors
// ========================

export const MATCH_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  PENDING_JOIN: { label: '⏳ Pending Join', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)' },
  ACTIVE: { label: '🟢 Active', color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)' },
  ACCEPTED: { label: '🤝 Accepted', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)' },
  OPEN: { label: 'Open', color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)' },
  WAITING: { label: '⏱️ Waiting', color: '#eab308', bgColor: 'rgba(234,179,8,0.15)' },
  READY_CHECK: { label: 'Ready Check', color: '#f97316', bgColor: 'rgba(249,115,22,0.15)' },
  NEGOTIATION: { label: 'Negotiation', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)' },
  BATTLE: { label: 'In Battle', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)' },
  SUBMISSION: { label: 'Submission', color: '#a855f7', bgColor: 'rgba(168,85,247,0.15)' },
  VERIFICATION: { label: 'Verifying', color: '#6366f1', bgColor: 'rgba(99,102,241,0.15)' },
  COMPLETED: { label: 'Completed', color: '#10b981', bgColor: 'rgba(16,185,129,0.15)' },
  DISPUTED: { label: '⚠️ Disputed', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)' },
  VOIDED: { label: 'Voided', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)' },
  CANCELLED: { label: 'Cancelled', color: '#6b7280', bgColor: 'rgba(107,114,128,0.15)' },
  ARCHIVED: { label: 'Archived', color: '#9ca3af', bgColor: 'rgba(156,163,175,0.15)' },
};

// ========================
// Navigation
// ========================

export const PUBLIC_NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Matches', href: '/matches' },
  { label: 'Leaderboard', href: '/leaderboard' },
];

export const ADMIN_NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: 'LayoutDashboard' },
  { label: 'Matches', href: '/admin/matches', icon: 'Swords' },
  { label: 'Disputes', href: '/admin/disputes', icon: 'AlertTriangle' },
  { label: 'Players', href: '/admin/users', icon: 'Users' },
  { label: 'Groups', href: '/admin/groups', icon: 'MessageSquare' },
  { label: 'Announcements', href: '/admin/announcements', icon: 'Megaphone' },
  { label: 'Revenue', href: '/admin/revenue', icon: 'DollarSign' },
  { label: 'Transactions', href: '/admin/transactions', icon: 'ArrowLeftRight' },
  { label: 'Wallet Trans.', href: '/admin/wallet-transactions', icon: 'Wallet' },
  { label: 'Wallet Settings', href: '/admin/wallet-settings', icon: 'WalletSettings' },
  { label: 'System Setting', href: '/admin/settings', icon: 'Settings' },
  { label: 'Admins', href: '/admin/admins', icon: 'ShieldAccount' },
  { label: 'Profile', href: '/admin/profile', icon: 'Users' },
];
