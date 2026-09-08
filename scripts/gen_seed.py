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
    # Added when the Drinks SOP introduced a blended-milk base (Meiji :
    # Carnation : Mali, 7:2:1) used across Cappuccino/Mocha/Cocoa in place
    # of plain Full-Fat Milk. 2-day shelf life per the SOP.
    "Base Milk": ("ml", 2000, 400),
    # House-made from Base Milk + cocoa powder + sugar, cooked down. Distinct
    # from the raw "Chocolate Sauce" ingredient (a store-bought drizzle, now
    # unlinked -- see UNLINKED_VISIBILITY_ONLY). 2-day shelf life.
    "Chocolate Syrup": ("ml", 800, 150),
    # Momo primaries, added once the food SOP got Momo recipes.
    "Chicken Keema": ("g", 1200, 250),
    "Veg Keema": ("g", 2200, 400),
    "Tomato Sauce": ("ml", 650, 150),
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
    # Added when the Zab Fries SOP picked up a second dry seasoning
    # alongside Zab Seasoning.
    "Lime Seasoning": ("g", 300, 60),
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
    "Frozen Corn": ("g", 500, 100),
    "Frozen Peas": ("g", 500, 100),
    "Chilli Oil": ("ml", 500, 100),
    "Momo Wrap": ("pcs", 300, 60),
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
    # Added for the new Mixed Berry Soda menu item.
    "Mixed Berry Syrup": ("ml", 800, 150),
    # Round 21: the Drinks SOP replaced Lemon/Passionfruit Iced Tea's Black
    # Tea Concentrate base with a dedicated instant powder mix. Tracked
    # directly in tbsp (same precedent as Caramelised Onions) since that's
    # the SOP's own unit and there's no reliable g-per-tbsp density to
    # convert from without guessing.
    "Lemon Iced Tea Powder": ("tbsp", 200, 40),
    "Blue Curacao Syrup (Non-Alcoholic)": ("ml", 500, 100),
    "Coconut Syrup": ("ml", 500, 100),
    "Soda Water": ("ml", 5000, 1000),
    "Cola": ("can", 48, 12),
    "Pink Salt": ("g", 200, 40),
    "Lemon Slice": ("pcs", 200, 40),
}

# Ingredients that exist for manual/visibility restock tracking only --
# genuinely unquantifiable in the SOP. Deliberately NOT linked to any menu
# item, so they're never auto-deducted -- staff track and restock by eye.
UNLINKED_VISIBILITY_ONLY = {
    "Frying Oil",  # "sufficient to submerge"
    # Both went from a fixed per-order quantity to an unquantified garnish
    # once the Drinks SOP reworked Cappuccino/Mocha/Cocoa around the new
    # Base Milk + Chocolate Syrup primaries: Cocoa Powder is now just an
    # unquantified dusting on Cocoa (previously 20g/13.5g/0.3g mixed-in
    # across three drinks); Chocolate Sauce is now just an unquantified
    # drizzle garnish on Mocha (previously 15ml mixed-in).
    "Cocoa Powder",
    "Chocolate Sauce",
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

# Round 22: packaging consumables (straws, takeaway boxes/cups/glasses).
# Deliberately NOT referenced by any MAPPINGS entry -- they're never part of
# a menu item's recipe. Instead, place_order()/fulfill_pre_order() deduct
# them dynamically at order time by looking these exact names up, based on
# each order item's fulfillment_type (dine-in vs takeaway) crossed with its
# menu item's packaging_type (food / hot_drink / cold_drink) -- see the
# Round 22 section of schema.sql. Placeholder par levels, same as everything
# else in this file.
CONSUMABLES = {
    "Takeaway Food Box": ("pcs", 200, 50),
    "Hot Takeaway Glass": ("pcs", 200, 50),
    "Cold Takeaway Glass": ("pcs", 200, 50),
    # Given with every cold drink regardless of dine-in/takeaway, so it turns
    # over faster than the takeaway-only containers above.
    "Straw": ("pcs", 300, 75),
}

ALL_INGREDIENTS = {**PRIMARIES, **RAW, **CONSUMABLES}

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
    ("SO-MBS", "Mixed Berry Soda", "Soda", 45),
    ("SO-LLS", "Lychee Lemon Soda", "Soda", 45),
    ("SO-BHS", "Blue Hawaii Soda", "Soda", 45),
    ("SO-CRC", "Crispy Coke", "Soda", 45),
]

