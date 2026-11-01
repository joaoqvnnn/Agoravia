import { db } from '../db';

export async function getBalance(userId: number): Promise<number> {
  const r = await db.query<{ balance: string }>(
    `SELECT balance FROM wallets WHERE user_id = $1`,
    [userId],
  );
  return Number(r.rows[0]?.balance ?? 0);
}

export function fmtBRL(n: number): string {
  return n.toFixed(2).replace('.', ',');
}
