-- =========================================================
-- PEDIDOS MULTI (agrupam várias compras)
-- =========================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id             BIGSERIAL PRIMARY KEY,
  short_id       TEXT UNIQUE NOT NULL,
  user_id        BIGINT NOT NULL REFERENCES users(telegram_id),
  product_id     BIGINT NOT NULL REFERENCES products(id),
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  unit_price     NUMERIC(10,2) NOT NULL,
  price_total    NUMERIC(10,2) NOT NULL,
  paid_balance   NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_pix       NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_after  NUMERIC(10,2) NOT NULL,
  payment_source TEXT NOT NULL CHECK (payment_source IN ('balance','pix_balance')),
  status         TEXT NOT NULL DEFAULT 'delivered'
                 CHECK (status IN ('pending','delivered','refunded')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON purchase_orders(user_id, created_at DESC);

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES purchase_orders(id);
CREATE INDEX IF NOT EXISTS idx_purchases_order ON purchases(order_id);

-- Extensões no pix_payments
ALTER TABLE pix_payments ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE pix_payments ADD COLUMN IF NOT EXISTS stock_ids BIGINT[] DEFAULT NULL;

ALTER TABLE pix_payments DROP CONSTRAINT IF EXISTS pix_payments_purpose_check;
ALTER TABLE pix_payments ADD CONSTRAINT pix_payments_purpose_check
  CHECK (purpose IN ('topup','purchase_diff','purchase_diff_multi','cart_diff'));

-- =========================================================
-- MENSAGENS
-- =========================================================

INSERT INTO messages_config (key, title, content) VALUES
(
  'multi_quantity_prompt',
  'Multi — solicitar quantidade',
  '🛒 Quantos acessos você quer?

📦 Disponível agora: {{ESTOQUE}} unidades
💎 Produto: {{PRODUTO}}

👇 Digite a quantidade (ex: 1)

✖️ /cancelar para sair'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO messages_config (key, title, content) VALUES
(
  'multi_low_stock',
  'Multi — estoque baixo',
  '⚠️ Opa, estoque baixo!

📦 Temos: {{ESTOQUE}} unidades
🛒 Você tentou: {{SOLICITADO}}

👇 Temos só {{ESTOQUE}}, deseja levar?

Digite {{ESTOQUE}} ou /cancelar.'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO messages_config (key, title, content) VALUES
(
  'insufficient_balance_multi',
  'Saldo insuficiente — multi',
  '💳 SALDO INSUFICIENTE, MAS JÁ RESOLVEMOS!

📦 Quantidade: {{QTD}} unidades
💰 Você tem: R$ {{SALDO}}
💵 Precisa: R$ {{VALOR_TOTAL}}
⚡ Faltam só: R$ {{FALTA}}

👇 Gere o PIX da diferença e libere sua compra!'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO messages_config (key, title, content) VALUES
(
  'multi_approved_header',
  'Multi — cabeçalho do pedido',
  '✅ COMPRA APROVADA!

🛍 Pedido: #{{SHORT_ID}}
💎 Serviço: {{PRODUTO}}
📦 Quantidade: {{QTD}} unidades

💰 Valor unitário: R$ {{VALOR_UNITARIO}}
💵 Total pago: R$ {{VALOR_TOTAL}}
💳 Saldo anterior: R$ {{SALDO_ANTERIOR}}
💰 Saldo restante: R$ {{SALDO_ATUAL}}

📅 Compra: {{DATA_COMPRA}}

👇 Suas contas estão liberadas!'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO messages_config (key, title, content) VALUES
(
  'multi_unit_view',
  'Multi — unidade individual',
  '✅ COMPRA LIBERADA! [{{INDEX}}/{{TOTAL}}]

🛍 Pedido: #{{SHORT_ID}}
💎 Serviço: {{PRODUTO}}
⏰ Compra: {{DATA_COMPRA}}
📆 Válido até: {{VENCIMENTO}}
💰 Valor: R$ {{VALOR}}
🎫 ID: {{ID}}

📧 Email: {{EMAIL}}
🔐 Senha: {{SENHA}}

Ref: {{REF}}'
) ON CONFLICT (key) DO NOTHING;
