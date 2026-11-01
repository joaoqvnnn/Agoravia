import { randomBytes } from 'crypto';
import { db, tx } from '../db';
import { getProduct } from './products';

export interface Purchase {
  id: number;
  short_id: string;
  user_id: number;
  product_id: number;
  stock_id: number;
  price_total: number;
  paid_balance: number;
  paid_pix: number;
  balance_after: number;
  payment_source: 'balance' | 'pix_balance';
  expires_at: Date | null;
  created_at: Date;
}

export function genShortId(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

/**
 * Caminho A — Saldo suficiente. Tudo numa transação atômica:
 *  - reserva/consome 1 estoque
 *  - debita a carteira
 *  - registra compra
 *  - marca estoque vendido
 */
export async function completePurchaseWithBalance(
  userId: number,
  productId: number,
): Promise<Purchase> {
  return tx(async (client) => {
    const product = await client.query(
      `SELECT id, price::float8 AS price, warranty_days, usage_note, is_active
       FROM products WHERE id = $1 FOR UPDATE`,
      [productId],
    );
    const p = product.rows[0];
    if (!p || !p.is_active) throw new Error('PRODUCT_UNAVAILABLE');

    const stock = await client.query(
      `SELECT id, email, password, extra_data
       FROM product_stock
       WHERE product_id = $1
         AND is_sold = FALSE
         AND (reserved_until IS NULL OR reserved_until < NOW() OR reserved_by = $2)
       ORDER BY id ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [productId, userId],
    );
    const item = stock.rows[0];
    if (!item) throw new Error('OUT_OF_STOCK');

    const wallet = await client.query(
      `SELECT balance::float8 AS balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    const balance = Number(wallet.rows[0]?.balance ?? 0);
    if (balance < p.price) throw new Error('INSUFFICIENT_BALANCE');

    const newBalance = +(balance - p.price).toFixed(2);

    await client.query(
      `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2`,
      [newBalance, userId],
    );
    await client.query(
      `INSERT INTO wallet_transactions
         (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'debit', $2, $3, $4, 'purchase', $5, $6)`,
      [userId, p.price, balance, newBalance, String(productId), 'Compra'],
    );

    const expiresAt = new Date(Date.now() + p.warranty_days * 86400_000);

    let shortId = genShortId();
    for (let i = 0; i < 5; i++) {
      const dup = await client.query(
        `SELECT 1 FROM purchases WHERE short_id = $1`,
        [shortId],
      );
      if (dup.rowCount === 0) break;
      shortId = genShortId();
    }

    const purchase = await client.query<Purchase>(
      `INSERT INTO purchases
         (short_id, user_id, product_id, stock_id, price_total,
          paid_balance, paid_pix, balance_after, payment_source, expires_at)
       VALUES ($1, $2, $3, $4, $5, $5, 0, $6, 'balance', $7)
       RETURNING id, short_id, user_id, product_id, stock_id,
                 price_total::float8 AS price_total,
                 paid_balance::float8 AS paid_balance,
                 paid_pix::float8 AS paid_pix,
                 balance_after::float8 AS balance_after,
                 payment_source, expires_at, created_at`,
      [shortId, userId, productId, item.id, p.price, newBalance, expiresAt],
    );
    const purchaseRow = purchase.rows[0];

    await client.query(
      `UPDATE product_stock
         SET is_sold = TRUE, sold_at = NOW(), purchase_id = $1,
             reserved_by = NULL, reserved_until = NULL
       WHERE id = $2`,
      [purchaseRow.id, item.id],
    );

    return purchaseRow;
  });
}

export async function getPurchase(id: number): Promise<(Purchase & {
  product_name: string;
  stock_email: string;
  stock_password: string;
  stock_extra: any;
  usage_note: string | null;
  site_url: string | null;
}) | null> {
  const r = await db.query(
    `SELECT p.*, p.price_total::float8 AS price_total,
            p.paid_balance::float8 AS paid_balance,
            p.paid_pix::float8 AS paid_pix,
            p.balance_after::float8 AS balance_after,
            pr.name AS product_name, pr.usage_note, pr.site_url,
            s.email AS stock_email, s.password AS stock_password,
            s.extra_data AS stock_extra
     FROM purchases p
     JOIN products pr ON pr.id = p.product_id
     JOIN product_stock s ON s.id = p.stock_id
     WHERE p.id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}
