import { randomBytes } from 'crypto';
import { db, tx } from '../db';
import { env } from '../config/env';
import { completePurchaseWithBalance, genShortId } from './purchases';

export interface PixPayment {
  id: number;
  reference: string;
  user_id: number;
  purpose: 'topup' | 'purchase_diff' | 'cart_diff';
  product_id: number | null;
  stock_id: number | null;
  amount: number;
  balance_reserved: number;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded';
  mp_payment_id: string | null;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  expires_at: Date | null;
  paid_at: Date | null;
}

function genReference(): string {
  return `PIX_${Date.now()}_${randomBytes(3).toString('hex').toUpperCase()}`;
}

function getSettingInt(key: string, fallback: number): Promise<number> {
  return db
    .query<{ value: string }>(`SELECT value FROM settings WHERE key = $1`, [key])
    .then((r) => Number(r.rows[0]?.value ?? fallback));
}

/**
 * Cria PIX no Mercado Pago para a DIFERENÇA de uma compra.
 * Também reserva o estoque e guarda o saldo atual como "reservado".
 * Idempotente: se houver PIX pendente do mesmo usuário/produto, reaproveita.
 */
export async function createPurchaseDiffPix(
  userId: number,
  productId: number,
): Promise<PixPayment> {
  const reservationMinutes = await getSettingInt('stock_reservation_minutes', 30);
  const expiryMinutes = await getSettingInt('pix_expiry_minutes', 30);

  return tx(async (client) => {
    // Reutiliza PIX pendente
    const existing = await client.query(
      `SELECT * FROM pix_payments
       WHERE user_id = $1 AND product_id = $2 AND purpose = 'purchase_diff'
         AND status = 'pending' AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1
       FOR UPDATE`,
      [userId, productId],
    );
    if (existing.rows[0]) return existing.rows[0] as PixPayment;

    const product = await client.query(
      `SELECT id, price::float8 AS price, name, is_active
       FROM products WHERE id = $1 FOR UPDATE`,
      [productId],
    );
    const p = product.rows[0];
    if (!p || !p.is_active) throw new Error('PRODUCT_UNAVAILABLE');

    const wallet = await client.query(
      `SELECT balance::float8 AS balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    const balance = Number(wallet.rows[0]?.balance ?? 0);
    const diff = +(p.price - balance).toFixed(2);
    if (diff <= 0) throw new Error('BALANCE_ALREADY_ENOUGH');

    const stock = await client.query(
      `SELECT id FROM product_stock
       WHERE product_id = $1
         AND is_sold = FALSE
         AND (reserved_until IS NULL OR reserved_until < NOW() OR reserved_by = $2)
       ORDER BY id ASC LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [productId, userId],
    );
    const item = stock.rows[0];
    if (!item) throw new Error('OUT_OF_STOCK');

    const reservedUntil = new Date(Date.now() + reservationMinutes * 60_000);
    await client.query(
      `UPDATE product_stock
         SET reserved_by = $1, reserved_until = $2
       WHERE id = $3`,
      [userId, reservedUntil, item.id],
    );

    const reference = genReference();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60_000);

    // Cria pagamento no Mercado Pago
    const mpBody: any = {
      transaction_amount: Number(diff.toFixed(2)),
      description: `Compra #${reference} - ${p.name}`,
      payment_method_id: 'pix',
      external_reference: reference,
      payer: { email: `user${userId}@larizinhastore.bot` },
      date_of_expiration: expiresAt.toISOString(),
    };

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'X-Idempotency-Key': reference,
      },
      body: JSON.stringify(mpBody),
    });
    const mp: any = await mpRes.json();
    if (!mpRes.ok) {
      throw new Error(`MERCADO_PAGO_ERROR: ${JSON.stringify(mp).slice(0, 300)}`);
    }

    const qr = mp.point_of_interaction?.transaction_data ?? {};

    const ins = await client.query<PixPayment>(
      `INSERT INTO pix_payments
        (reference, user_id, purpose, product_id, stock_id, amount,
         balance_reserved, status, mp_payment_id,
         qr_code, qr_code_base64, ticket_url, expires_at)
       VALUES ($1, $2, 'purchase_diff', $3, $4, $5, $6, 'pending',
               $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        reference, userId, productId, item.id, diff, balance,
        String(mp.id ?? ''), qr.qr_code ?? null, qr.qr_code_base64 ?? null,
        qr.ticket_url ?? null, expiresAt,
      ],
    );
    return ins.rows[0];
  });
}

/**
 * Consulta status diretamente no Mercado Pago.
 */
export async function fetchMpStatus(mpId: string): Promise<{ status: string; raw: any } | null> {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${mpId}`, {
    headers: { Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}` },
  });
  if (!r.ok) return null;
  const raw: any = await r.json();
  return { status: raw.status, raw };
}

/**
 * Processa confirmação de pagamento. Idempotente.
 * Retorna dados para o bot enviar mensagem ao usuário.
 */
export async function processPixPaid(
  reference: string,
): Promise<{ status: 'paid' | 'already_paid' | 'refunded' | 'not_found' | 'not_pending';
            purchase?: any; pix?: PixPayment }> {
  return tx(async (client) => {
    const pix = await client.query<PixPayment>(
      `SELECT * FROM pix_payments WHERE reference = $1 FOR UPDATE`,
      [reference],
    );
    const p = pix.rows[0];
    if (!p) return { status: 'not_found' as const };
    if (p.status === 'paid') {
      // idempotência — busca a compra vinculada
      const existing = await client.query(
        `SELECT * FROM purchases WHERE user_id = $1 AND product_id = $2
         ORDER BY id DESC LIMIT 1`,
        [p.user_id, p.product_id],
      );
      return { status: 'already_paid' as const, pix: p, purchase: existing.rows[0] };
    }
    if (p.status !== 'pending') return { status: 'not_pending' as const, pix: p };

    if (p.purpose !== 'purchase_diff' || !p.product_id || !p.stock_id) {
      // topup/cart ainda não implementados neste módulo
      return { status: 'not_pending' as const, pix: p };
    }

    // Lock do estoque reservado
    const stock = await client.query(
      `SELECT id, email, password, extra_data FROM product_stock
       WHERE id = $1 AND is_sold = FALSE FOR UPDATE`,
      [p.stock_id],
    );
    const item = stock.rows[0];

    // Lock da carteira
    const wallet = await client.query(
      `SELECT balance::float8 AS balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [p.user_id],
    );
    const balance = Number(wallet.rows[0]?.balance ?? 0);

    // Se estoque sumiu (raro, reserva expirou e foi consumida), reembolso em crédito
    // Se saldo caiu abaixo do reservado, reembolso em crédito
    if (!item || balance < Number(p.balance_reserved)) {
      await client.query(
        `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`,
        [p.amount, p.user_id],
      );
      await client.query(
        `INSERT INTO wallet_transactions
          (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
         VALUES ($1, 'credit', $2, $3, $4, 'pix_refund', $5, $6)`,
        [p.user_id, p.amount, balance, balance + Number(p.amount), p.reference,
         'PIX recebido — saldo reservado insuficiente, crédito aplicado'],
      );
      await client.query(
        `UPDATE pix_payments SET status = 'refunded', paid_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [p.id],
      );
      if (item) {
        await client.query(
          `UPDATE product_stock SET reserved_by = NULL, reserved_until = NULL WHERE id = $1`,
          [item.id],
        );
      }
      return { status: 'refunded' as const, pix: p };
    }

    // Caminho feliz: debita saldo + baixa estoque + cria compra
    const useBalance = Number(p.balance_reserved);
    const newBalance = +(balance - useBalance).toFixed(2);

    await client.query(
      `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2`,
      [newBalance, p.user_id],
    );
    await client.query(
      `INSERT INTO wallet_transactions
        (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'debit', $2, $3, $4, 'purchase', $5, 'Compra (parte saldo)')`,
      [p.user_id, useBalance, balance, newBalance, p.reference],
    );

    const product = await client.query(
      `SELECT warranty_days FROM products WHERE id = $1`,
      [p.product_id],
    );
    const warrantyDays = product.rows[0]?.warranty_days ?? 30;
    const expiresAt = new Date(Date.now() + warrantyDays * 86400_000);

    let shortId = genShortId();
    const purchase = await client.query(
      `INSERT INTO purchases
        (short_id, user_id, product_id, stock_id, price_total,
         paid_balance, paid_pix, balance_after, payment_source, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pix_balance', $9)
       RETURNING *`,
      [
        shortId, p.user_id, p.product_id, p.stock_id,
        Number(p.balance_reserved) + Number(p.amount),
        useBalance, Number(p.amount), newBalance, expiresAt,
      ],
    );

    await client.query(
      `UPDATE product_stock
        SET is_sold = TRUE, sold_at = NOW(), purchase_id = $1,
            reserved_by = NULL, reserved_until = NULL
       WHERE id = $2`,
      [purchase.rows[0].id, p.stock_id],
    );

    await client.query(
      `UPDATE pix_payments SET status = 'paid', paid_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [p.id],
    );

    return { status: 'paid' as const, pix: p, purchase: purchase.rows[0] };
  });
}

