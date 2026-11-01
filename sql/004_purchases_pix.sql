-- =========================================================
-- COMPRAS E PAGAMENTOS PIX
-- =========================================================

CREATE TABLE IF NOT EXISTS purchases (
  id               BIGSERIAL PRIMARY KEY,
  short_id         TEXT UNIQUE NOT NULL,
  user_id          BIGINT NOT NULL REFERENCES users(telegram_id),
  product_id       BIGINT NOT NULL REFERENCES products(id),
  stock_id         BIGINT NOT NULL REFERENCES product_stock(id),
  price_total      NUMERIC(10,2) NOT NULL,
  paid_balance     NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_pix         NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_after    NUMERIC(10,2) NOT NULL,
  payment_source   TEXT NOT NULL CHECK (payment_source IN ('balance','pix_balance')),
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pix_payments (
  id                BIGSERIAL PRIMARY KEY,
  reference         TEXT UNIQUE NOT NULL,
  user_id           BIGINT NOT NULL REFERENCES users(telegram_id),
  purpose           TEXT NOT NULL CHECK (purpose IN ('topup','purchase_diff','cart_diff')),
  product_id        BIGINT REFERENCES products(id),
  stock_id          BIGINT REFERENCES product_stock(id),
  amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  balance_reserved  NUMERIC(10,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','expired','cancelled','refunded')),
  mp_payment_id     TEXT,
  qr_code           TEXT,
  qr_code_base64    TEXT,
  ticket_url        TEXT,
  expires_at        TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pix_user ON pix_payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pix_mp   ON pix_payments(mp_payment_id);

-- =========================================================
-- MENSAGENS — COMPRA / PIX
-- =========================================================

INSERT INTO messages_config (key, title, content, media_url, media_type) VALUES
(
  'insufficient_balance',
  'Saldo insuficiente',
  '⚠️ SALDO INSUFICIENTE

💳 Você tem: R$ {{SALDO}}
🛒 Produto: R$ {{VALOR}}
💸 Falta apenas: R$ {{FALTA}}

Deseja gerar um PIX de R$ {{FALTA}} para liberar na hora?',
  NULL, NULL
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO messages_config (key, title, content, media_url, media_type) VALUES
(
  'pix_created',
  'PIX criado',
  '💳 PIX CRIADO COM SUCESSO!

⌛ Validade: {{MINUTOS}} minutos
💲 Para pagar: R$ {{VALOR}}
🔑 Código: {{ID}}

⚠️ IMPORTANTE: Esse PIX só pode ser pago 1x. Se pagar 2 vezes, o segundo não entra.

🔗 PIX COPIA E COLA:
{{CODIGO_PIX}}

👆 Toque no botão abaixo para copiar.

💼 SEU EXTRATO:
• Saldo utilizado na compra: R$ {{SALDO_RESERVADO}}
• PIX necessário: R$ {{VALOR_PIX}}
• Total disponível para a compra: R$ {{TOTAL_DISPONIVEL}}

✅ Pagou? Sua compra será liberada automaticamente!',
  NULL, NULL
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO messages_config (key, title, content, media_url, media_type) VALUES
(
  'pix_pending',
  'PIX ainda pendente',
  '⏳ Ainda não identificamos o pagamento.

💲 Valor: R$ {{VALOR}}
🔑 Código: {{ID}}
⌛ Expira em: {{MINUTOS}} minutos

Se você já pagou, aguarde alguns instantes e clique em "Aguardando pagamento" novamente.',
  NULL, NULL
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO messages_config (key, title, content, media_url, media_type) VALUES
(
  'pix_expired',
  'PIX expirado',
  '⌛️ PAGAMENTO PIX EXPIRADO

⚠️ O tempo limite para realizar este pagamento foi excedido.

🆔 Referência do Pagamento: {{ID}}
💸 Valor Solicitado: R$ {{VALOR}}

❌ Este PIX não é mais válido e não será compensado se pagar.

👉 Gere um novo PIX abaixo para concluir sua operação:',
  NULL, NULL
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO messages_config (key, title, content, media_url, media_type) VALUES
(
  'purchase_approved',
  'Compra aprovada',
  '✅ COMPRA APROVADA!

🛍 Seu pedido: #{{SHORT_ID}}
🎫 ID: {{ID}}

📦 Produto: {{PRODUTO}}
💵 Valor total: R$ {{VALOR}}
💳 Saldo utilizado: R$ {{PAGO_SALDO}}
⚡ PIX pago: R$ {{PAGO_PIX}}
💰 Saldo restante: R$ {{SALDO_ATUAL}}
📅 Compra: {{DATA_COMPRA}}
⏳ Válido até: {{VENCIMENTO}}

📧 Email: {{EMAIL}}
🔐 Senha: {{SENHA}}

📝 Como usar:
{{NOTA}}

👇 CLIQUE NO BOTÃO ABAIXO PARA ATIVAR',
  NULL, NULL
)
ON CONFLICT (key) DO NOTHING;
