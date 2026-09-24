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
  -- Optional supplier/brand name (Round 18) -- purely informational, shown
  -- under the ingredient name on /admin/inventory.
  brand text,
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
-- p_items shape: [{"code": "CT001", "qty": 2, "fulfillmentType": "dine_in"}, ...]
-- fulfillmentType is optional per item and defaults to 'dine_in' when absent,
-- so older clients that don't send it keep working (Round 22).
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
  v_packaging text;
  v_fulfillment text;
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
    v_fulfillment := coalesce(v_item ->> 'fulfillmentType', 'dine_in');

    if v_code is null or v_qty is null or v_qty <= 0 then
      raise exception 'invalid_item' using errcode = 'P0001';
    end if;
    if v_fulfillment not in ('dine_in', 'takeaway') then
      raise exception 'invalid_fulfillment_type: %', v_fulfillment using errcode = 'P0001';
    end if;

    select name, price, active, packaging_type into v_name, v_price, v_active, v_packaging
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

    -- Packaging consumables (Round 22): takeaway food/hot/cold each pull a
    -- fixed lidded container, and any cold drink pulls a straw regardless of
    -- dine-in vs takeaway. Looked up by fixed ingredient name so this is a
    -- safe no-op (matches nothing, inserts nothing) if the Consumables
    -- catalog hasn't been seeded yet.
    if v_fulfillment = 'takeaway' and v_packaging = 'food' then
      insert into _required (ingredient_id, needed)
      select id, v_qty from ingredients where name = 'Takeaway Food Box'
      on conflict (ingredient_id) do update set needed = _required.needed + excluded.needed;
      -- Round 23: a cutlery set goes out with every takeaway food box.
      insert into _required (ingredient_id, needed)
      select id, v_qty from ingredients where name = 'Plastic Cutlery Set'
      on conflict (ingredient_id) do update set needed = _required.needed + excluded.needed;
    elsif v_fulfillment = 'takeaway' and v_packaging = 'hot_drink' then
      insert into _required (ingredient_id, needed)
      select id, v_qty from ingredients where name = 'Hot Takeaway Glass'
      on conflict (ingredient_id) do update set needed = _required.needed + excluded.needed;
    elsif v_fulfillment = 'takeaway' and v_packaging = 'cold_drink' then
      insert into _required (ingredient_id, needed)
      select id, v_qty from ingredients where name = 'Cold Takeaway Glass'
      on conflict (ingredient_id) do update set needed = _required.needed + excluded.needed;
    end if;
    if v_packaging = 'cold_drink' then
      insert into _required (ingredient_id, needed)
      select id, v_qty from ingredients where name = 'Straw'
      on conflict (ingredient_id) do update set needed = _required.needed + excluded.needed;
    end if;

    v_total := v_total + v_price * v_qty;
    v_result_items := v_result_items || jsonb_build_object(
      'code', v_code, 'name', v_name, 'qty', v_qty, 'price', v_price, 'fulfillmentType', v_fulfillment
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

  insert into order_items (order_id, menu_item_code, item_name, qty, price_at_order, fulfillment_type)
  select v_order_id, item ->> 'code', item ->> 'name', (item ->> 'qty')::int, (item ->> 'price')::numeric, item ->> 'fulfillmentType'
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
  v_fulfillment text;
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
    v_fulfillment := coalesce(v_item ->> 'fulfillmentType', 'dine_in');

    if v_code is null or v_qty is null or v_qty <= 0 then
      raise exception 'invalid_item' using errcode = 'P0001';
    end if;
    if v_fulfillment not in ('dine_in', 'takeaway') then
      raise exception 'invalid_fulfillment_type: %', v_fulfillment using errcode = 'P0001';
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
      'code', v_code, 'name', v_name, 'qty', v_qty, 'price', v_price, 'fulfillmentType', v_fulfillment
    );
  end loop;

  insert into orders (id, seat_id, status, order_type, requested_date, requested_time)
  values (gen_random_uuid(), null, 'pending_pickup', 'pre_order', p_requested_date, p_requested_time)
  returning id into v_order_id;

  insert into order_items (order_id, menu_item_code, item_name, qty, price_at_order, fulfillment_type)
  select v_order_id, item ->> 'code', item ->> 'name', (item ->> 'qty')::int, (item ->> 'price')::numeric, item ->> 'fulfillmentType'
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

  -- Packaging consumables (Round 22), set-based version of the same rule
  -- place_order applies per item: takeaway food/hot/cold each pull a fixed
  -- lidded container, and any cold drink pulls a straw regardless of
  -- dine-in vs takeaway. Joining by fixed ingredient name makes this a safe
  -- no-op if the Consumables catalog hasn't been seeded yet.
  insert into _required (ingredient_id, needed)
  select ing.id, sum(pkg.qty_needed)
  from (
    select
      oi.qty as qty_needed,
      case
        when oi.fulfillment_type = 'takeaway' and mi.packaging_type = 'food' then 'Takeaway Food Box'
        when oi.fulfillment_type = 'takeaway' and mi.packaging_type = 'hot_drink' then 'Hot Takeaway Glass'
        when oi.fulfillment_type = 'takeaway' and mi.packaging_type = 'cold_drink' then 'Cold Takeaway Glass'
      end as ingredient_name
    from order_items oi
    join menu_items mi on mi.code = oi.menu_item_code
    where oi.order_id = p_order_id
    union all
    select
      oi.qty as qty_needed,
      case when mi.packaging_type = 'cold_drink' then 'Straw' end as ingredient_name
    from order_items oi
    join menu_items mi on mi.code = oi.menu_item_code
    where oi.order_id = p_order_id
    union all
    -- Round 23: a cutlery set goes out with every takeaway food box.
    select
      oi.qty as qty_needed,
      case when oi.fulfillment_type = 'takeaway' and mi.packaging_type = 'food' then 'Plastic Cutlery Set' end as ingredient_name
    from order_items oi
    join menu_items mi on mi.code = oi.menu_item_code
    where oi.order_id = p_order_id
  ) pkg
  join ingredients ing on ing.name = pkg.ingredient_name
  where pkg.ingredient_name is not null
  group by ing.id
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

