/** Cart snapshots use a total price; legacy product rows use a unit price. */
export interface AbandonedCartEvent {
  id?: string;
  event_type: string;
  product_id?: string | null;
  session_id?: string | null;
  visitor_id?: string | null;
  created_at: string;
  price?: number | string | null;
  quantity?: number | string | null;
  items?: unknown;
}

export interface AbandonedCartSummary {
  lostRevenue: number;
  abandonedCount: number;
  avgAbandonedTicket: number;
}

const positiveNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

export const abandonedEventValue = (row: AbandonedCartEvent): number =>
  row.product_id === 'cart' || Array.isArray(row.items)
    ? positiveNumber(row.price)
    : positiveNumber(row.price) * positiveNumber(row.quantity ?? 1);

/** Only recorded session/visitor identities link recovery; a checkout click is not a purchase. */
export const summarizeAbandonedCarts = (
  abandoned: AbandonedCartEvent[],
  purchases: AbandonedCartEvent[],
): AbandonedCartSummary => {
  const latestPurchaseBySession = new Map<string, number>();
  const latestPurchaseByVisitor = new Map<string, number>();
  for (const purchase of purchases) {
    if (purchase.event_type !== 'purchase') continue;
    const time = Date.parse(purchase.created_at);
    if (!Number.isFinite(time)) continue;
    if (purchase.session_id) latestPurchaseBySession.set(purchase.session_id, Math.max(time, latestPurchaseBySession.get(purchase.session_id) ?? -Infinity));
    if (purchase.visitor_id) latestPurchaseByVisitor.set(purchase.visitor_id, Math.max(time, latestPurchaseByVisitor.get(purchase.visitor_id) ?? -Infinity));
  }

  const carts = new Map<string, AbandonedCartEvent[]>();
  for (const row of abandoned) {
    if (row.event_type !== 'abandoned_cart' || !Number.isFinite(Date.parse(row.created_at))) continue;
    // Anonymous rows cannot be reliably deduplicated or linked to a conversion.
    const key = row.session_id ? `session:${row.session_id}` : row.visitor_id ? `visitor:${row.visitor_id}` : null;
    if (!key) continue;
    const rows = carts.get(key) ?? [];
    rows.push(row);
    carts.set(key, rows);
  }

  const totals: number[] = [];
  for (const rows of carts.values()) {
    rows.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || (a.id ?? '').localeCompare(b.id ?? ''));
    const latest = rows[rows.length - 1];
    if (!latest) continue;
    const time = Date.parse(latest.created_at);
    const recovered = rows.some(row =>
      (row.session_id && (latestPurchaseBySession.get(row.session_id) ?? -Infinity) >= time) ||
      (row.visitor_id && (latestPurchaseByVisitor.get(row.visitor_id) ?? -Infinity) >= time),
    );
    if (recovered) continue;

    let value = 0;
    if (latest.product_id === 'cart' || Array.isArray(latest.items)) {
      value = abandonedEventValue(latest);
    } else {
      // Legacy events were written per product: keep each product's last state,
      // never accumulate repeated snapshots or mix with older cart-level totals.
      const products = new Map<string, AbandonedCartEvent>();
      for (const row of rows) {
        if (row.product_id === 'cart' || Array.isArray(row.items)) products.clear();
        else if (row.product_id) products.set(row.product_id, row);
      }
      value = [...products.values()].reduce((sum, row) => sum + abandonedEventValue(row), 0);
    }
    if (value > 0) totals.push(value);
  }
  const lostRevenue = totals.reduce((sum, value) => sum + value, 0);
  return { lostRevenue, abandonedCount: totals.length, avgAbandonedTicket: totals.length ? lostRevenue / totals.length : 0 };
};

/** Both queries are paginated; recovery reads are intentionally not attribution/date-end filtered. */
export const loadAbandonedCartSummary = async (
  fetchPage: (kind: 'abandoned' | 'purchases', offset: number, limit: number) => Promise<AbandonedCartEvent[]>,
): Promise<AbandonedCartSummary> => {
  const load = async (kind: 'abandoned' | 'purchases') => {
    const rows: AbandonedCartEvent[] = [];
    const limit = 1000;
    for (let offset = 0; ; offset += limit) {
      const page = await fetchPage(kind, offset, limit);
      rows.push(...page);
      if (page.length < limit) return rows;
    }
  };
  const [abandoned, purchases] = await Promise.all([load('abandoned'), load('purchases')]);
  return summarizeAbandonedCarts(abandoned, purchases);
};