-- ---------------------------------------------------------------------------
-- Round 31 (10/6) -- restore "Sautéed Mushrooms" as a tracked batch-prep
-- primary (owner: "keep sauteed mushroom as batch prep item"), reversing
-- Round 29's retirement. Re-creates the row if Round 30 deleted it (stock
-- starts at 0 -- its old stock was already merged into "Mushroom" in
-- Round 29, so nothing is double-counted; record a batch via "Prep a batch"
-- to credit it), points Mushroom Sandwich (SD-MUS, 70g) and Spaghetti
-- Alfredo (Mushroom) (SP-AWS0, 75g) back at it instead of raw Mushroom, and
-- restores its own sub-recipe (per 200g batch: Mushroom 300g, Garlic 3
-- cloves, Green Chilli 2, Butter 15g, Olive Oil 10ml, Salt 2.5g, Black
-- Pepper 1.25g). Idempotent.
-- ---------------------------------------------------------------------------
insert into ingredients (name, unit, current_stock, low_stock_threshold, kind)
values ('Sautéed Mushrooms', 'g', 0, 150, 'batch_prep')
on conflict (name) do nothing;
update ingredients set kind = 'batch_prep' where name = 'Sautéed Mushrooms';

delete from menu_item_ingredients
where menu_item_code in ('SD-MUS', 'SP-AWS0')
  and ingredient_id = (select id from ingredients where name = 'Mushroom');

insert into menu_item_ingredients (menu_item_code, ingredient_id, qty_per_order)
select v.code, i.id, v.qty
from (values ('SD-MUS', 70::numeric), ('SP-AWS0', 75::numeric)) as v(code, qty)
join ingredients i on i.name = 'Sautéed Mushrooms'
where exists (select 1 from menu_items m where m.code = v.code)
on conflict (menu_item_code, ingredient_id) do nothing;

-- qty_per_unit is per 1 g of Sautéed Mushrooms, i.e. the batch quantity
-- divided by the 200g batch yield (same convention as seed.sql).
insert into primary_ingredients (primary_id, raw_ingredient_id, qty_per_unit)
select p.id, r.id, v.qty / 200
from (values
  ('Mushroom', 300::numeric), ('Garlic', 3), ('Green Chilli', 2), ('Butter', 15),
  ('Olive Oil', 10), ('Salt', 2.5), ('Black Pepper', 1.25)
) as v(raw_name, qty)
join ingredients p on p.name = 'Sautéed Mushrooms'
join ingredients r on r.name = v.raw_name
on conflict (primary_id, raw_ingredient_id) do nothing;
