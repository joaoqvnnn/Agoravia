-- ===================== MENSAGENS =====================

INSERT INTO messages_config (key, title, content, media_url, media_type) VALUES
(
  'start_blocked',
  'Bloqueio — entrada no canal',
  '🔓 Seu acesso está quase pronto!

Entre no nosso grupo para ativar o serviço e receber todas as atualizações.',
  NULL,
  NULL
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO messages_config (key, title, content, media_url, media_type) VALUES
(
  'welcome',
  'Boas-vindas',
  '🎬 Bem-vindo à Larizinha Store! ✨
A sua central de streamings com entrega 100% automática.

Pagou, recebeu. Sem filas, sem precisar falar com atendente, 24 horas por dia! ⚡️

🔐 Segurança e Suporte:
Mais de {{TOTAL_CLIENTES}} clientes já passaram por aqui.
Participe da nossa comunidade e veja as referências.

💠 Seus Dados:
├ 👤 ID: {{USER_ID}}
└ 💰 Saldo Atual: R$ {{SALDO}}

👉 COMO COMEÇAR:
Clique no botão "🛍️ Comprar Produtos" abaixo para ver nosso catálogo e escolher sua tela!',
  '{{URL_BANNER_LARI_CONTAS}}',
  'image'
)
ON CONFLICT (key) DO NOTHING;

-- ===================== BOTÕES (bloqueio) =====================

INSERT INTO buttons_config (menu_key, label, emoji, url, row_position, sort_order)
VALUES ('start_blocked', 'Entrar no canal', '📢', '{{CHANNEL_LINK}}', 0, 0)
ON CONFLICT DO NOTHING;

-- ===================== BOTÕES (boas-vindas) =====================

INSERT INTO buttons_config (menu_key, label, emoji, callback_data, row_position, sort_order) VALUES
  ('welcome', 'Comprar produto',    '🛍️', 'go_catalog',       0, 0),
  ('welcome', 'Meu perfil',         '👤', 'go_profile',       0, 1),
  ('welcome', 'Recarregar saldo',   '💳', 'go_topup',         1, 0),
  ('welcome', 'Renda extra',        '💰', 'go_affiliate',     1, 1),
  ('welcome', 'Top compradores',    '🏆', 'go_ranking',       2, 0),
  ('welcome', 'Atendimento',        '💬', 'go_support',       2, 1),
  ('welcome', 'Abrir loja',         '🌐', 'go_store',         3, 0),
  ('welcome', 'Carrinho',           '🛒', 'go_cart',          3, 1)
ON CONFLICT DO NOTHING;

-- ===================== SETTINGS =====================

INSERT INTO settings (key, value, type, description) VALUES
  ('banner_url', '{{URL_BANNER_LARI_CONTAS}}', 'string', 'Banner da tela de boas-vindas'),
  ('support_link', 'https://t.me/atendimento', 'string', 'Link do atendimento'),
  ('store_link',   'https://larizinhastore.com', 'string', 'Link da loja externa')
ON CONFLICT (key) DO NOTHING;
