import { Context } from 'telegraf';
import { renderMessage } from '../services/messages';
import {
  countAvailableStock,
  countSales,
  getProduct,
} from '../services/products';
import { getBalance, fmtBRL } from '../services/wallet';
import { sendOrEdit } from '../utils/render';

export async function productDetailHandler(
  ctx: Context,
  productId: number,
): Promise<void> {
  if (!ctx.from) return;
  const p = await getProduct(productId);
  if (!p || !p.is_active) {
    await ctx.answerCbQuery?.('Produto indisponível').catch(() => {});
    return;
  }

  const [saldo, estoque, vendidos] = await Promise.all([
    getBalance(ctx.from.id),
    countAvailableStock(productId),
    countSales(productId),
  ]);

  const msg = await renderMessage('product_detail', {
    PRODUTO_NOME: p.name,
    PRODUTO_PRECO: fmtBRL(p.price),
    PRODUTO_DESCRICAO: p.description ?? '—',
    SALDO: fmtBRL(saldo),
    ESTOQUE: estoque,
    VENDIDOS: vendidos,
    GARANTIA_DIAS: p.warranty_days,
  });

  const rows: any[] = [];
  if (estoque > 0) {
    rows.push([{ text: '✅ Comprar', callback_data: `buy_product_${p.id}` }]);
    rows.push([{ text: '🛒 Comprar mais de um', callback_data: `buy_multi_${p.id}` }]);
    rows.push([{ text: '➕ Adicionar no carrinho', callback_data: `add_cart_${p.id}` }]);
  } else {
    rows.push([{ text: '❌ Sem estoque no momento', callback_data: 'noop' }]);
  }
  rows.push([{ text: '⬅️ Voltar ao catálogo', callback_data: 'catalog_page_0' }]);

  await sendOrEdit(ctx.telegram, ctx, { ...msg, reply_markup: { inline_keyboard: rows } });
}
