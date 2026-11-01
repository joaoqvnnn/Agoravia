import { Telegraf } from 'telegraf';
import { expireStale } from '../services/pix';
import { renderMessage } from '../services/messages';
import { fmtBRL } from '../services/wallet';

export function startExpiryCron(bot: Telegraf): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const expired = await expireStale();
      for (const p of expired) {
        const msg = await renderMessage('pix_expired', {
          ID: p.reference,
          VALOR: fmtBRL(p.amount),
        });
        await bot.telegram
          .sendMessage(p.user_id, msg.text, {
            parse_mode: msg.parse_mode as any,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Gerar novo PIX', callback_data: 'catalog_page_0' }],
                [{ text: '🏠 Menu inicial', callback_data: 'go_home' }],
              ],
            },
          })
          .catch(() => {});
      }
    } catch (e) {
      console.error('[cron] erro:', e);
    }
  }, 60_000);
}
