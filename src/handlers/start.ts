import { Context } from 'telegraf';
import { isChannelMember } from '../services/channels';
import { renderMessage } from '../services/messages';
import { getKeyboard } from '../services/buttons';
import { getBalance, fmtBRL } from '../services/wallet';
import { setJoinedChannel, totalClients } from '../services/users';
import { sendOrEdit } from '../utils/render';

export async function startHandler(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const isMember = await isChannelMember(ctx.telegram, ctx.from.id);
  await setJoinedChannel(ctx.from.id, isMember);

  if (!isMember) {
    const msg = await renderMessage('start_blocked', {});
    const kb = await getKeyboard('start_blocked');
    await sendOrEdit(ctx.telegram, ctx, { ...msg, reply_markup: kb });
    return;
  }

  const [saldo, clientes] = await Promise.all([
    getBalance(ctx.from.id),
    totalClients(),
  ]);

  const msg = await renderMessage('welcome', {
    USER_ID: ctx.from.id,
    SALDO: fmtBRL(saldo),
    TOTAL_CLIENTES: clientes.toLocaleString('pt-BR'),
  });
  const kb = await getKeyboard('welcome');
  await sendOrEdit(ctx.telegram, ctx, { ...msg, reply_markup: kb });
}