-- Idempotent: price_paid was added after the table already existed in
-- production databases (Round 13). Total THB paid for that restock, not a
-- per-unit rate -- optional, and only meaningful on a positive (+Restock)
-- delta; the app never sets it on a negative (-Use) entry.
alter table stock_adjustments
  add column if not exists price_paid numeric;

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

  -- `where true`: some Postgres setups (this project's included) load a
  -- safeupdate-style guard that rejects any UPDATE/DELETE with no WHERE
  -- clause at all, even when "everything" is genuinely the intent. This is
  -- an unconditional delete by design (that's the whole point of "reset
  -- all orders") -- the always-true condition satisfies the guard without
  -- changing behavior.
  delete from orders where true;
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

  -- `where true`: see the matching note in reset_all_orders above -- this
  -- guards against the same "no WHERE clause at all" rejection while
  -- staying an unconditional zero-out of every ingredient, as intended.
  update ingredients set current_stock = 0 where true;
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
  -- `where true`: see the matching note in reset_all_orders above -- this
  -- guards against the same "no WHERE clause at all" rejection while
  -- staying an unconditional wipe of the whole log, as intended.
  delete from stock_adjustments where true;
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
-- Historical sales: a one-time import (Round 14) of the owner's pre-app
-- paper/spreadsheet sales log (27-May-2026 through early Aug-2026), kept
-- entirely separate from the live `orders`/`order_items` tables so it can
-- never interact with billing, inventory deduction, or the
-- orders_immediate_requires_seat constraint above — it only feeds
-- Sales & Analytics (getSalesAnalytics reads both tables and merges them).
--
-- Every line item from the source is imported, including ones whose name
-- doesn't match any current menu item (menu_item_code stays null for
-- those) — the owner asked for these to be kept for sales history and used
-- in analytics too, just visibly flagged as no longer on the menu, rather
-- than silently dropped. source_row_id is a fixed identifier assigned at
-- import time purely so re-pasting the one-time import SQL is a no-op
-- instead of duplicating rows.
--
-- price_source records where unit_price/total_revenue came from:
--   'recorded'      — the real price the owner logged at the time (May/Jun/Jul)
--   'reconstructed' — August's price columns were broken (#REF! formula
--                     errors) in the source sheet, so the price shown is
--                     today's app price for the matched item, per the
--                     owner's instruction
--   'unknown'       — August row with no menu match, so there's no current
--                     price to reconstruct from either; unit_price/total_revenue are null
-- ---------------------------------------------------------------------------
create table if not exists historical_sales (
  id bigserial primary key,
  source_row_id integer not null unique,
  sale_date date not null,
  item_name text not null,
  menu_item_code text references menu_items(code) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_price numeric,
  total_revenue numeric,
  price_source text not null check (price_source in ('recorded', 'reconstructed', 'unknown')),
  payment_note text,
  created_at timestamptz not null default now()
);

create index if not exists historical_sales_sale_date_idx on historical_sales(sale_date);
create index if not exists historical_sales_menu_item_code_idx on historical_sales(menu_item_code);

alter table historical_sales enable row level security;

-- ---------------------------------------------------------------------------
-- Round 17: payment method (cash vs online), recorded when staff mark a bill
-- paid on /billing. Nullable — every order marked paid before this feature
-- existed stays unlabeled rather than guessed at, and it's left unset while
-- an order is still open (only set at the same moment status flips to
-- 'paid', in markOrdersPaid in data.ts).
-- ---------------------------------------------------------------------------
alter table orders
  add column if not exists payment_method text;

alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'online'));

-- ---------------------------------------------------------------------------
-- Round 18: optional brand/supplier name on an ingredient, editable from
-- /admin/inventory's new Edit option.
-- ---------------------------------------------------------------------------
alter table ingredients
  add column if not exists brand text;

-- ---------------------------------------------------------------------------
-- Round 18: how many servings one order of this item's recipe actually
-- produces (usually 1) -- editable from /admin/menu's Edit panel. Purely
-- informational; nothing currently multiplies stock deduction by it.
-- ---------------------------------------------------------------------------
alter table menu_items
  add column if not exists yield_servings integer not null default 1;
alter table menu_items drop constraint if exists menu_items_yield_servings_check;
alter table menu_items add constraint menu_items_yield_servings_check check (yield_servings > 0);

-- ---------------------------------------------------------------------------
-- Round 18: editing a menu item's code (its permanent ID). The owner chose a
-- full rename -- recipe links and historical sales rows should follow the
-- item to its new code, and past live orders should retroactively show it
-- under the new code too. menu_item_ingredients/historical_sales already
-- reference menu_items(code) with ON DELETE behavior; adding ON UPDATE
-- CASCADE here lets a plain `update menu_items set code = ...` propagate to
-- both automatically. order_items.menu_item_code is deliberately NOT a
-- foreign key (Round 1's decision, so a receipt survives even if the item is
-- later deleted) -- rename_menu_item_code() below updates it by hand so past
-- orders follow the rename too, per the owner's explicit choice.
-- ---------------------------------------------------------------------------
alter table menu_item_ingredients drop constraint if exists menu_item_ingredients_menu_item_code_fkey;
alter table menu_item_ingredients add constraint menu_item_ingredients_menu_item_code_fkey
  foreign key (menu_item_code) references menu_items(code) on delete cascade on update cascade;

alter table historical_sales drop constraint if exists historical_sales_menu_item_code_fkey;
alter table historical_sales add constraint historical_sales_menu_item_code_fkey
  foreign key (menu_item_code) references menu_items(code) on delete set null on update cascade;

create or replace function rename_menu_item_code(p_old_code text, p_new_code text)
returns void
language plpgsql
as $$
begin
  if p_old_code = p_new_code then
    return;
  end if;
  if exists (select 1 from menu_items where code = p_new_code) then
    raise exception 'Item code % is already in use', p_new_code;
  end if;

  update menu_items set code = p_new_code where code = p_old_code;
  -- menu_item_ingredients and historical_sales already followed via their
  -- ON UPDATE CASCADE foreign keys above. order_items has no FK, so it's
  -- updated explicitly here.
  update order_items set menu_item_code = p_new_code where menu_item_code = p_old_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Round 21: split inventory into "batch prep" (the primaries -- keema,
-- base milks, concentrates, sauces made in-house in a batch) vs "raw
-- ingredients" (everything bought/stored as a single raw item), per the
-- owner's request to show these as two separate sections on
-- /admin/inventory. This is the exact same primaries/raw split the app has
-- used internally since v1 (see PRIMARIES/RAW in scripts/gen_seed.py) --
-- just never persisted as a real column before now, so it couldn't be
-- shown, filtered, or set on a new ingredient from the UI.
-- ---------------------------------------------------------------------------
alter table ingredients
  add column if not exists kind text not null default 'raw';
-- Widened in Round 22 to also allow 'consumable' (see that section near the
-- end of this file) -- kept as one constraint statement rather than two, so
-- re-running this file never re-asserts a narrower version of the check
-- against rows a later seed.sql run already gave the wider kind to.
alter table ingredients drop constraint if exists ingredients_kind_check;
alter table ingredients add constraint ingredients_kind_check
  check (kind in ('batch_prep', 'raw', 'consumable'));

