// ========================
// Telegram Bot Core Logic
// Ghost Referee Match State Machine
// ========================
// This module handles the entire match flow through Telegram groups.
// It manages room pooling, inline keyboards, chat permissions, and auto-wipe.

import { READY_CHECK_TIMEOUT, NEGOTIATION_TIMEOUT, NOSHOW_WARNING_TIMEOUT, BATTLE_MINIMUM_DURATION, PLATFORM_COMMISSION_RATE, ROOM_OCCUPANCY_FEE } from './constants';
import type { Match, MatchStatus, TelegramRoom } from './types';
import { generateMatchCode } from './utils';

// ========================
// Match State Machine
// ========================

export interface MatchStateTransition {
  from: MatchStatus;
  to: MatchStatus;
  trigger: string;
  action: string;
}

export const STATE_TRANSITIONS: MatchStateTransition[] = [
  { from: 'OPEN', to: 'WAITING', trigger: 'Opponent accepts challenge', action: 'Freeze opponent funds, redirect to Telegram' },
  { from: 'WAITING', to: 'READY_CHECK', trigger: 'Both players in group', action: 'Send READY TO START buttons, start 120s timer' },
  { from: 'READY_CHECK', to: 'NEGOTIATION', trigger: 'Both clicked READY', action: 'Unmute chat, start 5min negotiation timer' },
  { from: 'READY_CHECK', to: 'VOIDED', trigger: 'Timer expired (120s)', action: 'Ban both, refund 100%, wipe room' },
  { from: 'NEGOTIATION', to: 'BATTLE', trigger: 'Timer ends / both confirm', action: 'Mute all, pin match code, wait 10+ min' },
  { from: 'NEGOTIATION', to: 'VOIDED', trigger: '/noshow + 3min warning expires', action: 'Mute, flag for admin, charge room fee' },
  { from: 'BATTLE', to: 'SUBMISSION', trigger: '10-15 min elapsed', action: 'Set media-only, send WON/LOST buttons' },
  { from: 'SUBMISSION', to: 'VERIFICATION', trigger: 'Claims submitted + screenshot', action: 'Download photo, run OCR' },
  { from: 'SUBMISSION', to: 'DISPUTED', trigger: 'Both claim WON', action: 'Mute, alert admin' },
  { from: 'SUBMISSION', to: 'VOIDED', trigger: '15min timeout', action: 'Charge room fee, refund rest' },
  { from: 'VERIFICATION', to: 'COMPLETED', trigger: 'OCR verified', action: 'Release 95% to winner, 5% commission' },
  { from: 'VERIFICATION', to: 'DISPUTED', trigger: 'OCR mismatch', action: 'Flag for admin review' },
  { from: 'COMPLETED', to: 'ARCHIVED', trigger: 'Payout done', action: 'Archive chat, wipe, recycle room' },
  { from: 'DISPUTED', to: 'COMPLETED', trigger: 'Admin resolves', action: 'Execute admin decision' },
  { from: 'DISPUTED', to: 'ARCHIVED', trigger: 'After completion', action: 'Archive and wipe' },
];

// ========================
// Bot Command Handlers
// ========================

export interface BotMessage {
  type: 'text' | 'inline_keyboard' | 'permission_change' | 'pin' | 'kick' | 'ban' | 'unban';
  text?: string;
  buttons?: Array<{ text: string; callback_data: string }[]>;
  permissions?: Record<string, boolean>;
}

export function generateReadyCheckMessage(): BotMessage {
  return {
    type: 'inline_keyboard',
    text: '⚔️ **MATCH FOUND!**\n\nBoth players are in the room. Click the button below when you\'re ready to start.\n\n⏰ You have **2 minutes** to click or the match will be voided.',
    buttons: [
      [{ text: '🚀 READY TO START', callback_data: 'ready_start' }],
    ],
  };
}

export function generateNegotiationMessage(matchCode: string): BotMessage {
  return {
    type: 'text',
    text: `✅ **Both players are READY!**\n\n📝 **Negotiation Phase** (5 minutes)\n\nExchange your MLBB IDs and passwords now.\n\n🔑 Match Code: **${matchCode}**\n\n⚠️ If your opponent is unresponsive, type /noshow\n\n_Chat will be muted when the timer ends._`,
  };
}

export function generateBattleMessage(matchCode: string): BotMessage {
  return {
    type: 'text',
    text: `🔇 **BATTLE MODE ACTIVATED**\n\n📌 Match Code: **${matchCode}**\n\nChat is now muted. Play your MLBB match.\n\nThe submission phase will begin in approximately 10-15 minutes.\n\n_Good luck, warriors! 👻⚔️_`,
  };
}

