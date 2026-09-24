-- ---------------------------------------------------------------------------
-- Inventory restock -- Sep 14, 2026
--
-- Sourced from: a Makro receipt dated 11-09-2026 (photos), plus the owner's
-- own follow-up counts for items not clearly legible on the receipt or from
-- separate purchases. Every line below was confirmed item-by-item with the
-- owner before this script was written -- see the conversation for the
-- reasoning behind each match (unit conversions, which ingredient a vague
-- receipt line maps to, etc).
--
-- Personal items circled on the receipt (~฿376.75 worth) and non-food
-- purchases (cleaning supplies, garbage bags, chopsticks) are deliberately
-- left out of this script.
--
-- IMPORTANT: this is a one-time data entry, same as manually clicking
-- "+Restock" in /admin/inventory several times -- unlike schema.sql, it is
-- NOT idempotent. Run it exactly once. (The one exception is the new
-- ingredient's create statement, which uses on conflict do nothing and is
-- safe on a re-run; the stock/log inserts below it are not.)
-- ---------------------------------------------------------------------------

-- New ingredient: Chicken Spring Rolls (not previously tracked). Added at
-- the owner's request to log this purchase; not yet linked to any menu item
-- recipe since spring rolls aren't on the current menu.
insert into ingredients (name, unit, current_stock, low_stock_threshold, kind)
values ('Chicken Spring Rolls', 'pcs', 0, 15, 'raw')
on conflict (name) do nothing;

-- Onion +3,000 g (Makro: onion 1kg x3, ฿135)
update ingredients set current_stock = current_stock + 3000 where name = 'Onion';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 3000, current_stock, 135 from ingredients where name = 'Onion';

-- Fresh Ginger +1,000 g (Makro: mature ginger 1kg, ฿65)
update ingredients set current_stock = current_stock + 1000 where name = 'Fresh Ginger';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 1000, current_stock, 65 from ingredients where name = 'Fresh Ginger';

-- Sugar +2,400 g (Makro: ARO sugar 400g x6, ฿168)
update ingredients set current_stock = current_stock + 2400 where name = 'Sugar';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 2400, current_stock, 168 from ingredients where name = 'Sugar';

-- Frying Oil +5 L (Makro: Naturel soybean oil 5L, ฿415) -- NOTE: this
-- ingredient is tracked in whole liters, not ml
update ingredients set current_stock = current_stock + 5 where name = 'Frying Oil';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 5, current_stock, 415 from ingredients where name = 'Frying Oil';

-- Frying Oil +5 L more (canola oil, separate purchase, price not given)
update ingredients set current_stock = current_stock + 5 where name = 'Frying Oil';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 5, current_stock, null from ingredients where name = 'Frying Oil';

-- Iceberg Lettuce +300 g (Makro: organic crystal lettuce 300g pack, ฿65)
update ingredients set current_stock = current_stock + 300 where name = 'Iceberg Lettuce';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 300, current_stock, 65 from ingredients where name = 'Iceberg Lettuce';

-- Frozen Fries +4,000 g (Makro: Zenpak fries 12mm, 2kg x2, ฿178)
update ingredients set current_stock = current_stock + 4000 where name = 'Frozen Fries';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 4000, current_stock, 178 from ingredients where name = 'Frozen Fries';

-- Tomatoes +2,000 g (Makro: Sida tomato 2kg pack, ฿79)
update ingredients set current_stock = current_stock + 2000 where name = 'Tomatoes';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 2000, current_stock, 79 from ingredients where name = 'Tomatoes';

-- Fresh Coriander +300 g (Makro: spring onion + coriander combo pack, whole
-- 300g counted toward coriander since spring onion is tracked separately
-- and this was a mixed pack -- flagged to the owner as an approximation)
update ingredients set current_stock = current_stock + 300 where name = 'Fresh Coriander';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 300, current_stock, 55 from ingredients where name = 'Fresh Coriander';