/**
 * Cancela PIX pendente e libera reserva.
 */
export async function cancelPix(reference: string): Promise<boolean> {
  return tx(async (client) => {
    const p = await client.query<PixPayment>(
      `SELECT * FROM pix_payments WHERE reference = $1 FOR UPDATE`,
      [reference],
    );
    const pix = p.rows[0];
    if (!pix || pix.status !== 'pending') return false;

    await client.query(
      `UPDATE pix_payments SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [pix.id],
    );
    if (pix.stock_id) {
      await client.query(
        `UPDATE product_stock SET reserved_by = NULL, reserved_until = NULL
         WHERE id = $1 AND is_sold = FALSE`,
        [pix.stock_id],
      );
    }
    return true;
  });
}

/**
 * Limpa PIX expirados e libera reservas — executado periodicamente.
 * Retorna lista de usuários a notificar.
 */
export async function expireStale(): Promise<
  { user_id: number; reference: string; amount: number }[]
> {
  return tx(async (client) => {
    const stale = await client.query<PixPayment>(
      `UPDATE pix_payments
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'pending' AND expires_at < NOW()
       RETURNING *`,
    );
    for (const p of stale.rows) {
      if (p.stock_id) {
        await client.query(
          `UPDATE product_stock SET reserved_by = NULL, reserved_until = NULL
           WHERE id = $1 AND is_sold = FALSE`,
          [p.stock_id],
        );
      }
    }
    // Libera reservas sem PIX (nunca chegaram a gerar)
    await client.query(
      `UPDATE product_stock
       SET reserved_by = NULL, reserved_until = NULL
       WHERE is_sold = FALSE AND reserved_until IS NOT NULL AND reserved_until < NOW()`,
    );
    return stale.rows.map((p) => ({
      user_id: p.user_id,
      reference: p.reference,
      amount: Number(p.amount),
    }));
  });
}
