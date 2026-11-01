import { Context } from 'telegraf';
import { db } from '../db';
import { cancelPix } from '../services/pix';
import { startHandler } from './start';

export async function cancelHandler(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  // Cancela PIX de compra pendente (nunca pagamentos confirmados)
  const pending = await db.query(
    `SELECT reference FROM pix_payments
     WHERE user_id = $1 AND status = 'pending' ORDER BY id DESC LIMIT 1`,
    [ctx.from.id],
  );
  if (pending.rows[0]) await cancelPix(pending.rows[0].reference);

  await db.query(
    `UPDATE user_sessions
     SET current_flow = NULL, flow_data = '{}'::jsonb, updated_at = NOW()
     WHERE user_id = $1`,
    [ctx.from.id],
  );

  try { await ctx.deleteMessage(); } catch {}
  await startHandler(ctx);
}
