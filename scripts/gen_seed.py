#!/usr/bin/env python3
"""
Generates supabase/seed.sql from structured Python data.
Run manually whenever the real menu/ingredient data changes:
    python3 scripts/gen_seed.py > supabase/seed.sql
This script itself is not part of the app runtime -- it's a one-time/occasional
authoring aid so the ~250 ingredient-mapping rows can be reviewed as data
instead of hand-typed SQL (much lower chance of a typo silently breaking a
lookup by ingredient name).
"""

# ---------------------------------------------------------------------------
# Seats
# ---------------------------------------------------------------------------
SEATS = [(f"T{i}", f"Table {i}", "table") for i in range(1, 10)] + [
    (f"S{i}", f"Counter {i}", "counter") for i in range(1, 5)
]

# ---------------------------------------------------------------------------
# Ingredients: name -> (unit, starting_stock, low_stock_threshold)
# Starting stock / threshold are placeholder par levels for day one -- not a
# real physical count. Adjust via /admin/inventory once real counts are in.
# ---------------------------------------------------------------------------
PRIMARIES = {
    "White Sauce": ("ml", 1000, 200),
    "Sautéed Mushrooms": ("g", 800, 150),
    "Potato Patty": ("pcs", 24, 6),
    "Tikka Marinated Mince": ("g", 800, 150),
    "Homemade Mayo": ("ml", 750, 150),
    "Fresh Salsa": ("ml", 300, 60),
    "Gochujang Sauce": ("ml", 300, 60),
    "Caramelised Onions": ("tbsp", 40, 10),
    "Sugar Syrup": ("ml", 1200, 200),
    "Coffee Concentrate": ("ml", 1000, 200),
    "Black Tea Concentrate": ("ml", 1000, 200),
}

RAW = {
    # Food
    "Frozen Fries": ("g", 5000, 1000),
    # Real usage pattern (owner, Aug 2026): buys 5L/week, pours the whole
    # jug in Monday, draws down through the week -- currently open Mon-Fri
    # with no mid-week top-up. Plan is to refill every 3 days and add
    # Saturday service once order volume grows enough to justify it -- when
    # that happens, bump current_stock accordingly (or restock mid-week via
    # /admin/inventory) rather than changing this seed file again.
    "Frying Oil": ("L", 5, 1),
    "Ketchup": ("ml", 2000, 400),
    "Peri-Peri Seasoning": ("g", 300, 60),
    "Garlic Powder": ("g", 300, 60),
    "Smoked Paprika": ("g", 200, 40),
    "Zab Seasoning": ("g", 300, 60),
    "Fresh Lime Juice": ("ml", 500, 100),
    "Frozen Samosas": ("pcs", 60, 15),
    "Maggi Noodles": ("g", 2000, 400),
    "Maggi Masala Sachet": ("pcs", 30, 8),
    "Butter": ("g", 2000, 400),
    "Tortilla Chips": ("g", 1500, 300),
    "Mozzarella Cheese Shredded": ("g", 2000, 400),
    "Sour Cream": ("ml", 800, 150),
    "BBQ Sauce": ("ml", 800, 150),
    "Cheese Sauce": ("ml", 800, 150),
    "Sandwich Bread": ("slices", 100, 20),
    "Cheese Slice": ("pcs", 150, 30),
    "Tikka Masala Paste": ("ml", 500, 100),
    "Fresh Lemon Juice": ("ml", 1500, 300),
    "Iceberg Lettuce": ("g", 2000, 400),
    "Burger Bun": ("pcs", 60, 15),
    "Frozen Chicken Patty": ("pcs", 60, 15),
    "Tomato Slices": ("slices", 200, 40),
    "Pickled Cucumber Slices": ("slices", 150, 30),
    "Fresh Cucumber Slices": ("slices", 150, 30),
    "Pickled Cabbage / Coleslaw": ("g", 1000, 200),
    "Spaghetti (Dry)": ("g", 3000, 600),
    "Garlic": ("cloves", 200, 40),
    "Grated Parmesan Cheese": ("g", 800, 150),
    "Green Chilli": ("pcs", 100, 20),
    "Olive Oil": ("ml", 1500, 300),
    # Drinks
    "Black Tea Leaves": ("g", 500, 100),
    "Red Label Tea Leaves": ("g", 300, 60),
    "Red Label Masala Powder": ("g", 300, 60),
    "Fresh Ginger": ("g", 500, 100),
    "Honey": ("ml", 800, 150),
    "Ground Coffee": ("g", 2000, 400),
    "Thai Tea Powder": ("g", 500, 100),
    "Full-Fat Milk": ("ml", 5000, 1000),
    "Evaporated Milk": ("ml", 1000, 200),
    "Dried Butterfly Pea Flowers": ("pcs", 200, 40),
    "Hazelnut Syrup": ("ml", 800, 150),
    "Chocolate Sauce": ("ml", 800, 150),
    "Cocoa Powder": ("g", 800, 150),
    "Strawberry Syrup": ("ml", 800, 150),
    "Mango Syrup": ("ml", 800, 150),
    "Passionfruit Syrup": ("ml", 800, 150),
    "Lychee Syrup": ("ml", 800, 150),
    "Blue Curacao Syrup (Non-Alcoholic)": ("ml", 500, 100),
    "Coconut Syrup": ("ml", 500, 100),
    "Soda Water": ("ml", 5000, 1000),
    "Cola": ("can", 48, 12),
    "Pink Salt": ("g", 200, 40),
    "Lemon Slice": ("pcs", 200, 40),
}

