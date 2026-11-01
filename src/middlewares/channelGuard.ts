import { MiddlewareFn } from 'telegraf';
import { isChannelMember } from '../services/channels';
import { renderMessage } from '../services/messages';
import { getKeyboard } from '../services/buttons';
import { sendOrEdit } from '../utils/render';

export const channelGuard: MiddlewareFn = async (ctx, next) => {
  if (!ctx.from || ctx.from.is_bot) return next();

  // /start é tratado no handler específico (mostra bloqueio/welcome)
  const txt = (ctx.message as any)?.text as string | undefined;
  if (txt?.startsWith('/start')) return next();

  const isMember = await isChannelMember(ctx.telegram, ctx.from.id);
  if (!isMember) {
    const msg = await renderMessage('start_blocked', {});
    const kb = await getKeyboard('start_blocked');
    await sendOrEdit(ctx.telegram, ctx, { ...msg, reply_markup: kb });
    return;
  }
  return next();
};
