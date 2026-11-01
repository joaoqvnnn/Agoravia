import { db, tx } from '../db';
import { genShortId } from './purchases';

export interface PurchaseOrder {
  id: number;
  short_id: string;
  user_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  price_total: number;
  paid_balance: number;
  paid_pix: number;
  balance_after: number;
  payment_source: 'balance' | 'pix_balance';
  status: string;
  created_at: Date;
  product_name: string;
  site_url: string | null;
  usage_note: string | null;
}

export interface OrderUnit {
  id: number;
  short_id: string;
  stock_email: string;
  stock_password: string;
  expires_at: Date | null;
  price_total: number;
  created_at: Date;
}

async function uniqueShortId(client: any): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const id = genShortId();
    const dup = await client.query(`SELECT 1 FROM purchase_orders WHERE short_id = $1`, [id]);
    if (dup.rowCount === 0) return id;
  }
  throw new Error('SHORT_ID_COLLISION');
}

export async function completeMultiWithBalance(
  userId: number,
  productId: number,
  quantity: number,
): Promise<{ order: PurchaseOrder; units: OrderUnit[] }> {
  return tx(async (client) => {
    const product = await client.query(
      `SELECT id, price::float8 AS price, warranty_days, name
       FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE`,
      [productId],
    );
    const p = product.rows[0];
    if (!p) throw new Error('PRODUCT_UNAVAILABLE');

    const stock = await client.query(
      `SELECT id FROM product_stock
       WHERE product_id = $1 AND is_sold = FALSE
         AND (reserved_until IS NULL OR reserved_until < NOW() OR reserved_by = $2)
       ORDER BY id ASC LIMIT $3 FOR UPDATE SKIP LOCKED`,
      [productId, userId, quantity],
    );
    if (stock.rowCount !== quantity) throw new Error('OUT_OF_STOCK');

    const stockIds: number[] = stock.rows.map((r: any) => Number(r.id));
    const total = +(p.price * quantity).toFixed(2);

    const wallet = await client.query(
      `SELECT balance::float8 AS balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    const balance = Number(wallet.rows[0]?.balance ?? 0);
    if (balance < total) throw new Error('INSUFFICIENT_BALANCE');
    const newBalance = +(balance - total).toFixed(2);

    await client.query(
      `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2`,
      [newBalance, userId],
    );
    await client.query(
      `INSERT INTO wallet_transactions
         (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'debit', $2, $3, $4, 'purchase_order', $5, $6)`,
      [userId, total, balance, newBalance, String(productId), `Compra ${quantity}x ${p.name}`],
    );

    const shortId = await uniqueShortId(client);
    const expiresAt = new Date(Date.now() + p.warranty_days * 86400_000);

    const orderIns = await client.query(
      `INSERT INTO purchase_orders
         (short_id, user_id, product_id, quantity, unit_price, price_total,
          paid_balance, paid_pix, balance_after, payment_source, status)
       VALUES ($1, $2, $3, $4, $5, $6, $6, 0, $7, 'balance', 'delivered')
       RETURNING id`,
      [shortId, userId, productId, quantity, p.price, total, newBalance],
    );
    const orderId = orderIns.rows[0].id;

    const units: OrderUnit[] = [];
    for (const stockId of stockIds) {
      const unitShort = genShortId();
      const purIns = await client.query(
        `INSERT INTO purchases
           (short_id, user_id, product_id, stock_id, price_total,
            paid_balance, paid_pix, balance_after, payment_source, expires_at, order_id)
         VALUES ($1, $2, $3, $4, $5, $5, 0, $6, 'balance', $7, $8)
         RETURNING id`,
        [unitShort, userId, productId, stockId, p.price, newBalance, expiresAt, orderId],
      );
      const purchaseId = purIns.rows[0].id;

      const stk = await client.query(
        `UPDATE product_stock
         SET is_sold = TRUE, sold_at = NOW(), purchase_id = $1,
             reserved_by = NULL, reserved_until = NULL
         WHERE id = $2
         RETURNING email, password`,
        [purchaseId, stockId],
      );

      units.push({
        id: purchaseId,
        short_id: unitShort,
        stock_email: stk.rows[0].email,
        stock_password: stk.rows[0].password,
        expires_at: expiresAt,
        price_total: p.price,
        created_at: new Date(),
      });
    }

    const order = await getOrderById(client, orderId);
    return { order: order!, units };
  });
}

async function getOrderById(client: any, orderId: number): Promise<PurchaseOrder | null> {
  const r = await client.query(
    `SELECT o.id, o.short_id, o.user_id, o.product_id, o.quantity,
            o.unit_price::float8 AS unit_price,
            o.price_total::float8 AS price_total,
            o.paid_balance::float8 AS paid_balance,
            o.paid_pix::float8 AS paid_pix,
            o.balance_after::float8 AS balance_after,
            o.payment_source, o.status, o.created_at,
            p.name AS product_name, p.site_url, p.usage_note
     FROM purchase_orders o
     JOIN products p ON p.id = o.product_id
     WHERE o.id = $1`,
    [orderId],
  );
  return r.rows[0] ?? null;
}

export async function getOrder(orderId: number): Promise<PurchaseOrder | null> {
  return getOrderById(db, orderId);
}

export async function getOrderUnits(orderId: number): Promise<OrderUnit[]> {
  const r = await db.query(
    `SELECT pu.id, pu.short_id,
            pu.price_total::float8 AS price_total,
            pu.created_at, pu.expires_at,
            s.email AS stock_email, s.password AS stock_password
     FROM purchases pu
     JOIN product_stock s ON s.id = pu.stock_id
     WHERE pu.order_id = $1
     ORDER BY pu.id ASC`,
    [orderId],
  );
  return r.rows;
}
