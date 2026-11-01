import { Telegraf } from 'telegraf';

export function registerCallbackRouter(bot: Telegraf): void {
  bot.on('callback_query', async (ctx) => {
    const data = (ctx.callbackQuery as any)?.data as string | undefined;
    if (!data) return ctx.answerCbQuery().catch(() => {});

    // ---- Ações implementadas no Módulo 1 ----
    if (data === 'noop') {
      return ctx.answerCbQuery().catch(() => {});
    }

    // ---- Ações dos próximos módulos (a serem preenchidas) ----
    switch (data) {
      case 'go_catalog':
      case 'go_profile':
      case 'go_topup':
      case 'go_affiliate':
      case 'go_ranking':
      case 'go_support':
      case 'go_store':
      case 'go_cart':
        // Serão tratados nos módulos correspondentes.
        return ctx.answerCbQuery().catch(() => {});
      default:
        // callback desconhecido — apenas encerra o spinner
        return ctx.answerCbQuery().catch(() => {});
    }
  });
}