export function generateSubmissionMessage(): BotMessage {
  return {
    type: 'inline_keyboard',
    text: '🏁 **MATCH OVER!**\n\nSelect your result below. **The winner must upload the scoreboard screenshot.**\n\n⚠️ Lying about your result will result in a **permanent ban**.',
    buttons: [
      [
        { text: '🏆 I WON', callback_data: 'claim_won' },
        { text: '💀 I LOST', callback_data: 'claim_lost' },
      ],
    ],
  };
}

export function generateDisputeMessage(): BotMessage {
  return {
    type: 'text',
    text: '🚨 **DISPUTE DETECTED**\n\nBoth players claimed victory. Chat has been muted.\n\n🧑‍⚖️ Admin has been notified and will review the screenshot and chat logs.\n\n_Do not leave the group._',
  };
}

export function generateWinnerMessage(winnerName: string, payoutAmount: number): BotMessage {
  return {
    type: 'text',
    text: `🎉 **MATCH VERIFIED!**\n\n🏆 Winner: **${winnerName}**\n💰 Payout: **${payoutAmount.toLocaleString()} MMK**\n\n✅ AI Referee has verified the result.\nFunds have been released to the winner's wallet.\n\n_This room will be archived and cleaned shortly. 👻_`,
  };
}

// ========================
// Room Pool Manager
// ========================

export function getAvailableRoom(rooms: TelegramRoom[]): TelegramRoom | null {
  return rooms.find((r) => r.status === 'AVAILABLE') || null;
}

export function calculatePayout(stakeAmount: number): {
  totalPot: number;
  commission: number;
  winnerPayout: number;
} {
  const totalPot = stakeAmount * 2;
  const commission = totalPot * PLATFORM_COMMISSION_RATE;
  const winnerPayout = totalPot - commission;
  return { totalPot, commission, winnerPayout };
}

// ========================
// OCR Verification Logic
// ========================

export interface OCRResult {
  victory: boolean;
  battleId: string | null;
  timestamp: string | null;
  usernames: string[];
  confidence: number;
  raw_text: string;
}

export function validateOCRResult(ocrResult: OCRResult, match: Match): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for "Victory" text
  if (!ocrResult.victory) {
    errors.push('No "Victory" status detected in screenshot');
  }

  // Check Battle ID format
  if (!ocrResult.battleId) {
    errors.push('Battle ID not found in screenshot');
  }

  // Check usernames match profiles
  if (ocrResult.usernames.length < 2) {
    errors.push('Could not extract player usernames from screenshot');
  }

  // Check confidence threshold
  if (ocrResult.confidence < 0.7) {
    errors.push(`OCR confidence too low: ${(ocrResult.confidence * 100).toFixed(1)}%`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ========================
// Auto-Wipe Procedure
// ========================

export interface WipeStep {
  action: string;
  apiMethod: string;
  description: string;
}

export const WIPE_PROCEDURE: WipeStep[] = [
  {
    action: 'Archive Chat',
    apiMethod: 'DB INSERT INTO match_logs',
    description: 'Save all messages and media to database',
  },
  {
    action: 'Save Screenshots',
    apiMethod: 'Supabase Storage upload',
    description: 'Upload all match screenshots to cloud storage',
  },
  {
    action: 'Ban Players',
    apiMethod: 'banChatMember (revoke_messages: true)',
    description: 'Permanently delete all message history from Telegram',
  },
  {
    action: 'Unban Players',
    apiMethod: 'unbanChatMember',
    description: 'Allow players to rejoin future matches',
  },
  {
    action: 'Reset Room',
    apiMethod: 'DB UPDATE rooms SET status = AVAILABLE',
    description: 'Mark room as available for next match',
  },
];

// ========================
// Penalty Logic
// ========================

export type PenaltyType = 'NO_READY' | 'NO_SUBMISSION' | 'MALICIOUS_LYING';

export interface PenaltyAction {
  type: PenaltyType;
  description: string;
  refundPercent: number;
  fee: number;
  banPermanent: boolean;
}

export const PENALTIES: Record<PenaltyType, PenaltyAction> = {
  NO_READY: {
    type: 'NO_READY',
    description: 'Player did not click READY within 2 minutes',
    refundPercent: 100,
    fee: 0,
    banPermanent: false,
  },
  NO_SUBMISSION: {
    type: 'NO_SUBMISSION',
    description: 'Match timed out with no submission after 15 minutes',
    refundPercent: 100,
    fee: ROOM_OCCUPANCY_FEE,
    banPermanent: false,
  },
  MALICIOUS_LYING: {
    type: 'MALICIOUS_LYING',
    description: 'Player claimed WON but evidence shows they lost',
    refundPercent: 0,
    fee: 0,
    banPermanent: true,
  },
};
