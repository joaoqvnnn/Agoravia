import { Telegram } from 'telegraf';
import { renderMessage } from './messages';
import { getOrder, getOrderUnits } from './orders';
import { fmtBRL } from './wallet';
import { maskEmail } from '../utils/format';

export async function deliverOrder(telegram: Telegram, chatId: number, orderId: number) {
  const order = await getOrder(orderId);
  if (!order) return;

  const saldoAnterior = +(Number(order.paid_balance) + Number(order.balance_after)).toFixed(2);
  const msg = await renderMessage('multi_approved_header', {
    SHORT_ID: order.short_id,
    PRODUTO: order.product_name,
    QTD: order.quantity,
    VALOR_UNITARIO: fmtBRL(Number(order.unit_price)),
    VALOR_TOTAL: fmtBRL(Number(order.price_total)),
    SALDO_ANTERIOR: fmtBRL(saldoAnterior),
    SALDO_ATUAL: fmtBRL(Number(order.balance_after)),
    DATA_COMPRA: new Date(order.created_at).toLocaleString('pt-BR'),
  });

  await telegram.sendMessage(chatId, msg.text, { parse_mode: msg.parse_mode as any });
  await deliverUnit(telegram, chatId, orderId, 0, false);
}

export async function deliverUnit(
  telegram: Telegram,
  chatId: number,
  orderId: number,
  index: number,
  reveal: boolean,
) {
  const order = await getOrder(orderId);
  const units = await getOrderUnits(orderId);
  if (!order || index < 0 || index >= units.length) return;

  const unit = units[index];
  const total = units.length;
  const email = reveal ? unit.stock_email : maskEmail(unit.stock_email);
  const senha = reveal ? unit.stock_password : '••••••••';

  const msg = await renderMessage('multi_unit_view', {
    INDEX: index + 1,
    TOTAL: total,
    SHORT_ID: order.short_id,
    PRODUTO: order.product_name,
    DATA_COMPRA: new Date(unit.created_at).toLocaleDateString('pt-BR'),
    VENCIMENTO: unit.expires_at ? new Date(unit.expires_at).toLocaleDateString('pt-BR') : '—',
    VALOR: fmtBRL(Number(unit.price_total)),
    ID: unit.id,
    EMAIL: email,
    SENHA: senha,
    REF: unit.stock_email.split('@')[0],
  });

  const rows: any[] = [];
  const navRow: any[] = [];
  if (index > 0) navRow.push({ text: '« Voltar', callback_data: `unit_${orderId}_${index - 1}_0` });
  navRow.push({ text: `📄 ${index + 1}/${total}`, callback_data: 'noop' });
  if (index < total - 1) navRow.push({ text: 'Avançar »', callback_data: `unit_${orderId}_${index + 1}_0` });
  if (navRow.length > 1) rows.push(navRow);

  rows.push([{
    text: reveal ? '🔒 Desativar' : '🔓 Ativar',
    callback_data: `unit_toggle_${orderId}_${index}_${reveal ? 1 : 0}`,
  }]);
  if (order.site_url) rows.push([{ text: '🌐 Ir para o site', url: order.site_url }]);
  rows.push([{ text: '⬅️ Voltar ao catálogo', callback_data: 'catalog_page_0' }]);

  await telegram.sendMessage(chatId, msg.text, {
    parse_mode: msg.parse_mode as any,
    reply_markup: { inline_keyboard: rows },
  });
}