-- Backfill: every ingredient gen_seed.py's PRIMARIES dict already lists is a
-- batch-prep item; safe to re-run (a name not present here is a no-op, and
-- an already-correct row is just set to the same value again).
update ingredients set kind = 'batch_prep'
where name in (
  'White Sauce', 'Sautéed Mushrooms', 'Potato Patty', 'Tikka Marinated Mince',
  'Homemade Mayo', 'Fresh Salsa', 'Gochujang Sauce', 'Caramelised Onions',
  'Sugar Syrup', 'Coffee Concentrate', 'Black Tea Concentrate', 'Base Milk',
  'Chocolate Syrup', 'Chicken Keema', 'Veg Keema', 'Tomato Sauce'
);

-- ---------------------------------------------------------------------------
-- Round 21: customer-facing menu item descriptions and an optional photo,
-- both editable from /admin/menu. image_url points at a file in the
-- 'menu-images' Storage bucket created below.
-- ---------------------------------------------------------------------------
alter table menu_items
  add column if not exists description text;
alter table menu_items
  add column if not exists image_url text;

-- Public bucket (photos aren't sensitive data, and this keeps the customer
-- menu simple -- no signed URLs to refresh). Every upload still goes through
-- a server route using the service-role key, same as every other write in
-- this app; the bucket being public only controls whether a GET on the
-- resulting URL needs a token, not who can upload.
--
-- Guarded behind an existence check on storage.buckets: that table is a
-- Supabase-managed extension, not part of plain Postgres, so this stays a
-- no-op (instead of an error) when schema.sql is applied to the local
-- tan90test validation database, which has no storage schema at all.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public)
    values ('menu-images', 'menu-images', true)
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Round 21: descriptions researched per item (see project notes). Only fills
-- description when it's still null, so re-pasting this file never clobbers
-- a description an owner has since edited by hand from /admin/menu.
-- ---------------------------------------------------------------------------
update menu_items set description = 'Classic hand-cut style French fries, crisped for crunch on the outside and fluffy within. Simple, salty, and the reason fries became the world''s favorite side in the first place.' where code = 'SN-FRF' and description is null;
update menu_items set description = 'Peri-peri, or piri-piri, is the African bird''s-eye chilli that Portuguese traders carried to Mozambique — its smoky, citrusy heat now coats these fries instead of a plain salt shake. Expect a slow-building kick, not a punch.' where code = 'SN-PPF' and description is null;
update menu_items set description = '"Zab" is Isaan slang for a flavor so good it makes you want more — these fries are tossed in a bold Thai seasoning blend that leans salty, herby, and a little spicy. Not your average fries.' where code = 'SN-ZAF' and description is null;
update menu_items set description = 'A South Asian street-food staple: a crisp pastry shell folded around a spiced potato-and-pea filling, then fried to a golden crunch. Three pieces, best eaten hot with a dunk of chutney.' where code = 'SN-SMT' and description is null;
update menu_items set description = 'Maggi is India''s beloved instant noodle brand, elevated here with masala spices for a quick, comforting bowl loaded with warm curry notes. Nostalgic dorm-room food, done properly.' where code = 'SN-MGN' and description is null;
update menu_items set description = 'Our masala Maggi noodles piled under a blanket of melted cheese, because sometimes the classic just needs more pull-apart, gooey cheese on top. Comfort food, stacked.' where code = 'SN-ECM' and description is null;
update menu_items set description = 'Crispy nachos loaded with seasoned chicken, melted cheese, and all the fixings — a shareable plate built for splitting between friends over one order. Grab a fork or just dig in with your hands.' where code = 'SN-CLN' and description is null;
update menu_items set description = 'Momo are steamed dumplings native to Nepal and Tibet, traditionally filled and folded by hand before being served with a spicy tomato-based dip. This version is vegetable-filled, light, and best eaten straight off the steamer.' where code = 'M-VMM' and description is null;
update menu_items set description = 'Momo are steamed dumplings native to Nepal and Tibet, traditionally filled and folded by hand before being served with a spicy tomato-based dip. This version is packed with seasoned chicken for a juicier, savory bite.' where code = 'M-CMM' and description is null;
update menu_items set description = 'Earthy sautéed mushrooms griddled between bread until warm and savory — mushrooms bring a natural umami depth that makes this feel richer than a simple veg sandwich has any right to.' where code = 'SD-MUS' and description is null;
update menu_items set description = 'The kind of sandwich that needs no introduction: bread and cheese, grilled until the outside turns golden and the inside goes properly stretchy-melted. Simple done well is still a skill.' where code = 'SD-GCS' and description is null;
update menu_items set description = 'Chicken marinated tikka-style — a North Indian yogurt-and-spice mix traditionally cooked in a tandoor — grilled and stacked into a sandwich for a smoky, tangy bite that''s more than your average chicken sandwich.' where code = 'SD-CHS' and description is null;
update menu_items set description = 'A housemade potato patty, breaded and fried until crisp, stacked with melted cheese for a veg burger that''s hearty enough to satisfy without any meat. Made in-house, not from a frozen box.' where code = 'B-CVB' and description is null;
update menu_items set description = 'A juicy chicken patty and melted cheese in a straightforward, satisfying burger — the kind of order that never goes wrong when you can''t decide what to get.' where code = 'B-CCB' and description is null;
update menu_items set description = 'Two chicken patties stacked instead of one, for anyone who thinks a single patty just isn''t quite enough burger. Double the bite, double the trouble.' where code = 'B-DTB' and description is null;
update menu_items set description = 'Gochujang is a fermented Korean chilli paste, made from red chilli, glutinous rice, and fermented soybeans — the fermentation is what gives it that deep, savory-sweet heat rather than just plain spice. Here it''s slathered onto a chicken burger for a distinctly Korean kick.' where code = 'B-GCB' and description is null;
update menu_items set description = 'A chicken burger finished with chilli oil for a sharp, lingering heat that builds with every bite rather than hitting all at once. For those who like their spice with a bit of a slow burn.' where code = 'B-SCB' and description is null;
update menu_items set description = 'A creamy Alfredo built on butter, cream, and parmesan, tossed with sautéed mushrooms for an earthy contrast to the richness. Comfort-food pasta, Italian-American style.' where code = 'SP-AWS0' and description is null;
update menu_items set description = 'A creamy Alfredo built on butter, cream, and parmesan, tossed with tender chicken for extra bite in every forkful. Comfort-food pasta, Italian-American style.' where code = 'SP-AWS1' and description is null;
update menu_items set description = 'Fresh ginger and lemon steeped together — ginger has long been used to ease digestion and settle the stomach, while lemon adds a bright, cutting acidity. Served hot, it''s the kind of tea that feels like it''s doing you good.' where code = 'T-GLT0' and description is null;
update menu_items set description = 'Fresh ginger and lemon steeped together — ginger has long been used to ease digestion and settle the stomach, while lemon adds a bright, cutting acidity. Served over ice, it''s just as soothing but built for a hot afternoon.' where code = 'T-GLT1' and description is null;
update menu_items set description = 'Straightforward black tea, full-bodied and slightly brisk with a natural dose of caffeine and antioxidants called flavonoids. No frills — just a proper cup of tea, hot.' where code = 'T-BLT0' and description is null;
update menu_items set description = 'Straightforward black tea, full-bodied and slightly brisk with a natural dose of caffeine and antioxidants called flavonoids. Served cold, it''s a simple, refreshing alternative to soda.' where code = 'T-BLT1' and description is null;
update menu_items set description = 'Thai milk tea gets its signature orange-red color and toasty flavor from a blend of black tea, spices, and sometimes a touch of tamarind or vanilla, brewed strong and cut with sweetened milk. Rich, aromatic, and unmistakably Thai — served hot.' where code = 'T-TMT0' and description is null;
update menu_items set description = 'Thai milk tea gets its signature orange-red color and toasty flavor from a blend of black tea, spices, and sometimes a touch of tamarind or vanilla, brewed strong and cut with sweetened milk. Poured over ice, it''s Thailand''s answer to the milkshake.' where code = 'T-TMT1' and description is null;
update menu_items set description = 'Masala chai is Indian spiced tea, built here on ginger and cardamom — cardamom has long been used in Ayurvedic medicine to aid digestion, and together with ginger''s warming bite it makes for a properly fragrant, spiced cup.' where code = 'T-MST0' and description is null;
update menu_items set description = 'Masala chai is Indian spiced tea, built here on ginger and cardamom — cardamom has long been used in Ayurvedic medicine to aid digestion, and together with ginger''s warming bite it makes a spiced, fragrant tea that also works surprisingly well cold.' where code = 'T-MST1' and description is null;
update menu_items set description = 'Butterfly Pea Tea has antioxidants and helps in digestion, so it can be recommended after meals — and while it''s naturally a striking blue drink, adding lemon turns it purple (a fun bit of chemistry, not a flaw). Served hot, it''s calming and caffeine-free.' where code = 'T-BPT0' and description is null;
update menu_items set description = 'Butterfly Pea Tea has antioxidants and helps in digestion, so it can be recommended after meals — and while it''s naturally a striking blue drink, adding lemon turns it purple (a fun bit of chemistry, not a flaw). Iced, the color shift makes for a great photo before your first sip.' where code = 'T-BPT1' and description is null;
update menu_items set description = 'No milk, no sugar, just coffee — black coffee is virtually calorie-free and delivers caffeine and antioxidants straight, with nothing to soften its natural bitterness. For purists.' where code = 'C-BLC0' and description is null;
update menu_items set description = 'No milk, no sugar, just coffee — black coffee is virtually calorie-free and delivers caffeine and antioxidants straight, with nothing to soften its natural bitterness. Served cold for a sharper, faster kick.' where code = 'C-BLC1' and description is null;
update menu_items set description = 'Equal parts espresso, steamed milk, and airy microfoam — the classic Italian ratio that makes a cappuccino taste stronger than a latte despite using less coffee. Hot, with that signature foam cap.' where code = 'C-CPN0' and description is null;
update menu_items set description = 'Equal parts espresso, steamed milk, and airy microfoam — the classic Italian ratio that makes a cappuccino taste stronger than a latte despite using less coffee. Shaken over ice for a lighter, frothier cold version.' where code = 'C-CPN1' and description is null;
update menu_items set description = 'Espresso and steamed milk rounded out with hazelnut syrup, a nutty sweetness that''s been a European café favorite for decades. A dessert-adjacent coffee without being cloying.' where code = 'C-HZL0' and description is null;
update menu_items set description = 'Espresso and steamed milk rounded out with hazelnut syrup, a nutty sweetness that''s been a European café favorite for decades. Served iced for an easy-drinking, dessert-adjacent coffee.' where code = 'C-HZL1' and description is null;
update menu_items set description = 'Espresso meets steamed milk and real chocolate, splitting the difference between a coffee and a hot cocoa. Cocoa itself is rich in flavanols linked to heart and blood-flow benefits, so this one''s a treat with a little upside.' where code = 'C-MCH0' and description is null;
update menu_items set description = 'Espresso meets steamed milk and real chocolate, splitting the difference between a coffee and a hot cocoa. Served cold, it drinks like a lighter, coffee-forward milkshake.' where code = 'C-MCH1' and description is null;
update menu_items set description = 'Warm, milky cocoa made from real chocolate — cocoa is naturally rich in flavanols, plant compounds studied for their benefits to heart and blood-flow health. A caffeine-free comfort drink for anyone skipping the coffee.' where code = 'C-CCA0' and description is null;
update menu_items set description = 'Cold, milky cocoa made from real chocolate — cocoa is naturally rich in flavanols, plant compounds studied for their benefits to heart and blood-flow health. A caffeine-free, chocolatey way to cool down.' where code = 'C-CCA1' and description is null;
update menu_items set description = 'Black tea brewed strong, sweetened, and poured over ice with fresh lemon — tea and citrus together bring a dose of antioxidants along with a clean, thirst-quenching tartness. A café classic for a reason.' where code = 'I-LIT' and description is null;
update menu_items set description = 'Iced tea infused with passionfruit, whose intensely tart, tropical pulp balances the tea''s natural tannins for a fragrant, fruit-forward glass. Bright, tangy, and distinctly tropical.' where code = 'I-PIT' and description is null;
update menu_items set description = 'Sweet strawberry and tart lemon meet over soda for a fruity, fizzy cooler that''s more tang than sugar. Bright pink and built for hot afternoons.' where code = 'SO-SLS' and description is null;
update menu_items set description = 'Mango''s tropical sweetness and passionfruit''s sharp tartness balance each other out over soda water — two fruits that are natural opposites making a genuinely refreshing pair.' where code = 'SO-MPS' and description is null;
update menu_items set description = 'Strawberry, blueberry, and raspberry-style flavors blended into one soda for a berry-forward drink that''s tart, sweet, and a deep, vivid color. Simple fruit soda, done right.' where code = 'SO-MBS' and description is null;
update menu_items set description = 'Lychee''s floral, delicate sweetness meets lemon''s sharp acidity over soda — an unusual but classic Southeast Asian pairing that keeps the drink from ever tasting one-note.' where code = 'SO-LLS' and description is null;
update menu_items set description = 'Named for its ocean-blue color, this soda gets its hue from blue curaçao syrup — despite the name, it''s entirely non-alcoholic here, just the citrusy-sweet flavor and the striking color. A photogenic, easy-drinking soda.' where code = 'SO-BHS' and description is null;
update menu_items set description = 'Riding the "dirty soda" trend, this one mixes cola with a splash of lime juice and a pinch of pink salt — the salt rounds out the sweetness and the lime cuts through the fizz for a sharper, more complex Coke.' where code = 'SO-CRC' and description is null;

