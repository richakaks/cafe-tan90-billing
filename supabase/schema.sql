-- Cafe Tan90 — Ordering, Billing & Inventory
-- Run this once in the Supabase SQL editor (or via `supabase db push`) on a fresh project.
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
  created_at timestamptz not null default now()
);

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
