-- Placeholder starter data so the app works end-to-end before you load the
-- real Tan90 menu. Edit freely via /admin/menu and /admin/inventory once
-- the app is running, or just re-run parts of this file.

-- Seats: T1-T9 (tables) + S1-S4 (counter seats)
insert into seats (id, label, kind) values
  ('T1', 'Table 1', 'table'),
  ('T2', 'Table 2', 'table'),
  ('T3', 'Table 3', 'table'),
  ('T4', 'Table 4', 'table'),
  ('T5', 'Table 5', 'table'),
  ('T6', 'Table 6', 'table'),
  ('T7', 'Table 7', 'table'),
  ('T8', 'Table 8', 'table'),
  ('T9', 'Table 9', 'table'),
  ('S1', 'Counter Seat 1', 'counter'),
  ('S2', 'Counter Seat 2', 'counter'),
  ('S3', 'Counter Seat 3', 'counter'),
  ('S4', 'Counter Seat 4', 'counter')
on conflict (id) do nothing;

-- Ingredients (one is seeded intentionally low, to demo the "low in stock" badge)
insert into ingredients (name, unit, current_stock, low_stock_threshold) values
  ('Coffee Beans', 'g', 2000, 300),
  ('Milk', 'ml', 4000, 500),
  ('Tea Leaves', 'g', 500, 50),
  ('Sugar', 'g', 1000, 100),
  ('Croissant Dough', 'pcs', 4, 5),
  ('Bread', 'pcs', 30, 6),
  ('Ham', 'g', 1500, 200),
  ('Cheese Slice', 'pcs', 40, 8),
  ('Lettuce', 'g', 500, 50),
  ('Chocolate Cake Slice', 'pcs', 15, 3)
on conflict (name) do nothing;

-- Menu items
insert into menu_items (code, name, category, price, active) values
  ('CT001', 'Americano', 'Beverages', 70, true),
  ('CT002', 'Cappuccino', 'Beverages', 80, true),
  ('CT003', 'Thai Iced Tea', 'Beverages', 65, true),
  ('CT004', 'Croissant', 'Bakery', 60, true),
  ('CT005', 'Club Sandwich', 'Food', 120, true),
  ('CT006', 'Chocolate Cake', 'Bakery', 95, true)
on conflict (code) do nothing;

-- Menu item <-> ingredient mapping
insert into menu_item_ingredients (menu_item_code, ingredient_id, qty_per_order)
select 'CT001', id, 18 from ingredients where name = 'Coffee Beans'
union all
select 'CT002', id, 18 from ingredients where name = 'Coffee Beans'
union all
select 'CT002', id, 150 from ingredients where name = 'Milk'
union all
select 'CT003', id, 10 from ingredients where name = 'Tea Leaves'
union all
select 'CT003', id, 100 from ingredients where name = 'Milk'
union all
select 'CT003', id, 20 from ingredients where name = 'Sugar'
union all
select 'CT004', id, 1 from ingredients where name = 'Croissant Dough'
union all
select 'CT005', id, 2 from ingredients where name = 'Bread'
union all
select 'CT005', id, 60 from ingredients where name = 'Ham'
union all
select 'CT005', id, 2 from ingredients where name = 'Cheese Slice'
union all
select 'CT005', id, 20 from ingredients where name = 'Lettuce'
union all
select 'CT006', id, 1 from ingredients where name = 'Chocolate Cake Slice'
on conflict (menu_item_code, ingredient_id) do nothing;