-- ---------------------------------------------------------------------------
-- Round 21: recipe fixes found on re-reading the Food/Drink SOP docs in
-- full (the owner asked for "minor updates" to be folded in alongside the
-- batch-prep/raw split). Same idempotent pattern as the Round 12 Zab Fries
-- cleanup -- seed.sql's `on conflict do nothing` inserts can only ADD a
-- link, never remove or change the quantity on an existing one, so every
-- removed or changed ingredient needs an explicit statement here. New links
-- (Zab Fries' Ketchup, the Gochujang Burger's Caramelised Onions, both
-- teas' Base Milk, both iced teas' Lemon Iced Tea Powder) come from
-- re-pasting seed.sql after this file, same as any other new recipe link.
-- ---------------------------------------------------------------------------

-- Zab Fries: the SOP's own ingredient table now lists Ketchup 30ml
-- alongside the seasoning/mayo (previously only in the method text, not
-- linked as a tracked ingredient at all).
insert into menu_item_ingredients (menu_item_code, ingredient_id, qty_per_order)
select 'SN-ZAF', id, 30 from ingredients where name = 'Ketchup'
on conflict (menu_item_code, ingredient_id) do nothing;

-- Double Trouble Burger: current SOP no longer lists Pickled Cucumber Slices.
delete from menu_item_ingredients
where menu_item_code = 'B-DTB'
  and ingredient_id in (select id from ingredients where name = 'Pickled Cucumber Slices');

