import { Telegraf } from 'telegraf';
import { env } from '../config/env';

const ALLOWED = new Set(['creator', 'administrator', 'member']);

export async function isChannelMember(bot: Telegraf, userId: number): Promise<boolean> {
  try {
    const m = await bot.telegram.getChatMember(env.CHANNEL_ID, userId);
    return ALLOWED.has(m.status);
  } catch {
    return false;
  }
}