# Ingredients that exist for manual/visibility restock tracking only --
# genuinely unquantifiable in the SOP ("sufficient to submerge"). Deliberately
# NOT linked to any menu item, so it's never auto-deducted -- staff track and
# restock it by eye / by the weekly oil delivery, same as before this app
# existed.
UNLINKED_VISIBILITY_ONLY = {
    "Frying Oil",
}

# Ingredients excluded ENTIRELY -- no ingredients row at all, same manual
# par-stock treatment as salt and sugar (owner's ruling: keep a spare on
# hand, replace the moment one is opened/finished, no digital tracking).
# Originally just salt/sugar; extended on the owner's instruction to also
# cover chilli flakes, black pepper, condensed milk, and whipped cream,
# since none of those had a usable SOP quantity anyway. Purely documentation
# here -- nothing in this script creates rows for any of these.
EXCLUDED_MANUAL_PAR_STOCK = {
    "Salt",
    "Sugar",
    "Chilli Flakes",
    "Black Pepper",
    "Condensed Milk",
    "Whipped Cream",
}

ALL_INGREDIENTS = {**PRIMARIES, **RAW}

# ---------------------------------------------------------------------------
# Menu items: code -> (name, category, price, active)
# ---------------------------------------------------------------------------
MENU_ITEMS = [
    # Snacks
    ("SN-FRF", "French Fries", "Snacks", 45),
    ("SN-PPF", "Peri-Peri Fries", "Snacks", 50),
    ("SN-ZAF", "Zab Fries", "Snacks", 50),
    ("SN-SMT", "Samosa (3 Pcs)", "Snacks", 35),
    ("SN-MGN", "Maggie Noodles", "Snacks", 45),
    ("SN-ECM", "EXTRA CHEESY Maggie", "Snacks", 65),
    ("SN-CLN", "Chicken Loaded Nachos", "Snacks", 65),
    # Momo
    ("M-VMM", "Veg Momo", "Momo", 70),
    ("M-CMM", "Chicken Momo", "Momo", 80),
    # Sandwich
    ("SD-MUS", "Mushroom Sandwich", "Sandwich", 55),
    ("SD-GCS", "Grilled Cheese Sandwich", "Sandwich", 55),
    ("SD-CHS", "Chicken Sandwich", "Sandwich", 60),
    # Burger
    ("B-CVB", "Cheesy Veg Burger", "Burger", 55),
    ("B-CCB", "Chicken Cheese Burger", "Burger", 60),
    ("B-DTB", "Double Trouble Burger", "Burger", 75),
    ("B-GCB", "Gochujang Chicken Burger", "Burger", 65),
    ("B-SCB", "Spicy Chicken Burger", "Burger", 65),
    # Spaghetti
    ("SP-AWS0", "Spaghetti Alfredo (Mushroom)", "Spaghetti", 65),
    ("SP-AWS1", "Spaghetti Alfredo (Chicken)", "Spaghetti", 65),
    # Tea
    ("T-GLT0", "Ginger Lemon Tea (Hot)", "Tea", 35),
    ("T-GLT1", "Ginger Lemon Tea (Cold)", "Tea", 45),
    ("T-BLT0", "Black Tea (Hot)", "Tea", 30),
    ("T-BLT1", "Black Tea (Cold)", "Tea", 40),
    ("T-TMT0", "Thai Milk Tea (Hot)", "Tea", 40),
    ("T-TMT1", "Thai Milk Tea (Cold)", "Tea", 45),
    ("T-MST0", "Masala Tea (Hot)", "Tea", 35),
    ("T-MST1", "Masala Tea (Cold)", "Tea", 45),
    ("T-BPT0", "Butterfly Pea Tea (Hot)", "Tea", 40),
    ("T-BPT1", "Butterfly Pea Tea (Cold)", "Tea", 50),
    # Coffee
    ("C-BLC0", "Black Coffee (Hot)", "Coffee", 30),
    ("C-BLC1", "Black Coffee (Cold)", "Coffee", 40),
    ("C-CPN0", "Cappuccino (Hot)", "Coffee", 45),
    ("C-CPN1", "Cappuccino (Cold)", "Coffee", 55),
    ("C-HZL0", "Hazelnut Latte (Hot)", "Coffee", 45),
    ("C-HZL1", "Hazelnut Latte (Cold)", "Coffee", 55),
    ("C-MCH0", "Mocha (Hot)", "Coffee", 45),
    ("C-MCH1", "Mocha (Cold)", "Coffee", 55),
    ("C-CCA0", "Cocoa (Hot)", "Coffee", 40),
    ("C-CCA1", "Cocoa (Cold)", "Coffee", 50),
    # Iced Tea
    ("I-LIT", "Lemon Iced Tea", "Iced Tea", 45),
    ("I-PIT", "Passionfruit Iced Tea", "Iced Tea", 45),
    # Soda
    ("SO-SLS", "Strawberry Lemon Soda", "Soda", 45),
    ("SO-MPS", "Mango Passion Soda", "Soda", 45),
    ("SO-LLS", "Lychee Lemon Soda", "Soda", 45),
    ("SO-BHS", "Blue Hawaii Soda", "Soda", 45),
    ("SO-CRC", "Crispy Coke", "Soda", 45),
]