# ---------------------------------------------------------------------------
# Menu item -> ingredient mappings: code -> [(ingredient_name, qty), ...]
# Items with recipes not found anywhere in the SOP docs (Veg Momo, Chicken
# Momo) are intentionally absent here -- they're seeded as active/orderable
# but with zero ingredient links.
# ---------------------------------------------------------------------------
MAPPINGS = {
    "SN-FRF": [("Frozen Fries", 130), ("Ketchup", 30), ("Homemade Mayo", 15)],
    "SN-PPF": [("Frozen Fries", 130), ("Peri-Peri Seasoning", 2.25), ("Garlic Powder", 0.75), ("Smoked Paprika", 0.75), ("Homemade Mayo", 20)],
    # Updated SOP: dropped Fresh Lime Juice, picked up a second dry
    # seasoning (Lime Seasoning) and Mayonnaise (mapped to the Homemade Mayo
    # primary, same "house mayo" convention used elsewhere -- see project
    # notes). Round 21: the SOP's own table now lists Ketchup 30ml too
    # (previously only mentioned in the method text, not a tracked link).
    "SN-ZAF": [("Frozen Fries", 130), ("Zab Seasoning", 4.5), ("Lime Seasoning", 3), ("Homemade Mayo", 30), ("Ketchup", 30)],
    "SN-SMT": [("Frozen Samosas", 3), ("Ketchup", 30)],
    "SN-MGN": [("Maggi Noodles", 80), ("Maggi Masala Sachet", 1), ("Frozen Corn", 10), ("Frozen Peas", 10), ("Butter", 10)],
    "SN-ECM": [("Maggi Noodles", 80), ("Maggi Masala Sachet", 1), ("Frozen Corn", 10), ("Frozen Peas", 10), ("Cheese Slice", 1), ("Butter", 10)],
    "SN-CLN": [("Tortilla Chips", 80), ("Tikka Marinated Mince", 60), ("Mozzarella Cheese Shredded", 40), ("Sour Cream", 20), ("BBQ Sauce", 15), ("Cheese Sauce", 20), ("Fresh Salsa", 30)],

    "M-VMM": [("Veg Keema", 100), ("Momo Wrap", 10), ("Tomato Sauce", 35)],
    "M-CMM": [("Chicken Keema", 100), ("Momo Wrap", 10), ("Tomato Sauce", 35)],

    "SD-MUS": [("Sandwich Bread", 2), ("Butter", 10), ("Sautéed Mushrooms", 70), ("White Sauce", 50), ("Cheese Slice", 1)],
    "SD-GCS": [("Sandwich Bread", 2), ("Butter", 10), ("Cheese Slice", 2), ("Mozzarella Cheese Shredded", 20)],
    "SD-CHS": [("Sandwich Bread", 2), ("Butter", 5), ("Tikka Marinated Mince", 70), ("Homemade Mayo", 45), ("Tikka Masala Paste", 5), ("Fresh Lemon Juice", 2.5), ("Iceberg Lettuce", 30)],

    "B-CVB": [("Burger Bun", 1), ("Butter", 5), ("Potato Patty", 1), ("Cheese Slice", 2), ("Iceberg Lettuce", 20), ("Tomato Slices", 2), ("Caramelised Onions", 2), ("Ketchup", 15), ("Homemade Mayo", 10)],
    "B-CCB": [("Burger Bun", 1), ("Butter", 5), ("Frozen Chicken Patty", 1), ("Cheese Slice", 1), ("Iceberg Lettuce", 20), ("Tomato Slices", 2), ("Caramelised Onions", 2), ("Ketchup", 15), ("Homemade Mayo", 10)],
    # Round 21: SOP's Double Trouble Burger table no longer lists Pickled
    # Cucumber Slices -- removed rather than guessed as still-current.
    "B-DTB": [("Burger Bun", 1), ("Butter", 5), ("Frozen Chicken Patty", 2), ("Cheese Slice", 2), ("Iceberg Lettuce", 20), ("Tomato Slices", 2), ("Caramelised Onions", 2), ("Ketchup", 20), ("Homemade Mayo", 15)],
    # Round 21: SOP swapped Pickled Cabbage/Coleslaw for Caramelised Onions
    # (2 tbsp, same as every other burger); cucumber unchanged.
    "B-GCB": [("Burger Bun", 1), ("Butter", 5), ("Frozen Chicken Patty", 1), ("Gochujang Sauce", 15), ("Caramelised Onions", 2), ("Fresh Cucumber Slices", 3)],
    "B-SCB": [("Burger Bun", 1), ("Butter", 5), ("Frozen Chicken Patty", 1), ("Cheese Slice", 1), ("Iceberg Lettuce", 20), ("Tomato Slices", 2), ("Caramelised Onions", 2), ("Ketchup", 15), ("Homemade Mayo", 10), ("Chilli Oil", 15)],

    "SP-AWS0": [("Spaghetti (Dry)", 90), ("White Sauce", 120), ("Sautéed Mushrooms", 75), ("Butter", 5), ("Garlic", 1), ("Garlic Powder", 0.75), ("Grated Parmesan Cheese", 10), ("Olive Oil", 5)],
    "SP-AWS1": [("Spaghetti (Dry)", 90), ("White Sauce", 120), ("Tikka Marinated Mince", 70), ("Butter", 5), ("Garlic", 1), ("Garlic Powder", 0.75), ("Green Chilli", 1), ("Grated Parmesan Cheese", 10), ("Olive Oil", 5)],

    "T-GLT0": [("Black Tea Leaves", 3), ("Fresh Ginger", 3), ("Fresh Lemon Juice", 20), ("Honey", 7.5)],
    "T-GLT1": [("Black Tea Leaves", 3), ("Fresh Ginger", 3), ("Fresh Lemon Juice", 20), ("Sugar Syrup", 7.5)],
    "T-BLT0": [("Black Tea Leaves", 3)],
    "T-BLT1": [("Black Tea Concentrate", 110)],
    # Round 21: SOP switched both Thai Milk Tea variants from Full-Fat
    # Milk/Evaporated Milk to the Base Milk primary (same volumes as before).
    "T-TMT0": [("Thai Tea Powder", 18), ("Base Milk", 40)],
    "T-TMT1": [("Thai Tea Powder", 18), ("Base Milk", 30)],
    # Round 21: SOP switched Masala Tea (hot & cold) from Full-Fat Milk to
    # the Base Milk primary, same 75ml either way.
    "T-MST0": [("Red Label Tea Leaves", 4.5), ("Red Label Masala Powder", 1.5), ("Fresh Ginger", 4.5), ("Base Milk", 75)],
    "T-MST1": [("Red Label Tea Leaves", 6), ("Red Label Masala Powder", 3), ("Fresh Ginger", 4.5), ("Base Milk", 75)],
    "T-BPT0": [("Dried Butterfly Pea Flowers", 9), ("Honey", 15), ("Fresh Lemon Juice", 10)],
    "T-BPT1": [("Dried Butterfly Pea Flowers", 9), ("Sugar Syrup", 15), ("Fresh Lemon Juice", 10)],

    "C-BLC0": [("Ground Coffee", 20)],
    "C-BLC1": [("Coffee Concentrate", 60)],
    # Reworked around the new Base Milk primary; Sugar Syrup is an optional
    # customer add-in per the SOP (8ml hot / 10ml cold), not included by
    # default -- same "on request" treatment used elsewhere (e.g. milk in
    # Black Tea). The old cocoa/cinnamon dusting garnish is no longer
    # mentioned in the SOP at all for this drink.
    "C-CPN0": [("Coffee Concentrate", 25), ("Base Milk", 85)],
    "C-CPN1": [("Coffee Concentrate", 30), ("Base Milk", 100)],
    # Coffee Concentrate volume increased, milk stays Full-Fat Milk (not
    # switched to Base Milk like the other three), single quantity now
    # covers both hot and cold per the SOP.
    # Round 21: SOP's base table gives Hot 30ml Coffee Concentrate (60ml is
    # iced-only) -- previously both variants used 60ml.
    "C-HZL0": [("Coffee Concentrate", 30), ("Hazelnut Syrup", 15), ("Full-Fat Milk", 150)],
    "C-HZL1": [("Coffee Concentrate", 60), ("Hazelnut Syrup", 15), ("Full-Fat Milk", 150)],
    # Chocolate Sauce + Cocoa Powder mixed-in replaced by the new Chocolate
    # Syrup primary; garnish (chocolate drizzle + instant coffee dusting) is
    # unquantified, not linked.
    "C-MCH0": [("Coffee Concentrate", 25), ("Chocolate Syrup", 25), ("Base Milk", 100)],
    "C-MCH1": [("Coffee Concentrate", 30), ("Chocolate Syrup", 30), ("Base Milk", 125)],
    # Cocoa Powder mixed-in replaced by Chocolate Syrup; cocoa powder is now
    # only an unquantified garnish dusting, not linked.
    "C-CCA0": [("Chocolate Syrup", 33), ("Base Milk", 125)],
    "C-CCA1": [("Chocolate Syrup", 50), ("Base Milk", 150)],

    # Round 21: SOP replaced the Black Tea Concentrate base entirely with a
    # dedicated Lemon Iced Tea Powder mix; lemon juice and sugar syrup
    # quantities both changed too.
    "I-LIT": [("Lemon Iced Tea Powder", 1.5), ("Fresh Lemon Juice", 5), ("Sugar Syrup", 10), ("Lemon Slice", 1)],
    # Round 21: same base swap; syrup is 1 tbsp mixed in + 1 tbsp garnish on
    # top per the SOP (2 tbsp / 30ml total, both drawn from stock).
    "I-PIT": [("Lemon Iced Tea Powder", 1.5), ("Passionfruit Syrup", 30), ("Sugar Syrup", 10), ("Fresh Lemon Juice", 5)],

    "SO-SLS": [("Strawberry Syrup", 35), ("Fresh Lemon Juice", 15), ("Sugar Syrup", 10), ("Soda Water", 180), ("Lemon Slice", 1)],
    "SO-MPS": [("Mango Syrup", 20), ("Passionfruit Syrup", 15), ("Fresh Lemon Juice", 5), ("Soda Water", 180)],
    "SO-MBS": [("Mixed Berry Syrup", 35), ("Fresh Lemon Juice", 10), ("Sugar Syrup", 2), ("Soda Water", 180)],
    "SO-LLS": [("Lychee Syrup", 35), ("Fresh Lemon Juice", 15), ("Soda Water", 180), ("Lemon Slice", 1)],
    "SO-BHS": [("Blue Curacao Syrup (Non-Alcoholic)", 20), ("Coconut Syrup", 15), ("Fresh Lemon Juice", 10), ("Soda Water", 170), ("Lemon Slice", 1)],
    "SO-CRC": [("Cola", 1), ("Fresh Lime Juice", 10), ("Pink Salt", 0.75), ("Lemon Slice", 1)],
}

