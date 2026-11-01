import { db } from '../db';

export interface Product {
  id: number;
  category_id: number | null;
  name: string;
  description: string | null;
  price: number;
  warranty_days: number;
  site_url: string | null;
  usage_note: string | null;
  is_active: boolean;
}

export async function getPageSize(): Promise<number> {
  const r = await db.query<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'catalog_page_size'`,
  );
  return Math.max(1, Number(r.rows[0]?.value ?? 6));
}

export async function countActiveProducts(): Promise<number> {
  const r = await db.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM products WHERE is_active = TRUE`,
  );
  return Number(r.rows[0]?.c ?? 0);
}

export async function listActiveProducts(
  limit: number,
  offset: number,
): Promise<Product[]> {
  const r = await db.query<Product>(
    `SELECT id, category_id, name, description, price::float8 AS price,
            warranty_days, site_url, usage_note, is_active
     FROM products
     WHERE is_active = TRUE
     ORDER BY sort_order ASC, id ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return r.rows;
}

export async function getProduct(id: number): Promise<Product | null> {
  const r = await db.query<Product>(
    `SELECT id, category_id, name, description, price::float8 AS price,
            warranty_days, site_url, usage_note, is_active
     FROM products WHERE id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

export async function countAvailableStock(productId: number): Promise<number> {
  const r = await db.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
     FROM product_stock
     WHERE product_id = $1
       AND is_sold = FALSE
       AND (reserved_until IS NULL OR reserved_until < NOW())`,
    [productId],
  );
  return Number(r.rows[0]?.c ?? 0);
}

export async function countSales(productId: number): Promise<number> {
  const r = await db.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM product_stock
     WHERE product_id = $1 AND is_sold = TRUE`,
    [productId],
  );
  return Number(r.rows[0]?.c ?? 0);
}