# ---------------------------------------------------------------------------
# Menu item -> ingredient mappings: code -> [(ingredient_name, qty), ...]
# Items with recipes not found anywhere in the SOP docs (EXTRA CHEESY Maggie,
# Veg Momo, Chicken Momo, Spicy Chicken Burger) are intentionally absent here
# -- they're seeded as active/orderable but with zero ingredient links.
# ---------------------------------------------------------------------------
MAPPINGS = {
    "SN-FRF": [("Frozen Fries", 130), ("Ketchup", 30), ("Homemade Mayo", 15)],
    "SN-PPF": [("Frozen Fries", 130), ("Peri-Peri Seasoning", 2.25), ("Garlic Powder", 0.75), ("Smoked Paprika", 0.75), ("Homemade Mayo", 20)],
    "SN-ZAF": [("Frozen Fries", 130), ("Zab Seasoning", 4.5), ("Fresh Lime Juice", 2.5), ("Ketchup", 30)],
    "SN-SMT": [("Frozen Samosas", 3), ("Ketchup", 30)],
    "SN-MGN": [("Maggi Noodles", 80), ("Maggi Masala Sachet", 1), ("Butter", 10)],
    "SN-CLN": [("Tortilla Chips", 80), ("Tikka Marinated Mince", 60), ("Mozzarella Cheese Shredded", 40), ("Sour Cream", 20), ("BBQ Sauce", 15), ("Cheese Sauce", 20), ("Fresh Salsa", 30)],

    "SD-MUS": [("Sandwich Bread", 2), ("Butter", 10), ("Sautéed Mushrooms", 70), ("White Sauce", 50), ("Cheese Slice", 1)],
    "SD-GCS": [("Sandwich Bread", 2), ("Butter", 10), ("Cheese Slice", 2), ("Mozzarella Cheese Shredded", 20)],
    "SD-CHS": [("Sandwich Bread", 2), ("Butter", 5), ("Tikka Marinated Mince", 70), ("Homemade Mayo", 45), ("Tikka Masala Paste", 5), ("Fresh Lemon Juice", 2.5), ("Iceberg Lettuce", 30)],

    "B-CVB": [("Burger Bun", 1), ("Butter", 5), ("Potato Patty", 1), ("Cheese Slice", 2), ("Iceberg Lettuce", 20), ("Tomato Slices", 2), ("Caramelised Onions", 2), ("Ketchup", 15), ("Homemade Mayo", 10)],
    "B-CCB": [("Burger Bun", 1), ("Butter", 5), ("Frozen Chicken Patty", 1), ("Cheese Slice", 1), ("Iceberg Lettuce", 20), ("Tomato Slices", 2), ("Caramelised Onions", 2), ("Ketchup", 15), ("Homemade Mayo", 10)],
    "B-DTB": [("Burger Bun", 1), ("Butter", 5), ("Frozen Chicken Patty", 2), ("Cheese Slice", 2), ("Iceberg Lettuce", 20), ("Tomato Slices", 2), ("Pickled Cucumber Slices", 3.5), ("Caramelised Onions", 2), ("Ketchup", 20), ("Homemade Mayo", 15)],
    "B-GCB": [("Burger Bun", 1), ("Butter", 5), ("Frozen Chicken Patty", 1), ("Gochujang Sauce", 15), ("Pickled Cabbage / Coleslaw", 30), ("Fresh Cucumber Slices", 3)],

    "SP-AWS0": [("Spaghetti (Dry)", 90), ("White Sauce", 120), ("Sautéed Mushrooms", 75), ("Butter", 5), ("Garlic", 1), ("Garlic Powder", 0.75), ("Grated Parmesan Cheese", 10), ("Olive Oil", 5)],
    "SP-AWS1": [("Spaghetti (Dry)", 90), ("White Sauce", 120), ("Tikka Marinated Mince", 70), ("Butter", 5), ("Garlic", 1), ("Garlic Powder", 0.75), ("Green Chilli", 1), ("Grated Parmesan Cheese", 10), ("Olive Oil", 5)],

    "T-GLT0": [("Black Tea Leaves", 3), ("Fresh Ginger", 3), ("Fresh Lemon Juice", 20), ("Honey", 7.5)],
    "T-GLT1": [("Black Tea Leaves", 3), ("Fresh Ginger", 3), ("Fresh Lemon Juice", 20), ("Sugar Syrup", 7.5)],
    "T-BLT0": [("Black Tea Leaves", 3)],
    "T-BLT1": [("Black Tea Concentrate", 110)],
    "T-TMT0": [("Thai Tea Powder", 18), ("Full-Fat Milk", 40)],
    "T-TMT1": [("Thai Tea Powder", 18), ("Evaporated Milk", 30)],
    "T-MST0": [("Red Label Tea Leaves", 4.5), ("Red Label Masala Powder", 1.5), ("Fresh Ginger", 4.5), ("Full-Fat Milk", 75)],
    "T-MST1": [("Red Label Tea Leaves", 6), ("Red Label Masala Powder", 3), ("Fresh Ginger", 4.5), ("Full-Fat Milk", 75)],
    "T-BPT0": [("Dried Butterfly Pea Flowers", 9), ("Honey", 15), ("Fresh Lemon Juice", 10)],
    "T-BPT1": [("Dried Butterfly Pea Flowers", 9), ("Sugar Syrup", 15), ("Fresh Lemon Juice", 10)],

    "C-BLC0": [("Ground Coffee", 20)],
    "C-BLC1": [("Coffee Concentrate", 60)],
    "C-CPN0": [("Coffee Concentrate", 100), ("Full-Fat Milk", 50), ("Cocoa Powder", 0.3)],
    "C-CPN1": [("Coffee Concentrate", 100), ("Full-Fat Milk", 80), ("Cocoa Powder", 0.3)],
    "C-HZL0": [("Coffee Concentrate", 100), ("Hazelnut Syrup", 15), ("Full-Fat Milk", 50)],
    "C-HZL1": [("Coffee Concentrate", 100), ("Hazelnut Syrup", 15), ("Full-Fat Milk", 50)],
    "C-MCH0": [("Coffee Concentrate", 100), ("Chocolate Sauce", 15), ("Cocoa Powder", 13.5), ("Full-Fat Milk", 120)],
    "C-MCH1": [("Coffee Concentrate", 100), ("Chocolate Sauce", 15), ("Cocoa Powder", 13.5), ("Full-Fat Milk", 100)],
    "C-CCA0": [("Cocoa Powder", 20), ("Full-Fat Milk", 180)],
    "C-CCA1": [("Cocoa Powder", 20), ("Full-Fat Milk", 150)],

    "I-LIT": [("Black Tea Concentrate", 150), ("Fresh Lemon Juice", 20), ("Sugar Syrup", 20), ("Lemon Slice", 1)],
    "I-PIT": [("Black Tea Concentrate", 120), ("Passionfruit Syrup", 35), ("Sugar Syrup", 10), ("Fresh Lemon Juice", 5)],

    "SO-SLS": [("Strawberry Syrup", 35), ("Fresh Lemon Juice", 15), ("Sugar Syrup", 10), ("Soda Water", 180), ("Lemon Slice", 1)],
    "SO-MPS": [("Mango Syrup", 20), ("Passionfruit Syrup", 15), ("Fresh Lemon Juice", 5), ("Soda Water", 180)],
    "SO-LLS": [("Lychee Syrup", 35), ("Fresh Lemon Juice", 15), ("Soda Water", 180), ("Lemon Slice", 1)],
    "SO-BHS": [("Blue Curacao Syrup (Non-Alcoholic)", 20), ("Coconut Syrup", 15), ("Fresh Lemon Juice", 10), ("Soda Water", 170), ("Lemon Slice", 1)],
    "SO-CRC": [("Cola", 1), ("Fresh Lime Juice", 10), ("Pink Salt", 0.75), ("Lemon Slice", 1)],
}

