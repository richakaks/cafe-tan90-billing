# Cafe Tan90 — Ordering, Billing &amp; Inventory

Customers scan a QR code on their table (T1–T9) or counter seat (S1–S4), order from
a live menu, and pay a staff member directly, no in-app payment. Placing an order
atomically deducts stock from linked ingredients, and the customer menu shows
'low in stock' / 'out of stock' badges computed from that same stock in real time.
Staff have a PIN-gated serving screen and inventory/menu admin.

Built as a separate app from the Cafe Tan90 attendance tool (which stays on Google
Apps Script + Sheets) - this one is customer-facing and needs a real database, so it
runs on Next.js + Supabase (Postgres), deployed on Vercel. See the plan doc shared at
the start of this project for the reasoning behind these choices.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign up / log in, and create a new project (the free tier is enough).
2. Once it's ready, open the **SQL Editor** and run the contents of [`supabase/schema.sql`](supabase/schema.sql) — this creates all the tables and the `place_order` function that does atomic stock deduction + daily order numbering.
3. Then run [`supabase/seed.sql`](supabase/seed.sql) — this adds the 13 seats (T1–T9, S1–S4), the real Tan90 menu (46 items), and the full ingredient/inventory catalog (11 batch-prepped "primaries" + 60 raw ingredients), with their recipe links. **Starting stock levels and low-stock thresholds in this file are placeholder par levels for day one** — correct them via `/admin/inventory` once real counts are taken. `supabase/seed.sql` is generated from `scripts/gen_seed.py`; if the menu or recipes change again, edit the data there and regenerate with `python3 scripts/gen_seed.py > supabase/seed.sql` rather than hand-editing the SQL.
4. Go to **Settings → API** and copy the **Project URL** and the **service_role** key (not the anon key — this app never uses the anon key; every database call happens server-side). Keep the service-role key secret, it bypasses all row-level security.

## 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from step 1, pick a `STAFF_PIN`,
and generate a `STAFF_SESSION_SECRET` with:

```bash
openssl rand -hex 32
```

## 3. Run locally

```bash
npm install
npm run dev
```

- Customer menu: `http://localhost:3000/order/T1` (or any of T1–T9, S1–S4)
- Staff serving screen: `http://localhost:3000/serve` (PIN-gated)
- Inventory admin: `http://localhost:3000/admin/inventory` (PIN-gated)
- Menu/ingredient admin: `http://localhost:3000/admin/menu` (PIN-gated)

## 4. Generate QR codes

Once you know the app's real URL (see deployment below), generate one QR code
per seat plus a printable sheet:

```bash
npm run qrcodes -- https://your-deployed-domain.vercel.app
```

Output goes to `qrcodes/` (gitignored) — open `qrcodes/print-sheet.html` in a
browser and print it, or print each `T*.png`/`S*.png` individually and stick
them on the corresponding table/seat.

## 5. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in [vercel.com/new](https://vercel.com/new).
3. Add the same four environment variables from `.env.local` in the Vercel project settings.
4. Deploy. Then re-run step 4 above with the real `https://...vercel.app` URL (or your custom domain) to generate the QR codes staff will actually put on tables.

## How stock availability works

Every menu item can be linked to one or more ingredients with a quantity used per
order (`/admin/menu`). For each item, the app computes the largest number that
could be made right now from current ingredient stock:

- **Out of stock** (blocked on the customer menu) — stock isn't enough to make even one more.
- **Low in stock** (badge shown, still orderable) — makeable, but some linked ingredient has dropped below its restock threshold.
- Otherwise shown normally.

This logic lives in `src/lib/stock.ts` as a pure function with unit tests
(`npm test`) — it has no database dependency, so it's easy to verify in isolation.

Stock is actually deducted (and the daily order number assigned) inside a single
Postgres transaction (`place_order` in `supabase/schema.sql`), so two customers
checking out on the same ingredient at the same moment can't oversell it, and
order numbers — which reset each day, Asia/Bangkok time — never collide.

## Known simplifications (v1)

