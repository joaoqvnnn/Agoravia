import { Context, Telegraf } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

export function generateReferralCode(telegramId: number): string {
  const base = telegramId.toString(36).toUpperCase();
  return `LAR${base}`;
}

/**
 * Prioriza EDITAR a mensagem atual (evita duplicação).
 * Se não houver mensagem para editar, envia nova.
 * Se for mídia (banner), usa editMessageMedia / replyWithPhoto.
 */
export async function sendOrEdit(
  bot: Telegraf,
  ctx: Context,
  payload: {
    text: string;
    parse_mode: string;
    media_url?: string | null;
    media_type?: string | null;
    reply_markup?: InlineKeyboardMarkup;
  },
): Promise<void> {
  const isCallback = !!ctx.callbackQuery;
  const messageId = isCallback
    ? (ctx.callbackQuery!.message as any)?.message_id
    : undefined;
  const chatId = ctx.chat!.id;

  const opts: any = {
    parse_mode: payload.parse_mode,
    reply_markup: payload.reply_markup,
  };

  try {
    if (payload.media_url && payload.media_type === 'image') {
      if (isCallback && messageId) {
        await bot.telegram.editMessageMedia(
          chatId,
          messageId,
          undefined,
          { type: 'photo', media: payload.media_url, caption: payload.text, parse_mode: payload.parse_mode as any },
          { reply_markup: payload.reply_markup },
        );
        return;
      }
      await bot.telegram.sendPhoto(chatId, payload.media_url, {
        caption: payload.text,
        parse_mode: payload.parse_mode as any,
        reply_markup: payload.reply_markup,
      });
      return;
    }

    if (isCallback && messageId) {
      await bot.telegram.editMessageText(chatId, messageId, undefined, payload.text, opts);
    } else {
      await bot.telegram.sendMessage(chatId, payload.text, opts);
    }
  } catch (e: any) {
    if (String(e?.description ?? '').includes('message is not modified')) return;
    throw e;
  }
}