# No-recipe items -- deliberately zero mappings:
NO_RECIPE = {"SN-ECM", "M-VMM", "M-CMM", "B-SCB"}


def sql_str(s):
    return "'" + s.replace("'", "''") + "'"


def num(n):
    if isinstance(n, int):
        return str(n)
    if float(n).is_integer():
        return str(int(n))
    return repr(float(n))


def main():
    out = []
    out.append("-- Cafe Tan90 -- real menu/ingredient/inventory seed data")
    out.append("-- Generated by scripts/gen_seed.py -- do not hand-edit the generated")
    out.append("-- INSERT blocks below; edit the data in that script and regenerate.")
    out.append("--")
    out.append("-- Starting current_stock / low_stock_threshold values are PLACEHOLDER")
    out.append("-- par levels for day one, not a real physical count -- correct them via")
    out.append("-- /admin/inventory once actual stock is counted.")
    out.append("--")
    out.append("-- The following are deliberately absent (no ingredient row at all) --")
    out.append("-- manual par stock, not digitally tracked: " + ", ".join(sorted(EXCLUDED_MANUAL_PAR_STOCK)) + ".")
    out.append("--")
    out.append("-- " + ", ".join(sorted(UNLINKED_VISIBILITY_ONLY)) + " has an ingredient row for")
    out.append("-- manual restock tracking, but is NOT linked to any menu item -- the SOP")
    out.append("-- gives no fixed per-order quantity (\"sufficient to submerge\"), so orders")
    out.append("-- never auto-deduct it. Restock/monitor it directly via /admin/inventory.")
    out.append("")

    out.append("-- Seats: 9 tables (T1-T9), 4 counter seats (S1-S4)")
    out.append("insert into seats (id, label, kind) values")
    out.append(",\n".join(f"  ({sql_str(i)}, {sql_str(l)}, {sql_str(k)})" for i, l, k in SEATS) + "\non conflict (id) do nothing;")
    out.append("")

    out.append("-- Ingredients (11 primaries + " + str(len(RAW)) + " raw/purchased ingredients)")
    out.append("insert into ingredients (name, unit, current_stock, low_stock_threshold) values")
    rows = []
    for name, (unit, stock, thresh) in {**PRIMARIES, **RAW}.items():
        rows.append(f"  ({sql_str(name)}, {sql_str(unit)}, {num(stock)}, {num(thresh)})")
    out.append(",\n".join(rows) + "\non conflict (name) do nothing;")
    out.append("")

    out.append("-- Menu items (" + str(len(MENU_ITEMS)) + " total, matching the Menu tab item codes/prices)")
    out.append("insert into menu_items (code, name, category, price, active) values")
    rows = []
    for code, name, cat, price in MENU_ITEMS:
        rows.append(f"  ({sql_str(code)}, {sql_str(name)}, {sql_str(cat)}, {num(price)}, true)")
    out.append(",\n".join(rows) + "\non conflict (code) do nothing;")
    out.append("")

    out.append("-- Menu item -> ingredient mappings")
    out.append("-- (" + ", ".join(sorted(NO_RECIPE)) + " intentionally have none -- no SOP recipe exists for them yet)")
    for code, _, _, _ in MENU_ITEMS:
        pairs = MAPPINGS.get(code)
        if not pairs:
            continue
        out.append(f"insert into menu_item_ingredients (menu_item_code, ingredient_id, qty_per_order)")
        selects = [f"select {sql_str(code)}, id, {num(qty)} from ingredients where name = {sql_str(iname)}" for iname, qty in pairs]
        out.append("\nunion all\n".join(selects) + "\non conflict (menu_item_code, ingredient_id) do nothing;")
        out.append("")

    print("\n".join(out))


if __name__ == "__main__":
    # Sanity checks
    assert set(MENU_ITEMS) == set(MENU_ITEMS)
    codes = [c for c, *_ in MENU_ITEMS]
    assert len(codes) == len(set(codes)), "duplicate menu item code"
    for code in MAPPINGS:
        assert code in codes, f"mapping for unknown code {code}"
    for code, *_ in MENU_ITEMS:
        if code not in NO_RECIPE:
            assert code in MAPPINGS, f"missing mapping for {code}"
    for code in NO_RECIPE:
        assert code not in MAPPINGS, f"{code} marked no-recipe but has mappings"
    all_names = set(PRIMARIES) | set(RAW)
    for code, pairs in MAPPINGS.items():
        for iname, qty in pairs:
            assert iname in all_names, f"{code} references unknown ingredient {iname!r}"
            assert qty > 0, f"{code} / {iname} has non-positive qty"
    for n in UNLINKED_VISIBILITY_ONLY:
        assert n in RAW, f"{n} not in RAW"
        for code, pairs in MAPPINGS.items():
            assert n not in [p[0] for p in pairs], f"{n} should be unlinked but is used by {code}"
    main()
