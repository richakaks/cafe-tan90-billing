-- Cafe Tan90 — Ordering, Billing & Inventory
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project,
-- or re-run the whole file against an existing project to pick up new changes — every
-- statement in this file is written to be safely re-runnable (create-if-not-exists,
-- drop-constraint-if-exists-then-add, add-column-if-not-exists, create-or-replace).
-- Everything is accessed server-side via the service-role key (see lib/supabase.ts),
-- so RLS is enabled with no policies: it locks out the anon/public key entirely while
-- the service role (used only in trusted Next.js server code) bypasses RLS as usual.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Seats: 9 tables (T1-T9) + 4 counter seats (S1-S4). Add/remove more anytime.
-- ---------------------------------------------------------------------------
create table if not exists seats (
  id text primary key,
  label text not null,
  kind text not null check (kind in ('table', 'counter')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ingredients: the inventory itself.
-- ---------------------------------------------------------------------------
create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null,
  current_stock numeric not null default 0 check (current_stock >= 0),
  low_stock_threshold numeric not null default 0 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Menu items: each denoted by a short code (e.g. CT001), per the spec doc.
-- ---------------------------------------------------------------------------
create table if not exists menu_items (
  code text primary key,
  name text not null,
  category text not null default 'Other',
  price numeric not null check (price >= 0),
  active boolean not null default true,
  -- Drives display order everywhere (customer menu + admin), within a
  -- category and across categories at once: seeded so categories land in
  -- the Menu PRD's order and items within a category in seed order, then
  -- adjustable per item via the admin Menu page's drag handle. Left as a
  -- plain integer with gaps of 10 (not a dense 0..n sequence) so a drag
  -- reorder only needs to renumber the one category being reordered.
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Idempotent: `sort_order` was added after the table already existed in
-- production databases, so an existing installation needs this ALTER too
-- (the CREATE TABLE above only applies on a brand-new database).
alter table menu_items
  add column if not exists sort_order integer not null default 0;

-- Backfill: assigns the Menu PRD's fixed order to any menu_items row
-- that has never been migrated (sort_order still at its 0 default). Once a
-- row is migrated (or newly created, which always gets a nonzero value --
-- see upsertMenuItem in data.ts) it's permanently exempt from this backfill,
-- so re-running schema.sql can never clobber a later drag-reorder.
update menu_items as m set sort_order = v.sort_order
from (values
  ('SN-FRF', 10),
  ('SN-PPF', 20),
  ('SN-ZAF', 30),
  ('SN-SMT', 40),
  ('SN-MGN', 50),
  ('SN-ECM', 60),
  ('SN-CLN', 70),
  ('M-VMM', 80),
  ('M-CMM', 90),
  ('SD-MUS', 100),
  ('SD-GCS', 110),
  ('SD-CHS', 120),
  ('B-CVB', 130),
  ('B-CCB', 140),
  ('B-DTB', 150),
  ('B-GCB', 160),
  ('B-SCB', 170),
  ('SP-AWS0', 180),
  ('SP-AWS1', 190),
  ('T-GLT0', 200),
  ('T-GLT1', 210),
  ('T-BLT0', 220),
  ('T-BLT1', 230),
  ('T-TMT0', 240),
  ('T-TMT1', 250),
  ('T-MST0', 260),
  ('T-MST1', 270),
  ('T-BPT0', 280),
  ('T-BPT1', 290),
  ('C-BLC0', 300),
  ('C-BLC1', 310),
  ('C-CPN0', 320),
  ('C-CPN1', 330),
  ('C-HZL0', 340),
  ('C-HZL1', 350),
  ('C-MCH0', 360),
  ('C-MCH1', 370),
  ('C-CCA0', 380),
  ('C-CCA1', 390),
  ('I-LIT', 400),
  ('I-PIT', 410),
  ('SO-SLS', 420),
  ('SO-MPS', 430),
  ('SO-LLS', 440),
  ('SO-BHS', 450),
  ('SO-CRC', 460)
) as v(code, sort_order)
where m.code = v.code and m.sort_order = 0;

-- ---------------------------------------------------------------------------
-- Menu item <-> ingredient mapping: how much of each ingredient one order of
-- this item consumes. This is what both drives stock deduction and lets the
-- customer menu compute "out of stock" / "low in stock".
-- ---------------------------------------------------------------------------
create table if not exists menu_item_ingredients (
  menu_item_code text not null references menu_items(code) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  qty_per_order numeric not null check (qty_per_order > 0),
  primary key (menu_item_code, ingredient_id)
);

-- One-off cleanup: Zab Fries' SOP recipe changed from Fresh Lime Juice +
-- Ketchup to Lime Seasoning + Homemade Mayo. seed.sql's inserts are `on
-- conflict do nothing`, so re-pasting it only adds the two new links -- it
-- can never remove the two now-stale ones, which would otherwise keep
-- getting silently deducted from stock (and shown as ingredients) on every
-- Zab Fries order alongside the new pair. Harmless to re-run: matches
-- nothing once these two rows are gone.
delete from menu_item_ingredients
where menu_item_code = 'SN-ZAF'
  and ingredient_id in (select id from ingredients where name in ('Fresh Lime Juice', 'Ketchup'));

-- ---------------------------------------------------------------------------
-- Orders + order items. order_items intentionally does NOT foreign-key to
-- menu_items — item_name/price_at_order are snapshotted so order history
-- survives menu edits or a discontinued item.
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  daily_order_number int not null,
  order_date date not null,
  seat_id text not null references seats(id),
  status text not null default 'placed' check (status in ('placed', 'served')),
  created_at timestamptz not null default now(),
  unique (order_date, daily_order_number)
);

create table if not exists order_items (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_code text not null,
  item_name text not null,
  qty int not null check (qty > 0),
  price_at_order numeric not null
);

create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_order_date_idx on orders(order_date);

-- ---------------------------------------------------------------------------
-- Lock everything down by default (service role bypasses RLS; nothing else
-- has a policy, so nothing else can read or write).
-- ---------------------------------------------------------------------------
alter table seats enable row level security;
alter table ingredients enable row level security;
alter table menu_items enable row level security;
alter table menu_item_ingredients enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- ---------------------------------------------------------------------------
-- place_order: the one place stock gets deducted and order numbers get
-- assigned. Runs as a single transaction so two customers checking out at
-- once can't both oversell the same ingredient, and daily order numbers
-- (which reset each day, Asia/Bangkok time) never collide.
--
-- p_items shape: [{"code": "CT001", "qty": 2}, ...]
-- ---------------------------------------------------------------------------
create or replace function place_order(p_seat_id text, p_items jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_order_id uuid;
  v_order_date date := (timezone('Asia/Bangkok', now()))::date;
  v_daily_number int;
  v_item jsonb;
  v_code text;
  v_qty int;
  v_price numeric;
  v_name text;
  v_active boolean;
  v_total numeric := 0;
  v_out_of_stock text[];
  v_result_items jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order' using errcode = 'P0001';
  end if;

  if not exists (select 1 from seats where id = p_seat_id) then
    raise exception 'invalid_seat: %', p_seat_id using errcode = 'P0001';
  end if;

  create temporary table _required (
    ingredient_id uuid primary key,
    needed numeric not null
  ) on commit drop;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_code := v_item ->> 'code';
    v_qty := (v_item ->> 'qty')::int;

    if v_code is null or v_qty is null or v_qty <= 0 then
      raise exception 'invalid_item' using errcode = 'P0001';
    end if;

    select name, price, active into v_name, v_price, v_active
    from menu_items where code = v_code;

    if v_name is null then
      raise exception 'unknown_item: %', v_code using errcode = 'P0001';
    end if;
    if not v_active then
      raise exception 'inactive_item: %', v_code using errcode = 'P0001';
    end if;

    insert into _required (ingredient_id, needed)
    select mii.ingredient_id, mii.qty_per_order * v_qty
    from menu_item_ingredients mii
    where mii.menu_item_code = v_code
    on conflict (ingredient_id)
    do update set needed = _required.needed + excluded.needed;

    v_total := v_total + v_price * v_qty;
    v_result_items := v_result_items || jsonb_build_object(
      'code', v_code, 'name', v_name, 'qty', v_qty, 'price', v_price
    );
  end loop;

  -- Lock the involved ingredient rows (stable order avoids deadlocks against
  -- concurrent checkouts), then check every one has enough stock.
  perform 1 from ingredients i
  join _required r on r.ingredient_id = i.id
  order by i.id
  for update;

  select array_agg(i.name order by i.name)
  into v_out_of_stock
  from ingredients i
  join _required r on r.ingredient_id = i.id
  where i.current_stock < r.needed;

  if v_out_of_stock is not null and array_length(v_out_of_stock, 1) > 0 then
    raise exception 'out_of_stock: %', array_to_string(v_out_of_stock, ', ') using errcode = 'P0001';
  end if;

  update ingredients i
  set current_stock = i.current_stock - r.needed
  from _required r
  where r.ingredient_id = i.id;

  -- Serialize daily-number allocation per calendar day so concurrent
  -- checkouts on the same day never get the same number.
  perform pg_advisory_xact_lock(hashtext(v_order_date::text));

  select coalesce(max(daily_order_number), 0) + 1
  into v_daily_number
  from orders
  where order_date = v_order_date;

  insert into orders (id, daily_order_number, order_date, seat_id, status)
  values (gen_random_uuid(), v_daily_number, v_order_date, p_seat_id, 'placed')
  returning id into v_order_id;

  insert into order_items (order_id, menu_item_code, item_name, qty, price_at_order)
  select v_order_id, item ->> 'code', item ->> 'name', (item ->> 'qty')::int, (item ->> 'price')::numeric
  from jsonb_array_elements(v_result_items) as item;

  return jsonb_build_object(
    'order_id', v_order_id,
    'daily_order_number', v_daily_number,
    'seat_id', p_seat_id,
    'order_date', v_order_date,
    'items', v_result_items,
    'total', v_total
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Coupons: pre-printed physical vouchers sold in batches (e.g. an org buys
-- 10 coupons worth ฿20 each). Each individual coupon is single-use — its
-- code and value are fixed at batch-sale time, and it's marked redeemed the
-- first (and only) time it's applied to a bill.
-- ---------------------------------------------------------------------------
create table if not exists coupon_batches (
  id uuid primary key default gen_random_uuid(),
  buyer_name text not null,
  coupon_value numeric not null check (coupon_value > 0),
  quantity int not null check (quantity > 0),
  total_collected numeric not null check (total_collected >= 0),
  sold_at timestamptz not null default now()
);

create table if not exists coupons (
  code text primary key,
  batch_id uuid not null references coupon_batches(id) on delete cascade,
  value numeric not null check (value > 0),
  redeemed boolean not null default false,
  redeemed_at timestamptz,
  redeemed_order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists coupons_batch_id_idx on coupons(batch_id);

alter table coupon_batches enable row level security;
alter table coupons enable row level security;

-- ---------------------------------------------------------------------------
-- Pre-ordering + coupon redemption support on orders. An immediate (walk-in)
-- order still gets seat_id/order_date/daily_order_number set right away, same
-- as always. A pre-order is created with all three left null and status
-- 'pending_pickup' — stock is NOT touched at this point, since the pickup
-- date could be days out and shouldn't lock away today's stock. Only when
-- staff fulfill it (fulfill_pre_order, below) does it get a real order_date +
-- daily_order_number and become a normal 'placed' order, indistinguishable
-- from a walk-in from that point on.
-- ---------------------------------------------------------------------------
alter table orders
  alter column seat_id drop not null,
  alter column order_date drop not null,
  alter column daily_order_number drop not null,
  add column if not exists order_type text not null default 'immediate' check (order_type in ('immediate', 'pre_order')),
  add column if not exists requested_date date,
  add column if not exists requested_time time,
  add column if not exists coupon_code text references coupons(code),
  add column if not exists discount_amount numeric not null default 0 check (discount_amount >= 0);

alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check (status in ('pending_pickup', 'placed', 'served', 'paid'));

alter table orders drop constraint if exists orders_immediate_requires_seat;
alter table orders add constraint orders_immediate_requires_seat
  check (order_type <> 'immediate' or seat_id is not null);

-- ---------------------------------------------------------------------------
-- place_pre_order: like place_order, but for an order scheduled ahead of
-- time with no seat yet. Validates items exist/are active same as a normal
-- order, but does NOT check or deduct stock — that happens later, at
-- fulfillment, since stock on hand today doesn't predict stock on the
-- requested date.
--
-- p_items shape: [{"code": "CT001", "qty": 2}, ...]
-- ---------------------------------------------------------------------------
create or replace function place_pre_order(p_items jsonb, p_requested_date date, p_requested_time time)
returns jsonb
language plpgsql
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_code text;
  v_qty int;
  v_price numeric;
  v_name text;
  v_active boolean;
  v_total numeric := 0;
  v_result_items jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order' using errcode = 'P0001';
  end if;

  if p_requested_date is null then
    raise exception 'missing_requested_date' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_code := v_item ->> 'code';
    v_qty := (v_item ->> 'qty')::int;

    if v_code is null or v_qty is null or v_qty <= 0 then
      raise exception 'invalid_item' using errcode = 'P0001';
    end if;

    select name, price, active into v_name, v_price, v_active
    from menu_items where code = v_code;

    if v_name is null then
      raise exception 'unknown_item: %', v_code using errcode = 'P0001';
    end if;
    if not v_active then
      raise exception 'inactive_item: %', v_code using errcode = 'P0001';
    end if;

    v_total := v_total + v_price * v_qty;
    v_result_items := v_result_items || jsonb_build_object(
      'code', v_code, 'name', v_name, 'qty', v_qty, 'price', v_price
    );
  end loop;

  insert into orders (id, seat_id, status, order_type, requested_date, requested_time)
  values (gen_random_uuid(), null, 'pending_pickup', 'pre_order', p_requested_date, p_requested_time)
  returning id into v_order_id;

  insert into order_items (order_id, menu_item_code, item_name, qty, price_at_order)
  select v_order_id, item ->> 'code', item ->> 'name', (item ->> 'qty')::int, (item ->> 'price')::numeric
  from jsonb_array_elements(v_result_items) as item;

  return jsonb_build_object(
    'order_id', v_order_id,
    'requested_date', p_requested_date,
    'requested_time', p_requested_time,
    'items', v_result_items,
    'total', v_total
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- fulfill_pre_order: the moment a pre-order becomes real — checks/deducts
-- stock (same atomic pattern as place_order) and assigns it a real
-- order_date + daily_order_number for today, then flips status to 'placed'
-- so it shows up on /serve exactly like a walk-in order from here on.
-- ---------------------------------------------------------------------------
create or replace function fulfill_pre_order(p_order_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_order_type text;
  v_status text;
  v_order_date date := (timezone('Asia/Bangkok', now()))::date;
  v_daily_number int;
  v_out_of_stock text[];
begin
  select order_type, status into v_order_type, v_status
  from orders where id = p_order_id
  for update;

  if v_order_type is null then
    raise exception 'unknown_order' using errcode = 'P0001';
  end if;
  if v_order_type <> 'pre_order' then
    raise exception 'not_a_pre_order' using errcode = 'P0001';
  end if;
  if v_status <> 'pending_pickup' then
    raise exception 'already_fulfilled' using errcode = 'P0001';
  end if;

  create temporary table _required (
    ingredient_id uuid primary key,
    needed numeric not null
  ) on commit drop;

  insert into _required (ingredient_id, needed)
  select mii.ingredient_id, mii.qty_per_order * oi.qty
  from order_items oi
  join menu_item_ingredients mii on mii.menu_item_code = oi.menu_item_code
  where oi.order_id = p_order_id
  on conflict (ingredient_id)
  do update set needed = _required.needed + excluded.needed;

  perform 1 from ingredients i
  join _required r on r.ingredient_id = i.id
  order by i.id
  for update;

  select array_agg(i.name order by i.name)
  into v_out_of_stock
  from ingredients i
  join _required r on r.ingredient_id = i.id
  where i.current_stock < r.needed;

  if v_out_of_stock is not null and array_length(v_out_of_stock, 1) > 0 then
    raise exception 'out_of_stock: %', array_to_string(v_out_of_stock, ', ') using errcode = 'P0001';
  end if;

  update ingredients i
  set current_stock = i.current_stock - r.needed
  from _required r
  where r.ingredient_id = i.id;

  perform pg_advisory_xact_lock(hashtext(v_order_date::text));

  select coalesce(max(daily_order_number), 0) + 1
  into v_daily_number
  from orders
  where order_date = v_order_date;

  update orders
  set order_date = v_order_date,
      daily_order_number = v_daily_number,
      status = 'placed'
  where id = p_order_id;

  return jsonb_build_object(
    'order_id', p_order_id,
    'order_date', v_order_date,
    'daily_order_number', v_daily_number
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- redeem_coupon: applies one single-use coupon's value as a discount on an
-- order's bill. Atomic so the same code can never be applied twice, even if
-- two staff tap it around the same moment.
-- ---------------------------------------------------------------------------
create or replace function redeem_coupon(p_order_id uuid, p_coupon_code text)
returns jsonb
language plpgsql
as $$
declare
  v_value numeric;
  v_redeemed boolean;
  v_existing_coupon text;
begin
  select value, redeemed into v_value, v_redeemed
  from coupons where code = p_coupon_code
  for update;

  if v_value is null then
    raise exception 'unknown_coupon' using errcode = 'P0001';
  end if;
  if v_redeemed then
    raise exception 'coupon_already_redeemed' using errcode = 'P0001';
  end if;

  select coupon_code into v_existing_coupon from orders where id = p_order_id for update;
  if v_existing_coupon is not null then
    raise exception 'order_already_has_coupon' using errcode = 'P0001';
  end if;

  update coupons
  set redeemed = true, redeemed_at = now(), redeemed_order_id = p_order_id
  where code = p_coupon_code;

  update orders
  set coupon_code = p_coupon_code, discount_amount = v_value
  where id = p_order_id;

  return jsonb_build_object('order_id', p_order_id, 'coupon_code', p_coupon_code, 'discount_amount', v_value);
end;
$$;

-- ---------------------------------------------------------------------------
-- Billing: orders reach a final 'paid' status once staff settle the bill on
-- the /billing screen (separate from 'served', which just means the food/
-- drinks were handed over). Staff can mark one order paid at a time, or
-- several at once (a table that ordered more than once in a visit) — the
-- app does this with a plain multi-row UPDATE, no new function needed since
-- there's no stock/number allocation involved, just a status flip.
-- (orders_status_check above already includes 'paid'.)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- stock_adjustments: an append-only log of every manual restock/use-up entry
-- made from /admin/inventory, so there's a history behind the running
-- current_stock total (who/when/how much — no user identity tracked yet
-- since staff share one PIN, but timestamp + delta + resulting stock already
-- answers "when did we last restock this, and by how much").
-- ---------------------------------------------------------------------------
create table if not exists stock_adjustments (
  id bigserial primary key,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  delta numeric not null,
  resulting_stock numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists stock_adjustments_ingredient_id_idx on stock_adjustments(ingredient_id);

alter table stock_adjustments enable row level security;

-- ---------------------------------------------------------------------------
-- reset_all_orders: a testing/setup utility for wiping trial orders placed
-- while trying out the QR flow, without leaving orphaned state behind.
-- Un-redeems any coupon that was applied to an order first (while
-- redeemed_order_id still points at it, so only actually-redeemed coupons
-- are touched) — otherwise deleting the order would leave that coupon
-- permanently stuck "redeemed" with no order to show for it, since
-- coupons.redeemed_order_id is ON DELETE SET NULL rather than cascading.
-- Deliberately does NOT touch ingredient stock — see reset_all_stock below
-- for that, kept as a separate action so the two can be run independently.
-- ---------------------------------------------------------------------------
create or replace function reset_all_orders()
returns void
language plpgsql
as $$
begin
  update coupons
  set redeemed = false, redeemed_at = null, redeemed_order_id = null
  where redeemed_order_id is not null;

  delete from orders;
end;
$$;

-- ---------------------------------------------------------------------------
-- reset_all_stock: a testing/setup utility for zeroing every ingredient's
-- current_stock back out (e.g. after playing with restock/use-up numbers to
-- see how the low-stock badges/alerts behave). Logs one stock_adjustments
-- row per ingredient that actually had stock, same as a normal manual
-- adjustment, so the reset itself shows up in the restock history.
-- ---------------------------------------------------------------------------
create or replace function reset_all_stock()
returns void
language plpgsql
as $$
begin
  insert into stock_adjustments (ingredient_id, delta, resulting_stock)
  select id, -current_stock, 0 from ingredients where current_stock <> 0;

  update ingredients set current_stock = 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- clear_stock_history: wipes the stock_adjustments log itself (not current
-- stock levels) — a separate action from reset_all_stock above. While
-- testing, reset_all_stock deliberately logs its own zeroing as adjustment
-- rows (so a *real* reset is traceable later); this function is for
-- discarding that whole trial-run log once testing is done, without
-- touching ingredients.current_stock at all.
-- ---------------------------------------------------------------------------
create or replace function clear_stock_history()
returns void
language plpgsql
as $$
begin
  delete from stock_adjustments;
end;
$$;

-- ---------------------------------------------------------------------------
-- reset_orders_in_range: same as reset_all_orders above (un-redeems coupons
-- first, deliberately leaves stock untouched) but scoped to a date range
-- instead of everything, filtered on order_date -- the same column
-- getSalesAnalytics/getOrdersForExport filter on -- so clearing "this range"
-- always matches whatever the Analytics dashboard is showing for it. A
-- still-pending pre-order (order_date still null) is never matched by either
-- bound, so it's never touched by this, same as it's excluded from analytics
-- until it's fulfilled. p_from/p_to are inclusive on both ends.
-- ---------------------------------------------------------------------------
create or replace function reset_orders_in_range(p_from date, p_to date)
returns void
language plpgsql
as $$
begin
  update coupons
  set redeemed = false, redeemed_at = null, redeemed_order_id = null
  where redeemed_order_id in (
    select id from orders where order_date between p_from and p_to
  );

  delete from orders where order_date between p_from and p_to;
end;
$$;

-- ---------------------------------------------------------------------------
-- Explicit grants for the service role. Newer Supabase projects no longer
-- auto-grant service_role access to tables created by hand (the "Automatically
-- expose new tables" project setting) — these grants make this schema work
-- regardless of that toggle. RLS above still fully locks out anon/authenticated;
-- service_role bypasses RLS as usual but still needs table-level privileges to
-- be reachable through the Data API at all.
-- ---------------------------------------------------------------------------
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function place_order(text, jsonb) to service_role;
grant execute on function place_pre_order(jsonb, date, time) to service_role;
grant execute on function fulfill_pre_order(uuid) to service_role;
grant execute on function redeem_coupon(uuid, text) to service_role;
grant execute on function reset_all_orders() to service_role;
grant execute on function reset_all_stock() to service_role;
grant execute on function clear_stock_history() to service_role;
grant execute on function reset_orders_in_range(date, date) to service_role;
