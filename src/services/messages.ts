import { db } from '../db';
import { env } from '../config/env';

export interface MessageConfig {
  key: string;
  content: string;
  parse_mode: string;
  media_url: string | null;
  media_type: string | null;
}

export async function getMessage(key: string): Promise<MessageConfig> {
  const r = await db.query<MessageConfig>(
    `SELECT key, content, parse_mode, media_url, media_type
     FROM messages_config WHERE key = $1 AND is_active = TRUE`,
    [key],
  );
  if (!r.rows[0]) throw new Error(`messages_config: chave "${key}" não encontrada ou inativa`);
  return r.rows[0];
}

export async function renderMessage(
  key: string,
  vars: Record<string, string | number | null | undefined>,
): Promise<{ text: string; parse_mode: string; media_url: string | null; media_type: string | null }> {
  const cfg = await getMessage(key);

  const allVars: Record<string, any> = {
    CHANNEL_LINK: env.CHANNEL_LINK,
    BOT_USERNAME: env.BOT_USERNAME,
    URL_BANNER_LARI_CONTAS: env.URL_BANNER_LARI_CONTAS,
    ...vars,
  };

  const replace = (input: string) =>
    input.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_, name) => {
      const v = allVars[name];
      return v === undefined || v === null ? '' : String(v);
    });

  return {
    text: replace(cfg.content),
    parse_mode: cfg.parse_mode || 'HTML',
    media_url: cfg.media_url ? replace(cfg.media_url) : null,
    media_type: cfg.media_type,
  };
}