-- Gochujang Chicken Burger: SOP swapped Pickled Cabbage/Coleslaw for
-- Caramelised Onions (2 tbsp, same as every other burger).
delete from menu_item_ingredients
where menu_item_code = 'B-GCB'
  and ingredient_id in (select id from ingredients where name = 'Pickled Cabbage / Coleslaw');

-- Masala Tea (hot & cold): SOP switched the milk from Full-Fat Milk to the
-- Base Milk primary, 75ml either way.
delete from menu_item_ingredients
where menu_item_code in ('T-MST0', 'T-MST1')
  and ingredient_id in (select id from ingredients where name = 'Full-Fat Milk');

-- Thai Milk Tea Hot: same milk swap, Full-Fat Milk -> Base Milk (40ml).
delete from menu_item_ingredients
where menu_item_code = 'T-TMT0'
  and ingredient_id in (select id from ingredients where name = 'Full-Fat Milk');

-- Thai Milk Tea Cold (layered): SOP now uses Base Milk instead of
-- Evaporated Milk (30ml).
delete from menu_item_ingredients
where menu_item_code = 'T-TMT1'
  and ingredient_id in (select id from ingredients where name = 'Evaporated Milk');

-- Lemon/Passionfruit Iced Tea: SOP replaced the Black Tea Concentrate base
-- entirely with a dedicated Lemon Iced Tea Powder mix.
delete from menu_item_ingredients
where menu_item_code in ('I-LIT', 'I-PIT')
  and ingredient_id in (select id from ingredients where name = 'Black Tea Concentrate');

-- Hazelnut Latte Hot: the SOP's base table gives 30ml Coffee Concentrate for
-- hot (60ml is iced-only) -- this changes an existing link's quantity,
-- which a plain on-conflict-do-nothing insert can never do.
update menu_item_ingredients
set qty_per_order = 30
where menu_item_code = 'C-HZL0'
  and ingredient_id in (select id from ingredients where name = 'Coffee Concentrate');

-- Lemon Iced Tea: lemon juice and sugar syrup quantities both changed.
update menu_item_ingredients
set qty_per_order = 5
where menu_item_code = 'I-LIT'
  and ingredient_id in (select id from ingredients where name = 'Fresh Lemon Juice');
update menu_item_ingredients
set qty_per_order = 10
where menu_item_code = 'I-LIT'
  and ingredient_id in (select id from ingredients where name = 'Sugar Syrup');

-- Passionfruit Iced Tea: syrup quantity changed (1 tbsp mixed in + 1 tbsp
-- garnish on top = 2 tbsp / 30ml total, both drawn from stock).
update menu_item_ingredients
set qty_per_order = 30
where menu_item_code = 'I-PIT'
  and ingredient_id in (select id from ingredients where name = 'Passionfruit Syrup');

