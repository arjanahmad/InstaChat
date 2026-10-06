-- =========================================================================
-- INSTAChat — Production PostgreSQL & Supabase Database Architecture
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & PROFILES TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    username_lower VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    profile_image_url TEXT,
    bio TEXT DEFAULT '',
    custom_status TEXT DEFAULT '',
    coins INTEGER DEFAULT 100,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    tictactoe_wins INTEGER DEFAULT 0,
    connectfour_wins INTEGER DEFAULT 0,
    rps_wins INTEGER DEFAULT 0,
    online BOOLEAN DEFAULT false,
    last_active BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(username_lower);
CREATE INDEX IF NOT EXISTS idx_users_online ON users(online);

-- 2. FRIEND REQUESTS TABLE
CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id TEXT UNIQUE NOT NULL,
    sender_id TEXT NOT NULL,
    sender_username VARCHAR(50) NOT NULL,
    sender_profile_image_url TEXT,
    receiver_id TEXT NOT NULL,
    receiver_username VARCHAR(50) NOT NULL,
    receiver_profile_image_url TEXT,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id, status);

-- 3. FRIENDSHIPS TABLE
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_a TEXT NOT NULL,
    user_b TEXT NOT NULL,
    nickname_a VARCHAR(50) DEFAULT '',
    nickname_b VARCHAR(50) DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    UNIQUE(user_a, user_b)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_a ON friendships(user_a);
CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON friendships(user_b);

-- 4. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS conversations (
    conversation_id TEXT PRIMARY KEY,
    participants TEXT[] NOT NULL,
    participant_usernames JSONB DEFAULT '{}'::jsonb,
    last_message TEXT DEFAULT '',
    last_message_timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    last_sender_id TEXT DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING GIN(participants);

-- 5. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    message_id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    text TEXT DEFAULT '',
    message_type VARCHAR(20) DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'IMAGE', 'VIDEO', 'VOICE', 'DOCUMENT')),
    image_url TEXT,
    video_url TEXT,
    voice_url TEXT,
    voice_duration_seconds INTEGER DEFAULT 0,
    document_url TEXT,
    document_name VARCHAR(255),
    document_size BIGINT DEFAULT 0,
    document_mime_type VARCHAR(100),
    timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    status VARCHAR(20) DEFAULT 'SENT' CHECK (status IN ('SENDING', 'SENT', 'DELIVERED', 'READ')),
    is_read BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_messages_convo_timestamp ON messages(conversation_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_status ON messages(receiver_id, status);

-- 6. TYPING STATES TABLE
CREATE TABLE IF NOT EXISTS typing_states (
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username VARCHAR(50) NOT NULL,
    is_typing BOOLEAN DEFAULT false,
    timestamp BIGINT NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
);

-- 7. GAME INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS game_invitations (
    invitation_id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    sender_id TEXT NOT NULL,
    sender_username VARCHAR(50) NOT NULL,
    receiver_id TEXT NOT NULL,
    receiver_username VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
    timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_game_invites_receiver ON game_invitations(receiver_id, status);

-- 8. GAME ROOMS TABLE
CREATE TABLE IF NOT EXISTS game_rooms (
    room_id TEXT PRIMARY KEY,
    game_type VARCHAR(50) NOT NULL,
    player1_id TEXT NOT NULL,
    player1_username VARCHAR(50) NOT NULL,
    player2_id TEXT,
    player2_username VARCHAR(50),
    current_turn_player_id TEXT,
    status VARCHAR(20) DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'IN_PROGRESS', 'FINISHED', 'CANCELLED')),
    board_state JSONB DEFAULT '[]'::jsonb,
    p1_choice VARCHAR(20),
    p2_choice VARCHAR(20),
    p1_score INTEGER DEFAULT 0,
    p2_score INTEGER DEFAULT 0,
    current_round INTEGER DEFAULT 1,
    max_rounds INTEGER DEFAULT 3,
    last_round_result TEXT,
    winner_id TEXT,
    winner_username VARCHAR(50),
    is_draw BOOLEAN DEFAULT false,
    winning_line JSONB DEFAULT '[]'::jsonb,
    rematch_player1 BOOLEAN DEFAULT false,
    rematch_player2 BOOLEAN DEFAULT false,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 9. CALLS & PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS calls (
    call_id TEXT PRIMARY KEY,
    caller_id TEXT NOT NULL,
    caller_username VARCHAR(50) NOT NULL,
    receiver_id TEXT NOT NULL,
    receiver_username VARCHAR(50) NOT NULL,
    type VARCHAR(20) DEFAULT 'VOICE' CHECK (type IN ('VOICE', 'VIDEO')),
    status VARCHAR(20) DEFAULT 'RINGING' CHECK (status IN ('RINGING', 'CONNECTED', 'ENDED', 'REJECTED', 'BUSY', 'FAILED')),
    offer_sdp TEXT,
    answer_sdp TEXT,
    is_caller_muted BOOLEAN DEFAULT false,
    is_receiver_muted BOOLEAN DEFAULT false,
    is_caller_video_enabled BOOLEAN DEFAULT true,
    is_receiver_video_enabled BOOLEAN DEFAULT true,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    connected_at BIGINT,
    ended_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_calls_receiver_status ON calls(receiver_id, status);

-- 10. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(100) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- 11. SUPABASE REALTIME REPLICATION (Add tables to realtime publication)
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;
-- ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;
-- ALTER PUBLICATION supabase_realtime ADD TABLE calls;
-- ALTER PUBLICATION supabase_realtime ADD TABLE users;
