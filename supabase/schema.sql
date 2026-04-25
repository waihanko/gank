-- =============================================
-- Ghost Referee Platform: Database Schema
-- Supabase PostgreSQL
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================
-- Users Table
-- ========================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    telegram_id TEXT UNIQUE,
    telegram_username TEXT,
    mlbb_id TEXT,
    mlbb_ign TEXT,
    avatar_url TEXT,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Wallets Table
-- ========================
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(12, 2) DEFAULT 0,
    frozen_amount DECIMAL(12, 2) DEFAULT 0,
    total_deposited DECIMAL(12, 2) DEFAULT 0,
    total_withdrawn DECIMAL(12, 2) DEFAULT 0,
    total_won DECIMAL(12, 2) DEFAULT 0,
    total_lost DECIMAL(12, 2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: balance cannot be negative
ALTER TABLE wallets ADD CONSTRAINT positive_balance CHECK (balance >= 0);
ALTER TABLE wallets ADD CONSTRAINT positive_frozen CHECK (frozen_amount >= 0);

-- ========================
-- Telegram Rooms Pool
-- ========================
CREATE TABLE telegram_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id TEXT UNIQUE NOT NULL,
    invite_link TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'DISABLED')),
    current_match_id UUID,
    total_matches_hosted INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Matches Table
-- ========================
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenger_id UUID NOT NULL REFERENCES users(id),
    opponent_id UUID REFERENCES users(id),
    stake_amount DECIMAL(12, 2) NOT NULL CHECK (stake_amount >= 500),
    total_pot DECIMAL(12, 2) DEFAULT 0,
    commission DECIMAL(12, 2) DEFAULT 0,
    status TEXT DEFAULT 'OPEN' CHECK (status IN (
        'OPEN', 'WAITING', 'READY_CHECK', 'NEGOTIATION',
        'BATTLE', 'SUBMISSION', 'VERIFICATION',
        'COMPLETED', 'DISPUTED', 'VOIDED', 'ARCHIVED'
    )),
    room_id UUID REFERENCES telegram_rooms(id),
    match_code TEXT,
    winner_id UUID REFERENCES users(id),
    loser_id UUID REFERENCES users(id),
    challenger_ready BOOLEAN DEFAULT FALSE,
    opponent_ready BOOLEAN DEFAULT FALSE,
    challenger_claim TEXT CHECK (challenger_claim IN ('WON', 'LOST')),
    opponent_claim TEXT CHECK (opponent_claim IN ('WON', 'LOST')),
    screenshot_url TEXT,
    ocr_result JSONB,
    ocr_verified BOOLEAN DEFAULT FALSE,
    dispute_reason TEXT,
    resolved_by UUID REFERENCES users(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Self-challenge prevention
ALTER TABLE matches ADD CONSTRAINT no_self_challenge CHECK (challenger_id != opponent_id);

-- ========================
-- Transactions Table
-- ========================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    user_id UUID NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN (
        'DEPOSIT', 'WITHDRAWAL', 'FREEZE', 'RELEASE',
        'PAYOUT', 'COMMISSION', 'REFUND', 'ROOM_FEE'
    )),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    match_id UUID REFERENCES matches(id),
    description TEXT NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Match Chat Logs (Archive)
-- ========================
CREATE TABLE match_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_telegram_id TEXT NOT NULL,
    sender_username TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'photo', 'sticker', 'system')),
    content TEXT NOT NULL,
    media_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Match Screenshots
-- ========================
CREATE TABLE match_screenshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    file_url TEXT NOT NULL,
    ocr_raw_text TEXT,
    ocr_victory BOOLEAN,
    ocr_battle_id TEXT,
    ocr_usernames TEXT[],
    ocr_confidence DECIMAL(5, 4),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Disputes Table
-- ========================
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id),
    reported_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    evidence_urls TEXT[],
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWING', 'RESOLVED')),
    resolution TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Platform Revenue Table
-- ========================
CREATE TABLE platform_revenue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_challenger ON matches(challenger_id);
CREATE INDEX idx_matches_opponent ON matches(opponent_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_match_logs_match ON match_logs(match_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_rooms_status ON telegram_rooms(status);
CREATE INDEX idx_wallets_user ON wallets(user_id);

-- ========================
-- Triggers: Auto-update timestamps
-- ========================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_wallets_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_matches_updated_at
    BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON telegram_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- Row Level Security (RLS)
-- ========================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY users_read_own ON users
    FOR SELECT USING (auth.uid() = id);

-- Users can read their own wallet
CREATE POLICY wallets_read_own ON wallets
    FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own transactions
CREATE POLICY transactions_read_own ON transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Users can read matches they're involved in
CREATE POLICY matches_read_involved ON matches
    FOR SELECT USING (
        auth.uid() = challenger_id OR auth.uid() = opponent_id
    );

-- Open matches readable by all authenticated users
CREATE POLICY matches_read_open ON matches
    FOR SELECT USING (status = 'OPEN');
