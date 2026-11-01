import { Request, Response } from 'express';
import { env } from '../config/env';
import { db } from '../db';
import { fetchMpStatus, processPixPaid } from '../services/pix';
import { bot } from '../bot';
import { renderMessage } from '../services/messages';
import { getPurchase } from '../services/purchases';
import { fmtBRL } from '../services/wallet';

export async function pixWebhookHandler(req: Request, res: Response) {
  // Responde 200 imediatamente; processa em seguida.
  res.status(200).send({ ok: true });

  try {
    const body = req.body ?? {};
    const mpId = body?.data?.id ? String(body.data.id) : null;
    if (!mpId) return;

    const status = await fetchMpStatus(mpId);
    if (!status) return;
    if (status.status !== 'approved') return;

    const ref = status.raw?.external_reference as string | undefined;
    if (!ref) return;

    const proc = await processPixPaid(ref);
    if (proc.status !== 'paid' && proc.status !== 'already_paid') {
      // notifica admin em caso de reembolso por inconsistência
      if (proc.status === 'refunded') {
        for (const admin of env.ADMIN_IDS) {
          bot.telegram
            .sendMessage(admin, `⚠️ PIX ${ref} reembolsado em crédito (saldo insuficiente ou estoque perdido).`)
            .catch(() => {});
        }
      }
      return;
    }

    const purchaseId = Number(proc.purchase?.id);
    if (!purchaseId) return;
    const p = await getPurchase(purchaseId);
    if (!p) return;

    const dataCompra = new Date(p.created_at).toLocaleString('pt-BR');
    const venc = p.expires_at ? new Date(p.expires_at).toLocaleDateString('pt-BR') : '—';
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
      EMAIL: p.stock_email,
      SENHA: p.stock_password,
      NOTA: p.usage_note ?? '—',
    });

    await bot.telegram
      .sendMessage(p.user_id, msg.text, {
        parse_mode: msg.parse_mode as any,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔒 Desativar', callback_data: `toggle_cred_${p.id}_1` }],
            ...(p.site_url ? [[{ text: '🌐 Ir para o site', url: p.site_url }]] : []),
            [{ text: '⬅️ Voltar ao catálogo', callback_data: 'catalog_page_0' }],
          ],
        },
      })
      .catch(() => {});
  } catch (e) {
    console.error('[webhook] erro:', e);
  }
}
