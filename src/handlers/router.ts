import { Telegraf } from 'telegraf';
import { catalogHandler } from './catalog';
import { productDetailHandler } from './productDetail';
import {
  buyProductHandler,
  genPixBuyHandler,
  checkPixHandler,
  cancelPixHandler,
  cancelFlowHandler,
  toggleCredentialsHandler,
} from './purchase';
import { startHandler } from './start';

export function registerCallbackRouter(bot: Telegraf): void {
  bot.on('callback_query', async (ctx) => {
    const data = (ctx.callbackQuery as any)?.data as string | undefined;
    if (!data) return ctx.answerCbQuery().catch(() => {});

    if (data === 'noop') return ctx.answerCbQuery().catch(() => {});
    if (data === 'go_home') {
      await ctx.answerCbQuery().catch(() => {});
      return startHandler(ctx);
    }
    if (data === 'go_catalog') {
      await ctx.answerCbQuery().catch(() => {});
      return catalogHandler(ctx, 0);
    }

    const pageMatch = data.match(/^catalog_page_(\d+)$/);
    if (pageMatch) {
      await ctx.answerCbQuery().catch(() => {});
      return catalogHandler(ctx, Number(pageMatch[1]));
    }

    const prodMatch = data.match(/^product_(\d+)$/);
    if (prodMatch) {
      await ctx.answerCbQuery().catch(() => {});
      return productDetailHandler(ctx, Number(prodMatch[1]));
    }

    const buyMatch = data.match(/^buy_product_(\d+)$/);
    if (buyMatch) return buyProductHandler(ctx, Number(buyMatch[1]));

    const genPixMatch = data.match(/^gen_pix_buy_(\d+)$/);
    if (genPixMatch) return genPixBuyHandler(ctx, Number(genPixMatch[1]));

    const checkMatch = data.match(/^check_pix_(.+)$/);
    if (checkMatch) return checkPixHandler(ctx, checkMatch[1]);

    const cancelPixMatch = data.match(/^cancel_pix_(.+)$/);
    if (cancelPixMatch) return cancelPixHandler(ctx, cancelPixMatch[1]);

    if (data === 'cancel_flow') return cancelFlowHandler(ctx);

    const toggleMatch = data.match(/^toggle_cred_(\d+)_(\d)$/);
    if (toggleMatch) {
      return toggleCredentialsHandler(ctx, Number(toggleMatch[1]), toggleMatch[2] === '1');
    }

    // Stubs para módulos futuros (botões precisam existir)
    if (data.startsWith('buy_multi_') || data.startsWith('add_cart_')) {
      return ctx.answerCbQuery('Em breve 🚧').catch(() => {});
    }
    if (['go_profile', 'go_topup', 'go_affiliate', 'go_ranking',
         'go_support', 'go_store', 'go_cart'].includes(data)) {
      return ctx.answerCbQuery('Em breve 🚧').catch(() => {});
    }

    return ctx.answerCbQuery().catch(() => {});
  });
}