-- ---------------------------------------------------------------------------
-- Round 22: dine-in vs takeaway, per cart item, with automatic packaging
-- deduction; a third "Consumables" ingredient kind for straws/boxes/cups
-- (see ingredients_kind_check above, widened in place rather than here);
-- an explicit food/hot-drink/cold-drink classification per menu item (not
-- inferred purely from category, so it stays correct for future items too);
-- and a typable display-only unit label on each recipe link (never used for
-- stock math -- deduction always uses the ingredient's own real `unit`).
-- ---------------------------------------------------------------------------

-- Explicit packaging classification per menu item. Nullable while backfilling
-- so this can run against an empty menu_items table on a fresh install (seed.sql
-- runs after this file and supplies packaging_type on every insert); made
-- NOT NULL below once every existing row has a value.
alter table menu_items
  add column if not exists packaging_type text;

-- Backfill (Round 22): classify all 47 existing items. Food categories are
-- food; Iced Tea and Soda are always served cold; Tea and Coffee split by
-- the hot(0)/cold(1) code-suffix convention already used throughout this
-- schema. Only touches rows still null, so re-running this never clobbers a
-- reclassification an owner has since made from /admin/menu.
update menu_items set packaging_type = 'food'
where category in ('Snacks', 'Momo', 'Sandwich', 'Burger', 'Spaghetti') and packaging_type is null;
update menu_items set packaging_type = 'cold_drink'
where category in ('Iced Tea', 'Soda') and packaging_type is null;
update menu_items set packaging_type = 'hot_drink'
where category in ('Tea', 'Coffee') and code like '%0' and packaging_type is null;
update menu_items set packaging_type = 'cold_drink'
where category in ('Tea', 'Coffee') and code like '%1' and packaging_type is null;

alter table menu_items alter column packaging_type set not null;
alter table menu_items drop constraint if exists menu_items_packaging_type_check;
alter table menu_items add constraint menu_items_packaging_type_check
  check (packaging_type in ('food', 'hot_drink', 'cold_drink'));

-- Typable display-only unit override on each recipe link (e.g. show "1 box"
-- instead of a raw stock unit). Purely cosmetic: place_order/fulfill_pre_order
-- always deduct using the ingredient's real `unit`/qty_per_order, never this.
alter table menu_item_ingredients
  add column if not exists unit_label text;

-- Per-item (not per-order) dine-in/takeaway, defaulting existing and
-- unspecified rows to dine_in so nothing already in the database or in
-- flight breaks.
alter table order_items
  add column if not exists fulfillment_type text not null default 'dine_in';
alter table order_items drop constraint if exists order_items_fulfillment_type_check;
alter table order_items add constraint order_items_fulfillment_type_check
  check (fulfillment_type in ('dine_in', 'takeaway'));

-- ---------------------------------------------------------------------------
-- Round 23: Caramelised Onions and Lemon Iced Tea Powder were tracked
-- directly in tbsp (no owner-approved g conversion existed yet at the time).
-- The owner has since given an explicit rule (1 tbsp = 15g), so both convert
-- to g like every other dry/liquid ingredient -- unit_label='tbsp' on each
-- existing recipe link keeps the on-screen display unchanged even though the
-- real deduction unit changed. Guarded by `unit = 'tbsp'` / `unit_label is
-- null` so re-running this file never re-multiplies an already-converted row.
-- ---------------------------------------------------------------------------
update ingredients
set unit = 'g', current_stock = current_stock * 15, low_stock_threshold = low_stock_threshold * 15
where name in ('Caramelised Onions', 'Lemon Iced Tea Powder') and unit = 'tbsp';

update menu_item_ingredients mii
set qty_per_order = mii.qty_per_order * 15, unit_label = 'tbsp'
from ingredients i
where mii.ingredient_id = i.id
  and i.name in ('Caramelised Onions', 'Lemon Iced Tea Powder')
  and mii.unit_label is null;

-- ---------------------------------------------------------------------------
-- Round 23: nested bill-of-materials. Until now a batch-prep primary's own
-- raw sub-ingredients were deliberately untracked (making a fresh batch of
-- White Sauce didn't touch Butter/flour/milk stock at all) -- the owner has
-- reversed that decision and wants full nested deduction: prepping a batch
-- of a primary should check and deduct its real raw ingredients, the same
-- atomic check-then-deduct pattern place_order() already uses.
--
-- primary_ingredients: one row per (primary, raw ingredient) it's made from,
-- with qty_per_unit = how much of that raw ingredient one single unit of the
-- primary's own stock (1ml of White Sauce, 1g of Chicken Keema, 1pcs of
-- Potato Patty, etc.) requires. See scripts/gen_seed.py's PRIMARY_RECIPES
-- for where these ratios come from (each SOP's stated recipe amount divided
-- by its stated reference batch size). A primary can itself be listed as
-- another primary's raw_ingredient_id (e.g. Chocolate Syrup is made from
-- Base Milk) -- both columns reference the same ingredients table, no kind
-- restriction, so this is allowed by design.
-- ---------------------------------------------------------------------------
create table if not exists primary_ingredients (
  primary_id uuid not null references ingredients(id) on delete cascade,
  raw_ingredient_id uuid not null references ingredients(id) on delete restrict,
  qty_per_unit numeric not null check (qty_per_unit > 0),
  primary key (primary_id, raw_ingredient_id),
  check (primary_id <> raw_ingredient_id)
);

create index if not exists primary_ingredients_raw_ingredient_id_idx on primary_ingredients(raw_ingredient_id);

alter table primary_ingredients enable row level security;

-- prep_batch: staff record "I just made p_batch_qty units of this primary"
-- (e.g. 1000ml of White Sauce). Atomically checks every linked raw
-- ingredient has enough stock (same temp-table + row-lock pattern as
-- place_order/fulfill_pre_order, so two staff prepping batches at once can't
-- oversell a shared raw ingredient), deducts each one, and credits the
-- primary's own current_stock by p_batch_qty -- logging every one of those
-- deltas to stock_adjustments so the prep shows up in the normal restock
-- history, not just as an unexplained stock jump. A primary with no
-- recipe rows yet (nothing in primary_ingredients for it) simply deducts
-- nothing and only credits the primary -- same graceful-no-op design as
-- Round 22's packaging lookups, so this is safe to call even before every
-- primary has a recipe (e.g. Caramelised Onions, which has none).
create or replace function prep_batch(p_primary_id uuid, p_batch_qty numeric)
returns jsonb
language plpgsql
as $$
declare
  v_primary_name text;
  v_primary_stock numeric;
  v_new_primary_stock numeric;
  v_out_of_stock text[];
