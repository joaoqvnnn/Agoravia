-- =========================================================
-- CATEGORIAS / PRODUTOS / ESTOQUE
-- =========================================================

CREATE TABLE IF NOT EXISTS categories (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id             BIGSERIAL PRIMARY KEY,
  category_id    BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  price          NUMERIC(10,2) NOT NULL CHECK (price > 0),
  warranty_days  INTEGER DEFAULT 30,
  site_url       TEXT,
  usage_note     TEXT,
  is_active      BOOLEAN DEFAULT TRUE,
  sort_order     INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active, sort_order);

CREATE TABLE IF NOT EXISTS product_stock (
  id             BIGSERIAL PRIMARY KEY,
  product_id     BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  password       TEXT NOT NULL,
  extra_data     JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_sold        BOOLEAN DEFAULT FALSE,
  reserved_by    BIGINT REFERENCES users(telegram_id),
  reserved_until TIMESTAMPTZ,
  sold_at        TIMESTAMPTZ,
  purchase_id    BIGINT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_avail
  ON product_stock(product_id, is_sold, reserved_until);

-- =========================================================
-- MENSAGENS — CATÁLOGO
-- =========================================================

INSERT INTO messages_config (key, title, content, media_url, media_type) VALUES
(
  'catalog',
  'Catálogo',
  '📱 CATÁLOGO DE SERVIÇOS
━━━━━━━━━━━━━━━━━━━

💰 Saldo: R$ {{SALDO}}
📦 Produtos disponíveis: {{TOTAL_PRODUTOS}}

⬇️ Selecione uma categoria para ver nossos planos:',
  NULL, NULL
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO messages_config (key, title, content, media_url, media_type) VALUES
(
  'catalog_empty',
  'Catálogo vazio',
  '📱 CATÁLOGO DE SERVIÇOS
━━━━━━━━━━━━━━━━━━━

💰 Saldo: R$ {{SALDO}}
📦 Nenhum produto disponível no momento.

⏳ Volte em instantes!',
  NULL, NULL
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO messages_config (key, title, content, media_url, media_type) VALUES
(
  'product_detail',
  'Detalhe do produto',
  '🚀 {{PRODUTO_NOME}}

💰 Valor: R$ {{PRODUTO_PRECO}}
👛 Seu saldo: R$ {{SALDO}}
📦 Estoque: {{ESTOQUE}} unidades

📝 Descrição:
{{PRODUTO_DESCRICAO}}

📊 Informações:
└ {{VENDIDOS}} vendas

🛡️ Garantia: {{GARANTIA_DIAS}} dias
✅ Compra segura - /termos',
  NULL, NULL
)
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- SETTINGS DO CATÁLOGO
-- =========================================================

INSERT INTO settings (key, value, type, description) VALUES
  ('catalog_page_size', '6', 'integer', 'Quantidade de produtos por página'),
  ('pix_expiry_minutes', '30', 'integer', 'Minutos de validade do PIX'),
  ('stock_reservation_minutes', '30', 'integer', 'Minutos de reserva de estoque'),
  ('credentials_visible_by_default', 'false', 'boolean', 'Se true, credenciais aparecem visíveis na compra')
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- BOTÕES — CATÁLOGO E DETALHE (gerados dinamicamente no handler,
-- aqui só os de navegação fixos)
-- =========================================================
