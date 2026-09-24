-- ---------------------------------------------------------------------------
-- Inventory restock -- Sep 17, 2026
--
-- Sourced from: a single Makro receipt dated 17-09-2026 (3 photos of the
-- same receipt, TXN 260540505209431, subtotal ฿2465.50, ฿8.00 promo
-- discount, total paid ฿2457.50 -- every line item below plus the two
-- excluded lines sums exactly to the receipt subtotal, confirming nothing
-- was missed).
--
-- Per the owner's own framing when sharing these bills: daily sales haven't
-- been logged since the previous (Sep 14) restock, so depletion since then
-- isn't reflected here -- a full physical inventory count is planned with
-- the owner before the QR-code ordering launch. This script only adds the
-- purchased quantities on top of whatever current_stock already holds.
--
-- Excluded from this script (flagged, not guessed):
--   - Magiclean floor cleaner, 5000ml, ฿175.00 -- non-food, same as cleaning
--     supplies excluded from the Sep 14 restock.
--   - ARO soft coffee-scent facial tissue, 220 sheets x4, ฿92.00 -- non-food
--     (napkins/tissue, not a tracked ingredient), same treatment.
--   - Green bird's-eye chilli, de-stemmed, 300g, ฿39.00 -- Green Chilli is
--     tracked by the piece, not weight, and the owner's answer ("track
--     according to SOP") doesn't supply an actual pieces-per-300g-bag count
--     for this receipt line (every SOP reference to Green Chilli is already
--     in whole pieces, e.g. "2 chillies" -- that confirms the unit, not the
--     conversion). Needs one more number from the owner before this ฿39.00
--     can be entered; left out entirely rather than guessed.
--
-- Unit-conversion judgment calls made on this script (each flagged inline):
--   - Momo Wrap: owner's own estimate (~80 pcs per 500g pack), not a
--     verified count.
--   - Garlic: 500g of peeled cloves converted at ~5g/clove, the same
--     approximation already used elsewhere in this project (see
--     PRIMARY_RECIPES's Tomato Sauce comment in gen_seed.py) -- not a new
--     guess, reapplying an existing owner-adjacent convention.
--   - "ARO ซอสมะเขือเทศ" (bottled tomato sauce, 5000g) credited to Ketchup,
--     not the "Tomato Sauce" primary -- Tomato Sauce is a house-made primary
--     (fresh tomatoes + ginger + garlic + turmeric, see prep_batch()), so a
--     bottled Makro purchase can only sensibly be bottled Ketchup.
--   - "บัตเตอร์เบลค์ชนิดจืดตราเอโร่" identified as ARO unsalted butter
--     block, 2kg -- credited to Butter.
--   - The Indian onion/shallot pack (1kg) credited to the generic "Onion"
--     ingredient -- receipt OCR on the exact variety name is unclear, but
--     it's unambiguously an onion-family bulb and there's no separate
--     tracked "Shallot" ingredient it could otherwise mean.
--
-- IMPORTANT: this is a one-time data entry, same as manually clicking
-- "+Restock" in /admin/inventory several times -- unlike schema.sql, it is
-- NOT idempotent. Run it exactly once.
-- ---------------------------------------------------------------------------

-- Button Mushrooms (Raw) +500 g (Makro: white champignon mushroom 500g, ฿119)
update ingredients set current_stock = current_stock + 500 where name = 'Button Mushrooms (Raw)';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 500, current_stock, 119.00 from ingredients where name = 'Button Mushrooms (Raw)';

-- Ketchup +5,000 ml (Makro: ARO bottled tomato sauce 5000g, ฿175; g->ml 1:1,
-- same approximation as the Sep 14 restock's Ketchup line -- this is bottled
-- product, not the house-made Tomato Sauce primary, see header note)
update ingredients set current_stock = current_stock + 5000 where name = 'Ketchup';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 5000, current_stock, 175.00 from ingredients where name = 'Ketchup';

-- Eggs +30 pcs (Makro: ARO chicken eggs size 2, tray of 30, ฿140)
update ingredients set current_stock = current_stock + 30 where name = 'Eggs';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 30, current_stock, 140.00 from ingredients where name = 'Eggs';

-- Frozen Fries +4,000 g (Makro: Chef Pack wavy-cut 12mm fries, 2kg x2,
-- ฿198.00 sticker price less the receipt's own ฿8.00 buy-2+ promo discount
-- = ฿190.00 actually paid)
update ingredients set current_stock = current_stock + 4000 where name = 'Frozen Fries';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 4000, current_stock, 190.00 from ingredients where name = 'Frozen Fries';

-- Butter +2,000 g (Makro: ARO unsalted butter block, 2kg, ฿349)
update ingredients set current_stock = current_stock + 2000 where name = 'Butter';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 2000, current_stock, 349.00 from ingredients where name = 'Butter';

-- Cauliflower +700 g (Makro: 1 Thai cauliflower head, ฿89, no weight given --
-- owner-accepted estimate of ~700g/head)
update ingredients set current_stock = current_stock + 700 where name = 'Cauliflower';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 700, current_stock, 89.00 from ingredients where name = 'Cauliflower';

-- Cabbage +646 g (Makro: cabbage (RPF), 0.646kg, ฿31.75)
update ingredients set current_stock = current_stock + 646 where name = 'Cabbage';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 646, current_stock, 31.75 from ingredients where name = 'Cabbage';

-- Onion +1,000 g (Makro: Indian onion/shallot pack, 1kg, ฿45)
update ingredients set current_stock = current_stock + 1000 where name = 'Onion';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 1000, current_stock, 45.00 from ingredients where name = 'Onion';

-- Raw Chicken Mince (Momo Grade) +2,240 g (Makro: ground chicken breast,
-- 2.240kg, ฿199.25)
update ingredients set current_stock = current_stock + 2240 where name = 'Raw Chicken Mince (Momo Grade)';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 2240, current_stock, 199.25 from ingredients where name = 'Raw Chicken Mince (Momo Grade)';

-- Momo Wrap +320 pcs (Makro: gyoza/wonton wrapper sheets, 500g x4 packs,
-- ฿280 total; owner's own estimate of ~80 sheets per 500g pack, not a
-- verified count -- 4 packs x 80 = 320)
update ingredients set current_stock = current_stock + 320 where name = 'Momo Wrap';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 320, current_stock, 280.00 from ingredients where name = 'Momo Wrap';

-- Tomatoes +1,000 g (Makro: tomato (peach variety) pack, 1000g, ฿45)
update ingredients set current_stock = current_stock + 1000 where name = 'Tomatoes';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 1000, current_stock, 45.00 from ingredients where name = 'Tomatoes';

-- Fresh Coriander +300 g (Makro: spring onion + coriander combo pack, whole
-- 300g counted toward coriander since spring onion is tracked separately
-- and this was a mixed pack -- same approximation flagged in the Sep 14
-- restock's identical line)
update ingredients set current_stock = current_stock + 300 where name = 'Fresh Coriander';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 300, current_stock, 55.00 from ingredients where name = 'Fresh Coriander';

-- Garlic +100 cloves (Makro: Chinese peeled garlic cloves, 500g, ฿39;
-- converted at ~5g/clove, the same approximation already used in
-- gen_seed.py's PRIMARY_RECIPES for Tomato Sauce's garlic)
update ingredients set current_stock = current_stock + 100 where name = 'Garlic';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 100, current_stock, 39.00 from ingredients where name = 'Garlic';

-- Carrot +478 g (Makro: imported (China) carrot, 0.478kg, ฿8.50)
update ingredients set current_stock = current_stock + 478 where name = 'Carrot';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 478, current_stock, 8.50 from ingredients where name = 'Carrot';

-- Instant Coffee +360 g (Makro: Nescafe Red Cup, 360g tin, ฿269)
update ingredients set current_stock = current_stock + 360 where name = 'Instant Coffee';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 360, current_stock, 269.00 from ingredients where name = 'Instant Coffee';

-- Lemon Iced Tea Powder +1,000 g (Makro: ARO lemon/lime tea powder, 1000g,
-- ฿117 -- owner confirmed this receipt line is Lemon Iced Tea Powder)
update ingredients set current_stock = current_stock + 1000 where name = 'Lemon Iced Tea Powder';
insert into stock_adjustments (ingredient_id, delta, resulting_stock, price_paid)
select id, 1000, current_stock, 117.00 from ingredients where name = 'Lemon Iced Tea Powder';