begin
  if p_batch_qty is null or p_batch_qty <= 0 then
    raise exception 'invalid_batch_qty' using errcode = 'P0001';
  end if;

  select name, current_stock into v_primary_name, v_primary_stock
  from ingredients where id = p_primary_id
  for update;

  if v_primary_name is null then
    raise exception 'unknown_primary' using errcode = 'P0001';
  end if;

  create temporary table _required (
    ingredient_id uuid primary key,
    needed numeric not null
  ) on commit drop;

  insert into _required (ingredient_id, needed)
  select pi.raw_ingredient_id, pi.qty_per_unit * p_batch_qty
  from primary_ingredients pi
  where pi.primary_id = p_primary_id;

  -- Lock every involved raw ingredient row (stable order avoids deadlocks
  -- against a concurrent order or another prep_batch call), then check each
  -- has enough stock before deducting any of them.
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

  insert into stock_adjustments (ingredient_id, delta, resulting_stock)
  select r.ingredient_id, -r.needed, i.current_stock
  from _required r
  join ingredients i on i.id = r.ingredient_id;

  v_new_primary_stock := v_primary_stock + p_batch_qty;
  update ingredients set current_stock = v_new_primary_stock where id = p_primary_id;

  insert into stock_adjustments (ingredient_id, delta, resulting_stock)
  values (p_primary_id, p_batch_qty, v_new_primary_stock);

  return jsonb_build_object(
    'primary_id', p_primary_id,
    'primary_name', v_primary_name,
    'batch_qty', p_batch_qty,
    'new_stock', v_new_primary_stock
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Round 24: costing-table-based profit estimate. The Round 21 profit figure
-- averaged real restock prices per ingredient, which undercounted the moment
-- an ingredient had never had a priced restock recorded, and couldn't reach
-- historical_sales at all (no restock history predates the app going live).
-- This switches the Profit (est.) card on /admin/analytics to the owner's
-- own Tan90 Costing Table instead -- one known cost per menu item, straight
-- from the PDF's "Total ฿" column, with no restock-history dependency.
-- ---------------------------------------------------------------------------

-- Cost of goods, in Baht, to produce ONE unit of this menu item, taken
-- verbatim from the Tan90 Costing Table PDF's "Total ฿" column. Nullable: an
-- item the costing table didn't cover has no entry here, and the profit
-- computation below excludes it from both revenueCounted and costCounted
-- rather than guessing at zero -- same exclusion contract the Round 21
-- estimate used, just keyed off this column instead of restock prices now.
alter table menu_items
  add column if not exists cogs_thb numeric;

alter table menu_items drop constraint if exists menu_items_cogs_thb_check;
alter table menu_items add constraint menu_items_cogs_thb_check check (cogs_thb is null or cogs_thb >= 0);

-- Seed from the Tan90 Costing Table PDF. 44 of the 47 current items were
-- costed there; Spaghetti Alfredo (Mushroom), Spaghetti Alfredo (Chicken),
-- and Crispy Coke were added to the menu after the table was drawn up and
-- stay null (excluded from profit) until the owner supplies a cost for
-- them. Unconditional updates, not "where cogs_thb is null" -- there's no
-- admin UI to edit this column, so nothing else ever writes to it, and a
-- corrected PDF transcription should always win on the next schema.sql run.
update menu_items set cogs_thb = 9.26 where code = 'SN-FRF';
update menu_items set cogs_thb = 11.21 where code = 'SN-PPF';
update menu_items set cogs_thb = 10.7 where code = 'SN-ZAF';
update menu_items set cogs_thb = 16.36 where code = 'SN-SMT';
update menu_items set cogs_thb = 22.6 where code = 'SN-MGN';
update menu_items set cogs_thb = 26.99 where code = 'SN-ECM';
update menu_items set cogs_thb = 51.64 where code = 'SN-CLN';
update menu_items set cogs_thb = 18.86 where code = 'M-VMM';
update menu_items set cogs_thb = 25.35 where code = 'M-CMM';
update menu_items set cogs_thb = 44.12 where code = 'SD-MUS';
update menu_items set cogs_thb = 22.08 where code = 'SD-GCS';
update menu_items set cogs_thb = 31.94 where code = 'SD-CHS';
update menu_items set cogs_thb = 32.11 where code = 'B-CVB';
update menu_items set cogs_thb = 30.12 where code = 'B-CCB';
update menu_items set cogs_thb = 44.86 where code = 'B-DTB';
update menu_items set cogs_thb = 29.04 where code = 'B-GCB';
update menu_items set cogs_thb = 34.38 where code = 'B-SCB';
update menu_items set cogs_thb = 17.31 where code = 'T-GLT0';
update menu_items set cogs_thb = 17.62 where code = 'T-GLT1';
update menu_items set cogs_thb = 5.85 where code = 'T-BLT0';
update menu_items set cogs_thb = 8.27 where code = 'T-BLT1';
update menu_items set cogs_thb = 11.43 where code = 'T-TMT0';
update menu_items set cogs_thb = 12.69 where code = 'T-TMT1';
update menu_items set cogs_thb = 14.45 where code = 'T-MST0';
update menu_items set cogs_thb = 18.11 where code = 'T-MST1';
update menu_items set cogs_thb = 8.04 where code = 'T-BPT0';
update menu_items set cogs_thb = 8.34 where code = 'T-BPT1';
update menu_items set cogs_thb = 8.81 where code = 'C-BLC0';
update menu_items set cogs_thb = 14.59 where code = 'C-BLC1';
update menu_items set cogs_thb = 8.56 where code = 'C-CPN0';
update menu_items set cogs_thb = 11.91 where code = 'C-CPN1';
update menu_items set cogs_thb = 17.03 where code = 'C-HZL0';
update menu_items set cogs_thb = 18.85 where code = 'C-HZL1';
update menu_items set cogs_thb = 12.48 where code = 'C-MCH0';
update menu_items set cogs_thb = 17.01 where code = 'C-MCH1';
update menu_items set cogs_thb = 11.61 where code = 'C-CCA0';
update menu_items set cogs_thb = 17.0 where code = 'C-CCA1';
update menu_items set cogs_thb = 8.96 where code = 'I-LIT';
update menu_items set cogs_thb = 12.16 where code = 'I-PIT';
update menu_items set cogs_thb = 25.84 where code = 'SO-SLS';
update menu_items set cogs_thb = 17.07 where code = 'SO-MPS';
update menu_items set cogs_thb = 20.8 where code = 'SO-MBS';
update menu_items set cogs_thb = 25.72 where code = 'SO-LLS';
update menu_items set cogs_thb = 18.9 where code = 'SO-BHS';

-- ---------------------------------------------------------------------------
-- Round 25: a free-text yield note, alongside (not replacing) the existing
-- numeric yield_servings column -- lets staff describe what one order
-- actually yields in the kitchen's own terms ("1 plate", "150 ml", "2
-- skewers") rather than only a bare serving count. Optional, purely
-- informational, same as yield_servings.
-- ---------------------------------------------------------------------------
alter table menu_items
  add column if not exists yield_note text;

-- ---------------------------------------------------------------------------
-- Round 26: coupon batches need a payment status and a collection status
-- independent of each other, and sold_at needs to be editable after the
-- fact -- a batch is often entered on the site days after the real sale,
-- sold before it's paid for, or paid for before the physical coupons are
-- picked up. Both default false: existing batches are NOT assumed paid or
-- collected just because this column now exists -- the owner reviews and
-- marks each one explicitly. sold_at itself needed no schema change (it
-- was already a plain editable column); only the app layer was missing an
-- edit path for it.
-- ---------------------------------------------------------------------------
alter table coupon_batches
  add column if not exists paid boolean not null default false,
  add column if not exists collected boolean not null default false;

-- ---------------------------------------------------------------------------
-- Round 28: sync recipes to the revised Food & Drinks SOPs. seed.sql's own
-- on-conflict-do-nothing inserts handle every brand-new recipe link this
-- round added on their own (the sandwiches' new Ketchup lines, and the
-- Gochujang Chicken Burger's new Homemade Mayo side-dip, added 9/24 once
-- the owner fixed that SOP's mayo contradiction) -- this block only needs
-- to handle removals and requantifications of links that already existed,
-- which a plain seed.sql re-paste can never do on its own.
-- ---------------------------------------------------------------------------

-- French Fries: table says Mayo 30ml only, no Ketchup (was following the
-- method text's Ketchup 30ml + Mayo 15ml).
delete from menu_item_ingredients where menu_item_code = 'SN-FRF' and ingredient_id in (select id from ingredients where name = 'Ketchup');
update menu_item_ingredients set qty_per_order = 30 where menu_item_code = 'SN-FRF' and ingredient_id in (select id from ingredients where name = 'Homemade Mayo');

-- Peri-Peri Fries: table says Mayo 30ml (was following the method text's 20ml).
update menu_item_ingredients set qty_per_order = 30 where menu_item_code = 'SN-PPF' and ingredient_id in (select id from ingredients where name = 'Homemade Mayo');

-- Zab Fries: table no longer lists Ketchup at all; both dry seasonings raised.
delete from menu_item_ingredients where menu_item_code = 'SN-ZAF' and ingredient_id in (select id from ingredients where name = 'Ketchup');
update menu_item_ingredients set qty_per_order = 7.5 where menu_item_code = 'SN-ZAF' and ingredient_id in (select id from ingredients where name = 'Zab Seasoning');
update menu_item_ingredients set qty_per_order = 5 where menu_item_code = 'SN-ZAF' and ingredient_id in (select id from ingredients where name = 'Lime Seasoning');

-- Maggie Noodles + Extra Cheesy Maggie: Frozen Corn/Frozen Peas 10g -> 15g.
update menu_item_ingredients set qty_per_order = 15 where menu_item_code in ('SN-MGN','SN-ECM') and ingredient_id in (select id from ingredients where name in ('Frozen Corn','Frozen Peas'));

-- Chicken/Veg Momo: achar (Tomato Sauce) 35ml -> 30ml.
update menu_item_ingredients set qty_per_order = 30 where menu_item_code in ('M-VMM','M-CMM') and ingredient_id in (select id from ingredients where name = 'Tomato Sauce');

-- All 5 burgers: Tomato Slices dropped (consistently absent from every
-- burger's revised table); each burger's side-dip Homemade Mayo raised to
-- include the 30ml (45ml for Double Trouble) "served with" line that was
-- never auto-deducted before.
delete from menu_item_ingredients where menu_item_code in ('B-CVB','B-CCB','B-DTB','B-SCB') and ingredient_id in (select id from ingredients where name = 'Tomato Slices');
update menu_item_ingredients set qty_per_order = 40 where menu_item_code in ('B-CVB','B-CCB','B-SCB') and ingredient_id in (select id from ingredients where name = 'Homemade Mayo');
update menu_item_ingredients set qty_per_order = 45 where menu_item_code = 'B-DTB' and ingredient_id in (select id from ingredients where name = 'Homemade Mayo');

-- Ginger Lemon Tea (Hot+Cold) + Black Tea Hot: tea leaves 3g -> 5g.
update menu_item_ingredients set qty_per_order = 5 where menu_item_code in ('T-GLT0','T-GLT1','T-BLT0') and ingredient_id in (select id from ingredients where name = 'Black Tea Leaves');

-- Thai Milk Tea (Hot+Cold): Thai Tea Powder 18g -> 10g, Base Milk -> 100ml.
update menu_item_ingredients set qty_per_order = 10 where menu_item_code in ('T-TMT0','T-TMT1') and ingredient_id in (select id from ingredients where name = 'Thai Tea Powder');
update menu_item_ingredients set qty_per_order = 100 where menu_item_code in ('T-TMT0','T-TMT1') and ingredient_id in (select id from ingredients where name = 'Base Milk');

-- Masala Tea Hot: tea leaves 4.5g -> 7.5g, masala powder 1.5g -> 2.5g.
update menu_item_ingredients set qty_per_order = 7.5 where menu_item_code = 'T-MST0' and ingredient_id in (select id from ingredients where name = 'Red Label Tea Leaves');
update menu_item_ingredients set qty_per_order = 2.5 where menu_item_code = 'T-MST0' and ingredient_id in (select id from ingredients where name = 'Red Label Masala Powder');
-- Masala Tea Cold: tea leaves 6g -> 10g, masala powder 3g -> 5g.
update menu_item_ingredients set qty_per_order = 10 where menu_item_code = 'T-MST1' and ingredient_id in (select id from ingredients where name = 'Red Label Tea Leaves');
update menu_item_ingredients set qty_per_order = 5 where menu_item_code = 'T-MST1' and ingredient_id in (select id from ingredients where name = 'Red Label Masala Powder');

-- Black Coffee Hot: was wrongly deducting Ground Coffee 20g (an ingredient
-- this SOP never mentions); the table's real ingredient is Instant Coffee
-- 8g, added via seed.sql's own on-conflict-do-nothing insert.
delete from menu_item_ingredients where menu_item_code = 'C-BLC0' and ingredient_id in (select id from ingredients where name = 'Ground Coffee');

-- Hazelnut Latte (Hot+Cold): milk switched from Full-Fat Milk to Base Milk
-- (150ml, added via seed.sql); Hot's Coffee Concentrate raised to 45ml.
delete from menu_item_ingredients where menu_item_code in ('C-HZL0','C-HZL1') and ingredient_id in (select id from ingredients where name = 'Full-Fat Milk');
update menu_item_ingredients set qty_per_order = 45 where menu_item_code = 'C-HZL0' and ingredient_id in (select id from ingredients where name = 'Coffee Concentrate');

-- Fresh Lemon Juice -> Fresh Lime Juice on 11 drinks (owner confirmed:
-- genuinely different stocked bottles, not the same product renamed).
-- Fresh Lime Juice is added at the same quantity via seed.sql's own
-- on-conflict-do-nothing insert; this only needs to remove the old link.
delete from menu_item_ingredients where menu_item_code in ('T-GLT0','T-GLT1','T-BPT0','T-BPT1','I-LIT','I-PIT','SO-SLS','SO-MPS','SO-MBS','SO-LLS','SO-BHS') and ingredient_id in (select id from ingredients where name = 'Fresh Lemon Juice');

-- Crispy Coke: Pink Salt 0.75g -> 1.25g (1/4 tsp per the 5g/tsp rule).
update menu_item_ingredients set qty_per_order = 1.25 where menu_item_code = 'SO-CRC' and ingredient_id in (select id from ingredients where name = 'Pink Salt');

-- Potato Patty: revised SOP's table/method no longer includes Fresh Lemon
-- Juice at all (owner confirmed: trust the revised SOP).
delete from primary_ingredients where primary_id in (select id from ingredients where name = 'Potato Patty') and raw_ingredient_id in (select id from ingredients where name = 'Fresh Lemon Juice');

-- Veg Keema: revised SOP has a genuinely blank row exactly where Cauliflower
-- used to be (confirmed via direct PDF image inspection).
delete from primary_ingredients where primary_id in (select id from ingredients where name = 'Veg Keema') and raw_ingredient_id in (select id from ingredients where name = 'Cauliflower');

-- ---------------------------------------------------------------------------
-- Round 28 follow-up (9/24): owner-confirmed corrections after the SOP sync
-- above. "Ginger Paste" and "Garlic Paste" (used separately in Veg Keema)
-- turned out to be the same physical product as "Ginger-Garlic Paste"
-- (used in Chicken Keema), not distinct SKUs -- consolidated onto a single
-- 10g Ginger-Garlic Paste line (the new link is added by seed.sql's own
-- on-conflict-do-nothing insert; this only needs to remove the old two).
-- ---------------------------------------------------------------------------
delete from primary_ingredients where primary_id in (select id from ingredients where name = 'Veg Keema') and raw_ingredient_id in (select id from ingredients where name in ('Ginger Paste','Garlic Paste'));

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
grant execute on function rename_menu_item_code(text, text) to service_role;
grant execute on function prep_batch(uuid, numeric) to service_role;
