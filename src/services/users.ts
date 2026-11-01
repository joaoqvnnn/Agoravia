import { db } from '../db';
import { generateReferralCode } from '../utils/render';

interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export async function ensureUser(tg: TgUser) {
  await db.query(
    `INSERT INTO users (telegram_id, username, first_name, last_name, referral_code)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (telegram_id) DO UPDATE
       SET username   = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name  = EXCLUDED.last_name,
           updated_at = NOW()`,
    [tg.id, tg.username ?? null, tg.first_name ?? null, tg.last_name ?? null, generateReferralCode(tg.id)],
  );

  await db.query(
    `INSERT INTO wallets (user_id, balance) VALUES ($1, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [tg.id],
  );
}

export async function getUser(telegramId: number) {
  const r = await db.query(
    `SELECT u.*, w.balance
     FROM users u LEFT JOIN wallets w ON w.user_id = u.telegram_id
     WHERE u.telegram_id = $1`,
    [telegramId],
  );
  return r.rows[0] ?? null;
}

export async function setJoinedChannel(telegramId: number, joined: boolean) {
  await db.query(
    `UPDATE users SET joined_channel = $2, updated_at = NOW() WHERE telegram_id = $1`,
    [telegramId, joined],
  );
}

export async function totalClients(): Promise<number> {
  const r = await db.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM users`);
  return Number(r.rows[0]?.c ?? 0);
}