-- Store-Bought Mayo +1,000 ml (Makro: "Every" mayonnaise 1kg, ฿85; kg->ml
-- at 1:1, a reasonable approximation for mayo's density)
update ingredients set current_stock = current_stock + 1000 where name = 'Store-Bought Mayo';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 1000, current_stock, 85 from ingredients where name = 'Store-Bought Mayo';

-- Ketchup +1,000 ml (Makro: ARO ketchup sachets 10g x100, ฿63; g->ml 1:1)
update ingredients set current_stock = current_stock + 1000 where name = 'Ketchup';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 1000, current_stock, 63 from ingredients where name = 'Ketchup';

-- Cold Takeaway Glass +100 pcs (Makro: ARO 12oz cups, 50x2, ฿118)
update ingredients set current_stock = current_stock + 100 where name = 'Cold Takeaway Glass';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 100, current_stock, 118 from ingredients where name = 'Cold Takeaway Glass';

-- Hot Takeaway Glass +50 pcs (coffee cups, separate purchase, price not given)
update ingredients set current_stock = current_stock + 50 where name = 'Hot Takeaway Glass';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 50, current_stock, null from ingredients where name = 'Hot Takeaway Glass';

-- Straw +500 pcs (Makro: ARO straws, 250x2, ฿65)
update ingredients set current_stock = current_stock + 500 where name = 'Straw';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 500, current_stock, 65 from ingredients where name = 'Straw';

-- Takeaway Food Box +50 pcs (Makro: 600ml single-compartment box, ฿115)
update ingredients set current_stock = current_stock + 50 where name = 'Takeaway Food Box';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 50, current_stock, 115 from ingredients where name = 'Takeaway Food Box';

-- Takeaway Food Box +50 pcs (Makro: 2-compartment 1000ml box, ฿249)
update ingredients set current_stock = current_stock + 50 where name = 'Takeaway Food Box';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 50, current_stock, 249 from ingredients where name = 'Takeaway Food Box';

-- Takeaway Food Box +75 pcs (Makro: ARO 3-compartment tray with lid, ฿717)
update ingredients set current_stock = current_stock + 75 where name = 'Takeaway Food Box';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 75, current_stock, 717 from ingredients where name = 'Takeaway Food Box';

-- Raw Chicken Mince (Momo Grade) +2,994 g (Makro: ground chicken breast,
-- two weigh-ins 1.438kg + 1.556kg, ฿128.00 + ฿138.50 = ฿266.50; owner
-- confirmed this is chicken mince for Chicken Keema)
update ingredients set current_stock = current_stock + 2994 where name = 'Raw Chicken Mince (Momo Grade)';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 2994, current_stock, 266.50 from ingredients where name = 'Raw Chicken Mince (Momo Grade)';

-- Frozen Samosas +70 pcs (Makro: cocktail samosa / curry puff box, ฿335;
-- owner confirmed this is the Frozen Samosas ingredient)
update ingredients set current_stock = current_stock + 70 where name = 'Frozen Samosas';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 70, current_stock, 335 from ingredients where name = 'Frozen Samosas';

-- Burger Bun +66 pcs (owner's own count: 11 packs of 6, price not given)
update ingredients set current_stock = current_stock + 66 where name = 'Burger Bun';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 66, current_stock, null from ingredients where name = 'Burger Bun';

-- Potato +2,000 g (owner's own count, price not given)
update ingredients set current_stock = current_stock + 2000 where name = 'Potato';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 2000, current_stock, null from ingredients where name = 'Potato';

-- Frozen Chicken Patty +60 pcs (owner's own count: 2,400g / 40g per patty,
-- price not given)
update ingredients set current_stock = current_stock + 60 where name = 'Frozen Chicken Patty';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 60, current_stock, null from ingredients where name = 'Frozen Chicken Patty';

-- Chicken Spring Rolls +54 pcs (owner's own count: 3,000g / 18 pcs per
-- packet x3 packets, price not given -- new ingredient created above)
update ingredients set current_stock = current_stock + 54 where name = 'Chicken Spring Rolls';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 54, current_stock, null from ingredients where name = 'Chicken Spring Rolls';
