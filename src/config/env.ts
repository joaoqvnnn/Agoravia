import 'dotenv/config';

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Variável de ambiente ausente: ${key}`);
  return v;
}

export const env = {
  BOT_TOKEN: required('BOT_TOKEN'),
  DATABASE_URL: required('DATABASE_URL'),
  CHANNEL_ID: required('CHANNEL_ID'),
  CHANNEL_LINK: required('CHANNEL_LINK'),
  BOT_USERNAME: required('BOT_USERNAME'),
  ADMIN_IDS: (process.env.ADMIN_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number),
  PORT: Number(process.env.PORT ?? 3000),
  URL_BANNER_LARI_CONTAS: process.env.URL_BANNER_LARI_CONTAS ?? '',
  MERCADO_PAGO_ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN ?? '',
  WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL ?? '',
};
