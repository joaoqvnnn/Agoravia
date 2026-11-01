import { Telegraf } from 'telegraf';
import { env } from '../config/env';
import { setJoinedChannel, totalClients, getUser } from '../services/users';
import { renderMessage } from '../services/messages';
import { getKeyboard } from '../services/buttons';
import { getBalance, fmtBRL } from '../services/wallet';

const ALLOWED = new Set(['creator', 'administrator', 'member']);

export function registerChannelJoin(bot: Telegraf): void {
  bot.on('chat_member', async (ctx) => {
    const upd = ctx.update.chat_member;
    if (!upd) return;
    if (String(upd.chat.id) !== String(env.CHANNEL_ID)) return;
    if (!ALLOWED.has(upd.new_chat_member.status)) return;

    const userId = upd.new_chat_member.user.id;
    const user = await getUser(userId);
    if (!user) return;

    await setJoinedChannel(userId, true);

    const [saldo, clientes] = await Promise.all([getBalance(userId), totalClients()]);

    const msg = await renderMessage('welcome', {
      USER_ID: userId,
      SALDO: fmtBRL(saldo),
      TOTAL_CLIENTES: clientes.toLocaleString('pt-BR'),
    });
    const kb = await getKeyboard('welcome');

    // Envia welcome (não temos acesso à mensagem antiga via update de chat_member;
    // quando o usuário clicar em /start ou em qualquer botão, a tela atualiza via editMessageText)
    try {
      await bot.telegram.sendMessage(userId, msg.text, {
        parse_mode: msg.parse_mode as any,
        reply_markup: kb,
      });
    } catch { /* ignora se o usuário bloqueou o bot */ }
  });

  // Também atualiza status quando o usuário sai do canal
  bot.on('chat_member', async (ctx) => {
    const upd = ctx.update.chat_member;
    if (!upd) return;
    if (String(upd.chat.id) !== String(env.CHANNEL_ID)) return;
    if (upd.new_chat_member.status === 'left' || upd.new_chat_member.status === 'kicked') {
      await setJoinedChannel(upd.new_chat_member.user.id, false);
    }
  });
}
