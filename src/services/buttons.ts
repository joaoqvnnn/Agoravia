import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { db } from '../db';
import { env } from '../config/env';

interface ButtonRow {
  menu_key: string;
  label: string;
  emoji: string | null;
  callback_data: string | null;
  url: string | null;
  row_position: number;
  sort_order: number;
}

export async function getKeyboard(
  menuKey: string,
  vars: Record<string, string | undefined> = {},
): Promise<InlineKeyboardMarkup> {
  const r = await db.query<ButtonRow>(
    `SELECT menu_key, label, emoji, callback_data, url, row_position, sort_order
     FROM buttons_config
     WHERE menu_key = $1 AND is_active = TRUE AND visible = TRUE
     ORDER BY row_position ASC, sort_order ASC`,
    [menuKey],
  );

  const allVars: Record<string, any> = {
    CHANNEL_LINK: env.CHANNEL_LINK,
    ...vars,
  };
  const rep = (s: string) =>
    s.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_, k) => String(allVars[k] ?? ''));

  const rows = new Map<number, any[]>();
  for (const b of r.rows) {
    const text = `${b.emoji ? b.emoji + ' ' : ''}${rep(b.label)}`.trim();
    const btn = b.url
      ? { text, url: rep(b.url) }
      : { text, callback_data: b.callback_data ?? 'noop' };

    const list = rows.get(b.row_position) ?? [];
    list.push(btn);
    rows.set(b.row_position, list);
  }

  const inline_keyboard = [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, btns]) => btns);

  return { inline_keyboard };
}