- **"Primaries" are tracked as one stock number, not their raw sub-ingredients.**
  Batch-prepped items (White Sauce, Sautéed Mushrooms, Potato Patty, Tikka
  Marinated Mince, Homemade Mayo, Fresh Salsa, Gochujang Sauce, Caramelised
  Onions, Sugar Syrup, Coffee Concentrate, Black Tea Concentrate) are ordinary
  `ingredients` rows in their own right — restocked manually whenever a fresh
  batch is made — rather than a nested bill-of-materials down to butter,
  flour, milk, eggs, etc. Those raw components aren't deducted when a batch
  is made, and a batch doesn't have to be fully used before the next one is
  prepped; this is a deliberate simplification, not a bug.
- **Salt, sugar, chilli flakes, black pepper, condensed milk, and whipped
  cream aren't tracked in the system at all** — no `ingredients` row for any
  of them. Per the owner, these are handled with manual par stock (an extra
  one on hand at all times, replaced the moment it's opened/finished) rather
  than digital inventory. Salt/sugar were the original case; the same
  treatment was extended to the other four since the SOP gives no usable
  fixed quantity for them either ("to taste", "optional garnish", a quantity
  missing from the source table, "small dollop").
- **Frying Oil is tracked, but never auto-deducted.** The SOP gives no
  per-order quantity ("sufficient to submerge"), so there's nothing to link
  it to a menu item for. Seeded at 5L / 1L threshold, matching how the cafe
  actually buys and uses it today — a 5L jug poured in whole on Monday and
  drawn down across the week (currently Mon–Fri, no mid-week top-up). As
  order volume grows and the owner moves to refilling every 3 days plus
  Saturday service, update the stock number directly via `/admin/inventory`
  rather than re-seeding.
- **Four menu items have no recipe yet and so deduct nothing**: EXTRA CHEESY
  Maggie (SN-ECM), Veg Momo (M-VMM), Chicken Momo (M-CMM), and Spicy Chicken
  Burger (B-SCB). They're seeded active and orderable — customers can order
  them today — but no SOP recipe exists for any of the four in the Kitchen or
  Bar manuals, so nothing is deducted from inventory when they're ordered.
  Link their ingredients via `/admin/menu` once recipes are written.
- **"Out of stock" error detail names ingredients, not menu items.** If checkout
  fails because stock ran out between page load and checkout (a race with another
  customer), the error message lists the ingredient name (e.g. "Coffee Beans"),
  not the drink. Good enough for a small cafe; could be mapped back to item names
  later if it's ever confusing in practice.
- **Serving screen polls, it doesn't use Supabase realtime.** It refreshes every
  6 seconds via a normal fetch rather than a live websocket subscription. This was
  a deliberate simplification to avoid exposing a Supabase anon key to the browser
  (every DB access in this app is server-side, using the service-role key only) —
  the original plan mentioned realtime, this is the tradeoff made to keep that
  "no client-side Supabase" security posture. 6 seconds is fine for a walk-up
  serving screen; shout if it needs to feel more instant.
- **No hard delete for menu items/ingredients** — only an active/inactive toggle
  for menu items (a "delete" would break old order history, since ingredients and
  items can be referenced by past orders' ingredient links). Discontinue an item
  by switching it inactive rather than deleting it.
- **Table/seat list is seeded, not admin-editable yet.** Adding an item to
  `seats` is a one-line SQL insert (see `supabase/seed.sql`) — there's no admin UI
  for it in this v1 since 13 is fixed for now. Say the word if that needs to change.

## Project structure

```
supabase/schema.sql       Tables, RLS (locked down — service role bypasses it), place_order()
supabase/seed.sql         13 seats + real menu + ingredient catalog (generated, see scripts/gen_seed.py)
scripts/gen_seed.py       Source data for seed.sql — edit here, then regenerate
src/lib/                  Types, Supabase client, stock-availability logic, PIN auth, data access
src/proxy.ts              PIN-gates /serve and /admin/* (Next.js "Proxy", formerly middleware)
src/app/order/[seatId]/   Customer menu, basket, checkout
src/app/serve/            Staff serving screen
src/app/admin/inventory/  Stock levels, restock, thresholds
src/app/admin/menu/       Menu items + ingredient mapping
scripts/generate-qrcodes.mjs   QR codes + printable sheet
```
