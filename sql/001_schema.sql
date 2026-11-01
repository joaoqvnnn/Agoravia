-- =========================================================
-- USERS / WALLET / TRANSAÇÕES
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
  telegram_id        BIGINT PRIMARY KEY,
  username           TEXT,
  first_name         TEXT,
  last_name          TEXT,
  whatsapp           TEXT,
  email              TEXT,
  email_verified     BOOLEAN DEFAULT FALSE,
  referrer_id        BIGINT REFERENCES users(telegram_id),
  referral_code      TEXT UNIQUE,
  affiliate_active   BOOLEAN DEFAULT FALSE,
  points             INTEGER DEFAULT 0,
  is_blocked         BOOLEAN DEFAULT FALSE,
  joined_channel     BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id    BIGINT PRIMARY KEY REFERENCES users(telegram_id),
  balance    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  type            TEXT NOT NULL CHECK (type IN ('credit','debit')),
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance_before  NUMERIC(12,2) NOT NULL,
  balance_after   NUMERIC(12,2) NOT NULL,
  reference_type  TEXT,
  reference_id    TEXT,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wtx_user ON wallet_transactions(user_id, created_at DESC);

-- =========================================================
-- SISTEMA EDITÁVEL (mensagens + botões + configurações)
-- =========================================================

CREATE TABLE IF NOT EXISTS messages_config (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT UNIQUE NOT NULL,
  title       TEXT,
  content     TEXT NOT NULL,
  parse_mode  TEXT DEFAULT 'HTML',
  media_url   TEXT,
  media_type  TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buttons_config (
  id                 BIGSERIAL PRIMARY KEY,
  menu_key           TEXT NOT NULL,
  label              TEXT NOT NULL,
  emoji              TEXT,
  callback_data      TEXT,
  url                TEXT,
  row_position       INTEGER NOT NULL DEFAULT 0,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  color              TEXT,
  is_active          BOOLEAN DEFAULT TRUE,
  visible            BOOLEAN DEFAULT TRUE,
  edit_mode          TEXT DEFAULT 'edit',
  post_click_action  TEXT DEFAULT 'remain',
  post_click_label   TEXT,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_buttons_menu ON buttons_config(menu_key, is_active, visible);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  type        TEXT DEFAULT 'string',
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- SESSÃO PERSISTENTE
-- =========================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  user_id         BIGINT PRIMARY KEY REFERENCES users(telegram_id),
  current_flow    TEXT,
  flow_data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_chat_id    BIGINT,
  last_message_id BIGINT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- CANAIS OBRIGATÓRIOS
-- =========================================================

CREATE TABLE IF NOT EXISTS required_channels (
  id           BIGSERIAL PRIMARY KEY,
  chat_id      BIGINT UNIQUE NOT NULL,
  title        TEXT,
  invite_link  TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- PLACEHOLDER PARA MÓDULOS FUTUROS
-- (produtos, estoque, compras, pix, gifts, affiliates,
--  points, cart, notifications, ranks...)
-- Serão criadas nos módulos correspondentes.
-- =========================================================
