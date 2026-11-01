import { Context } from 'telegraf';
import { renderMessage } from '../services/messages';
import { getProduct, countAvailableStock } from '../services/products';
import { getBalance, fmtBRL } from '../services/wallet';
import { completePurchaseWithBalance, getPurchase } from '../services/purchases';
import {
  cancelPix,
  createPurchaseDiffPix,
  fetchMpStatus,
  processPixPaid,
} from '../services/pix';
import { sendOrEdit } from '../utils/render';

async function sendApproved(ctx: Context, purchaseId: number, reveal: boolean) {
  const p = await getPurchase(purchaseId);
  if (!p) return;
  const dataCompra = new Date(p.created_at).toLocaleString('pt-BR');
  const venc = p.expires_at ? new Date(p.expires_at).toLocaleDateString('pt-BR') : '—';
  const isVisible = reveal;
  const email = isVisible ? p.stock_email : maskEmail(p.stock_email);
  const senha = isVisible ? p.stock_password : '••••••••';

  const msg = await renderMessage('purchase_approved', {
    SHORT_ID: p.short_id,
    ID: p.id,
    PRODUTO: p.product_name,
    VALOR: fmtBRL(Number(p.price_total)),
    PAGO_SALDO: fmtBRL(Number(p.paid_balance)),
    PAGO_PIX: fmtBRL(Number(p.paid_pix)),
    SALDO_ATUAL: fmtBRL(Number(p.balance_after)),
    DATA_COMPRA: dataCompra,
    VENCIMENTO: venc,
    EMAIL: email,
    SENHA: senha,
    NOTA: p.usage_note ?? '—',
  });

  const rows: any[] = [
    [{
      text: isVisible ? '🔒 Desativar' : '🔓 Ativar',
      callback_data: `toggle_cred_${p.id}_${isVisible ? 1 : 0}`,
    }],
  ];
  if (p.site_url) rows.push([{ text: '🌐 Ir para o site', url: p.site_url }]);
  rows.push([{ text: '⬅️ Voltar ao catálogo', callback_data: 'catalog_page_0' }]);

  await sendOrEdit(ctx.telegram, ctx, { ...msg, reply_markup: { inline_keyboard: rows } });
}

function maskEmail(email: string): string {
  const [u, d] = email.split('@');
  if (!d) return '••••';
  const head = u.slice(0, Math.min(2, u.length));
  return `${head}${'•'.repeat(Math.max(2, u.length - 2))}@${d}`;
}

/**
 * Caminho A / B — Decide baseado no saldo atual.
 */
export async function buyProductHandler(ctx: Context, productId: number): Promise<void> {
  if (!ctx.from) return;
  const userId = ctx.from.id;

  const p = await getProduct(productId);
  if (!p || !p.is_active) return ctx.answerCbQuery?.('Produto indisponível').catch(() => {});

  const [saldo, estoque] = await Promise.all([
    getBalance(userId),
    countAvailableStock(productId),
  ]);

  if (estoque <= 0) {
    return ctx.answerCbQuery?.('Sem estoque').catch(() => {});
  }

  // ===== Caminho A — Saldo suficiente =====
  if (saldo >= p.price) {
    try {
      const purchase = await completePurchaseWithBalance(userId, productId);
      await ctx.answerCbQuery?.('✅ Compra aprovada!').catch(() => {});
      await sendApproved(ctx, purchase.id, false);
      return;
    } catch (e: any) {
      const code = String(e?.message ?? '');
      if (code === 'OUT_OF_STOCK') return ctx.answerCbQuery?.('Sem estoque').catch(() => {});
      if (code === 'INSUFFICIENT_BALANCE') {
        // corrida: saldo caiu entre checagem e transação → cai no caminho B
      } else {
        console.error('[buy] erro:', e);
        return ctx.answerCbQuery?.('Erro ao processar').catch(() => {});
      }
    }
  }

  // ===== Caminho B — Saldo insuficiente =====
  const falta = +(p.price - saldo).toFixed(2);
  const msg = await renderMessage('insufficient_balance', {
    SALDO: fmtBRL(saldo),
    VALOR: fmtBRL(p.price),
    FALTA: fmtBRL(falta),
  });
  await ctx.answerCbQuery?.().catch(() => {});
  await sendOrEdit(ctx.telegram, ctx, {
    ...msg,
    reply_markup: {
      inline_keyboard: [
        [{ text: `⚡ Gerar PIX de R$ ${fmtBRL(falta)}`, callback_data: `gen_pix_buy_${productId}` }],
        [{ text: '❌ Cancelar', callback_data: 'cancel_flow' }],
      ],
    },
  });
}

/**
 * Cria o PIX da diferença.
 */
