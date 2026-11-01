import { Context } from 'telegraf';
import { db } from '../db';
import { startHandler } from './start';

/**
 * /cancelar — limpa o estado temporário e volta ao menu principal.
 * Nunca cancela compras/pagamentos já confirmados.
 */
export async function cancelHandler(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  await db.query(
    `UPDATE user_sessions
     SET current_flow = NULL, flow_data = '{}'::jsonb, updated_at = NOW()
     WHERE user_id = $1`,
    [ctx.from.id],
  );

  // Deleta o comando /cancelar enviado pelo usuário, quando possível
  try { await ctx.deleteMessage(); } catch { /* ignora */ }

  // Reexibe welcome editando a última mensagem, se houver
  await startHandler(ctx);
}