# No-recipe items -- deliberately zero mappings. Empty now that Momo has
# real recipes; kept as a set (not deleted) so the pattern is ready for the
# next item that ships without a recipe.
NO_RECIPE = set()

# sort_order overrides for items inserted into the MIDDLE of MENU_ITEMS after
# production has already been seeded once. The normal (index+1)*10 formula
# below recomputes every item's "logical" position from scratch each time
# this script runs, but on an already-seeded database `insert ... on conflict
# do nothing` only actually inserts the brand-new code -- every other row
# keeps whatever sort_order it was originally migrated with. Without this
# override, a mid-list insertion collides: e.g. adding SO-MBS between SO-MPS
# (already live at 430) and SO-LLS (already live at 440) would compute 440
# for SO-MBS too, tying it with SO-LLS instead of landing between them. List
# the exact value to use here instead of the formula's result; leave
# everything else alone. Safe for a brand-new database too -- it just makes
# that one item's gap to its neighbour uneven (15 instead of 10), which
# doesn't matter since only relative order is ever used.
SORT_ORDER_OVERRIDES = {
    "SO-MBS": 435,  # between SO-MPS (430) and SO-LLS (440)
}


# Round 22: explicit food/hot_drink/cold_drink classification per menu item,
# used for packaging-consumable deduction (see CONSUMABLES above). Computed
# here from category + the existing hot(0)/cold(1) code-suffix convention --
# the exact same rule schema.sql's Round 22 backfill applies to already-live
# rows -- so a brand-new database and a migrated one always agree. Owners can
# still reclassify any individual item later from /admin/menu; this is only
# the starting point.
def packaging_type_for(code, category):
    if category in ("Snacks", "Momo", "Sandwich", "Burger", "Spaghetti"):
        return "food"
    if category in ("Iced Tea", "Soda"):
        return "cold_drink"
    if category in ("Tea", "Coffee"):
        return "hot_drink" if code.endswith("0") else "cold_drink"
    raise ValueError(f"no packaging classification rule for category {category!r} (code {code})")


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

    out.append("-- Ingredients (" + str(len(PRIMARIES)) + " batch-prep primaries + " + str(len(RAW)) + " raw/purchased ingredients + " + str(len(CONSUMABLES)) + " packaging consumables)")
    out.append("insert into ingredients (name, unit, current_stock, low_stock_threshold, kind) values")
    rows = []
    for name, (unit, stock, thresh) in PRIMARIES.items():
        rows.append(f"  ({sql_str(name)}, {sql_str(unit)}, {num(stock)}, {num(thresh)}, 'batch_prep')")
    for name, (unit, stock, thresh) in RAW.items():
        rows.append(f"  ({sql_str(name)}, {sql_str(unit)}, {num(stock)}, {num(thresh)}, 'raw')")
    for name, (unit, stock, thresh) in CONSUMABLES.items():
        rows.append(f"  ({sql_str(name)}, {sql_str(unit)}, {num(stock)}, {num(thresh)}, 'consumable')")
    out.append(",\n".join(rows) + "\non conflict (name) do nothing;")
    out.append("")

    out.append("-- Menu items (" + str(len(MENU_ITEMS)) + " total, matching the Menu tab item codes/prices).")
    out.append("-- sort_order starts at 10 (never 0 -- 0 is reserved as the 'not yet migrated'")
    out.append("-- sentinel the schema.sql backfill looks for) and steps by 10 in MENU_ITEMS'")
    out.append("-- own order, which is already the Menu PRD's category order (Snacks, Momo,")
    out.append("-- Sandwich, Burger, Spaghetti, Tea, Coffee, Iced Tea, Soda). packaging_type is")
    out.append("-- computed by packaging_type_for() -- see its comment for the rule.")
    out.append("insert into menu_items (code, name, category, price, active, sort_order, packaging_type) values")
    rows = []
    for i, (code, name, cat, price) in enumerate(MENU_ITEMS):
        sort_order = SORT_ORDER_OVERRIDES.get(code, (i + 1) * 10)
        packaging_type = packaging_type_for(code, cat)
        rows.append(f"  ({sql_str(code)}, {sql_str(name)}, {sql_str(cat)}, {num(price)}, true, {sort_order}, {sql_str(packaging_type)})")
    out.append(",\n".join(rows) + "\non conflict (code) do nothing;")
    out.append("")

    out.append("-- Menu item -> ingredient mappings")
    if NO_RECIPE:
        out.append("-- (" + ", ".join(sorted(NO_RECIPE)) + " intentionally have none -- no SOP recipe exists for them yet)")
    else:
        out.append("-- (every active menu item has a recipe as of this generation)")
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
    for code, pairs in MAPPINGS.items():
        for iname, _qty in pairs:
            assert iname not in CONSUMABLES, f"{code} links packaging consumable {iname!r} as a recipe ingredient -- packaging is deducted automatically, never via menu_item_ingredients"
    for code, _name, cat, _price in MENU_ITEMS:
        packaging_type_for(code, cat)  # raises if a code/category has no classification rule
    main()