export async function genPixBuyHandler(ctx: Context, productId: number): Promise<void> {
  if (!ctx.from) return;
  try {
    const pix = await createPurchaseDiffPix(ctx.from.id, productId);
    const minutes = Math.max(1, Math.round((new Date(pix.expires_at!).getTime() - Date.now()) / 60_000));
    const saldoReservado = Number(pix.balance_reserved);
    const valorPix = Number(pix.amount);
    const msg = await renderMessage('pix_created', {
      MINUTOS: minutes,
      VALOR: fmtBRL(valorPix),
      ID: pix.reference,
      CODIGO_PIX: pix.qr_code ?? '—',
      SALDO_RESERVADO: fmtBRL(saldoReservado),
      VALOR_PIX: fmtBRL(valorPix),
      TOTAL_DISPONIVEL: fmtBRL(saldoReservado + valorPix),
    });
    await ctx.answerCbQuery?.().catch(() => {});
    await sendOrEdit(ctx.telegram, ctx, {
      ...msg,
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Aguardando pagamento', callback_data: `check_pix_${pix.reference}` }],
          [{ text: '📋 Copiar PIX', copy_text: { text: pix.qr_code ?? '' } }],
          [{ text: '❌ Cancelar', callback_data: `cancel_pix_${pix.reference}` }],
        ],
      },
    });
  } catch (e: any) {
    const code = String(e?.message ?? '');
    console.error('[gen_pix]', code);
    if (code === 'OUT_OF_STOCK') return ctx.answerCbQuery?.('Sem estoque').catch(() => {});
    if (code === 'BALANCE_ALREADY_ENOUGH') {
      // saldo já cobre — dispara compra direta
      return buyProductHandler(ctx, productId);
    }
    return ctx.answerCbQuery?.('Erro ao gerar PIX').catch(() => {});
  }
}

/**
 * Consulta MP e processa.
 */
export async function checkPixHandler(ctx: Context, reference: string): Promise<void> {
  const found = await (await import('../db')).db.query(
    `SELECT * FROM pix_payments WHERE reference = $1`,
    [reference],
  );
  const pix = found.rows[0];
  if (!pix) return ctx.answerCbQuery?.('PIX não encontrado').catch(() => {});

  if (!pix.mp_payment_id) {
    return ctx.answerCbQuery?.('PIX sem referência MP').catch(() => {});
  }

  const result = await fetchMpStatus(pix.mp_payment_id);
  if (!result) return ctx.answerCbQuery?.('Erro ao consultar').catch(() => {});

  if (result.status === 'approved') {
    const proc = await processPixPaid(reference);
    await ctx.answerCbQuery?.('✅ Pagamento confirmado!').catch(() => {});
    if (proc.status === 'paid' || proc.status === 'already_paid') {
      const pid = proc.purchase?.id ?? pix.id;
      await sendApproved(ctx, Number(pid), false);
    }
    return;
  }

  if (result.status === 'pending' || result.status === 'in_process') {
    const minutes = Math.max(0, Math.round((new Date(pix.expires_at).getTime() - Date.now()) / 60_000));
    const msg = await renderMessage('pix_pending', {
      VALOR: fmtBRL(Number(pix.amount)),
      ID: reference,
      MINUTOS: minutes,
    });
    return sendOrEdit(ctx.telegram, ctx, {
      ...msg,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Verificar novamente', callback_data: `check_pix_${reference}` }],
          [{ text: '📋 Copiar PIX', copy_text: { text: pix.qr_code ?? '' } }],
        ],
      },
    });
  }

  // rejeitado / cancelado / expirado
  await ctx.answerCbQuery?.('Pagamento não identificado').catch(() => {});
}

export async function cancelPixHandler(ctx: Context, reference: string): Promise<void> {
  await cancelPix(reference);
  await ctx.answerCbQuery?.('Cancelado').catch(() => {});
  await (await import('./start')).startHandler(ctx);
}

export async function cancelFlowHandler(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const { db } = await import('../db');
  const pending = await db.query(
    `SELECT reference FROM pix_payments
     WHERE user_id = $1 AND status = 'pending' AND purpose = 'purchase_diff'
     ORDER BY id DESC LIMIT 1`,
    [ctx.from.id],
  );
  if (pending.rows[0]) await cancelPix(pending.rows[0].reference);
  await ctx.answerCbQuery?.('Cancelado').catch(() => {});
  await (await import('./start')).startHandler(ctx);
}

export async function toggleCredentialsHandler(
  ctx: Context,
  purchaseId: number,
  currentVisible: boolean,
): Promise<void> {
  await ctx.answerCbQuery?.().catch(() => {});
  await sendApproved(ctx, purchaseId, !currentVisible);
}
