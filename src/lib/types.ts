// ========================
// Database Types
// ========================

export type MatchStatus =
  | 'OPEN'
  | 'WAITING'
  | 'READY_CHECK'
  | 'NEGOTIATION'
  | 'BATTLE'
  | 'SUBMISSION'
  | 'VERIFICATION'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'VOIDED'
  | 'ARCHIVED';

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'FREEZE'
  | 'RELEASE'
  | 'PAYOUT'
  | 'COMMISSION'
  | 'REFUND'
  | 'ROOM_FEE';

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'DISABLED';

export interface User {
  id: string;
  email: string;
  username: string;
  telegram_id: string | null;
  telegram_username: string | null;
  mlbb_id: string | null;
  mlbb_ign: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
  is_banned: boolean;
  ban_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  frozen_amount: number;
  total_deposited: number;
  total_withdrawn: number;
  total_won: number;
  total_lost: number;
  updated_at: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  match_id: string | null;
  description: string;
  reference_id: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  challenger_id: string;
  opponent_id: string | null;
  stake_amount: number;
  total_pot: number;
  commission: number;
  status: MatchStatus;
  room_id: string | null;
  match_code: string | null;
  winner_id: string | null;
  loser_id: string | null;
  challenger_ready: boolean;
  opponent_ready: boolean;
  challenger_claim: 'WON' | 'LOST' | null;
  opponent_claim: 'WON' | 'LOST' | null;
  screenshot_url: string | null;
  ocr_result: Record<string, unknown> | null;
  ocr_verified: boolean;
  dispute_reason: string | null;
  resolved_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  challenger?: User;
  opponent?: User;
  room?: TelegramRoom;
}

export interface MatchLog {
  id: string;
  match_id: string;
  sender_telegram_id: string;
  sender_username: string;
  message_type: 'text' | 'photo' | 'sticker' | 'system';
  content: string;
  media_url: string | null;
  created_at: string;
}

export interface TelegramRoom {
  id: string;
  chat_id: string;
  invite_link: string;
  title: string;
  status: RoomStatus;
  current_match_id: string | null;
  total_matches_hosted: number;
  created_at: string;
  updated_at: string;
}

export interface Dispute {
  id: string;
  match_id: string;
  reported_by: string;
  reason: string;
  evidence_urls: string[];
  status: 'PENDING' | 'REVIEWING' | 'RESOLVED';
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  match?: Match;
}

export interface PlatformRevenue {
  id: string;
  match_id: string;
  amount: number;
  created_at: string;
}

// ========================
// API Response Types
// ========================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ========================
// Dashboard Stats
// ========================

export interface DashboardStats {
  totalUsers: number;
  totalMatches: number;
  activeMatches: number;
  totalRevenue: number;
  todayMatches: number;
  todayRevenue: number;
  availableRooms: number;
  pendingDisputes: number;
}
