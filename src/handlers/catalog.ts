import { Context } from 'telegraf';
import { renderMessage } from '../services/messages';
import {
  countActiveProducts,
  getPageSize,
  listActiveProducts,
} from '../services/products';
import { getBalance, fmtBRL } from '../services/wallet';
import { sendOrEdit } from '../utils/render';

export async function catalogHandler(
  ctx: Context,
  page = 0,
): Promise<void> {
  if (!ctx.from) return;
  const saldo = await getBalance(ctx.from.id);
  const pageSize = await getPageSize();
  const total = await countActiveProducts();

  if (total === 0) {
    const msg = await renderMessage('catalog_empty', { SALDO: fmtBRL(saldo) });
    await sendOrEdit(ctx.telegram, ctx, {
      ...msg,
      reply_markup: { inline_keyboard: [[{ text: '⬅️ Voltar', callback_data: 'go_home' }]] },
    });
    return;
  }

  const products = await listActiveProducts(pageSize, page * pageSize);

  const msg = await renderMessage('catalog', {
    SALDO: fmtBRL(saldo),
    TOTAL_PRODUTOS: total,
  });

  const rows: any[] = [];
  for (const p of products) {
    rows.push([
      {
        text: `${p.name} — R$ ${fmtBRL(p.price)}`,
        callback_data: `product_${p.id}`,
      },
    ]);
  }

  // Paginação
  const totalPages = Math.ceil(total / pageSize);
  const nav: any[] = [];
  if (page > 0) nav.push({ text: '« Anterior', callback_data: `catalog_page_${page - 1}` });
  nav.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: 'noop' });
  if (page + 1 < totalPages) nav.push({ text: 'Próxima »', callback_data: `catalog_page_${page + 1}` });
  if (nav.length > 1 || totalPages > 1) rows.push(nav);

  rows.push([{ text: '⬅️ Voltar', callback_data: 'go_home' }]);

  await sendOrEdit(ctx.telegram, ctx, { ...msg, reply_markup: { inline_keyboard: rows } });
}
