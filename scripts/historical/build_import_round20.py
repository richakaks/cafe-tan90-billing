"""
Round 20: fixes and completes July's historical sales.

Background (see parse_sheet_round20.py's docstring for the full story):
Round 14's import used a different, incomplete transcription of July that
stopped at 2026-07-07 and even that day was only 6 of its real 35 line
items. This script uses the spreadsheet's own complete "MONTHLY SUMMARY
JULY" table (parsed by parse_sheet_round20.py into july_full.json, and
reconciled exactly against the sheet's own printed July totals) to:

  1. DELETE the 6 incomplete/partial 2026-07-07 rows Round 14 imported
     (source_row_id in the 1-457 range) -- there is no way to reconcile
     those specific 6 against the correct 35 without risking either a
     silent duplicate or a silent gap, so the safe move is to replace the
     day outright rather than try to diff/merge it.
  2. INSERT the complete, correct 2026-07-07 through 2026-07-31 data (400
     rows total: 35 for the 7th + 365 for the 8th-31st) as new rows,
     source_row_id continuing from 879 (the next id after Round 16's
     458-878).

2026-07-01 through 2026-07-06 are untouched -- verified byte-for-byte
identical (same items, same order, same prices) against what's already
imported, so there is nothing to fix there.

Pricing: every July row in the source has a real recorded price (no
#REF! errors here, unlike August) -- price_source is 'recorded'
throughout, same as Round 14's original July 1-7 rows.
"""
import json

MENU = {
    "SN-FRF": ("French Fries", "Snacks", 45),
    "SN-PPF": ("Peri-Peri Fries", "Snacks", 50),
    "SN-ZAF": ("Zab Fries", "Snacks", 50),
    "SN-SMT": ("Samosa (3 Pcs)", "Snacks", 35),
    "SN-MGN": ("Maggie Noodles", "Snacks", 45),
    "SN-ECM": ("EXTRA CHEESY Maggie", "Snacks", 65),
    "SN-CLN": ("Chicken Loaded Nachos", "Snacks", 65),
    "M-VMM": ("Veg Momo", "Momo", 70),
    "M-CMM": ("Chicken Momo", "Momo", 80),
    "SD-MUS": ("Mushroom Sandwich", "Sandwich", 55),
    "SD-GCS": ("Grilled Cheese Sandwich", "Sandwich", 55),
    "SD-CHS": ("Chicken Sandwich", "Sandwich", 60),
    "B-CVB": ("Cheesy Veg Burger", "Burger", 55),
    "B-CCB": ("Chicken Cheese Burger", "Burger", 60),
    "B-DTB": ("Double Trouble Burger", "Burger", 75),
    "B-GCB": ("Gochujang Chicken Burger", "Burger", 65),
    "B-SCB": ("Spicy Chicken Burger", "Burger", 65),
    "SP-AWS0": ("Spaghetti Alfredo (Mushroom)", "Spaghetti", 65),
    "SP-AWS1": ("Spaghetti Alfredo (Chicken)", "Spaghetti", 65),
    "T-GLT0": ("Ginger Lemon Tea (Hot)", "Tea", 35),
    "T-GLT1": ("Ginger Lemon Tea (Cold)", "Tea", 45),
    "T-BLT0": ("Black Tea (Hot)", "Tea", 30),
    "T-BLT1": ("Black Tea (Cold)", "Tea", 40),
    "T-TMT0": ("Thai Milk Tea (Hot)", "Tea", 40),
    "T-TMT1": ("Thai Milk Tea (Cold)", "Tea", 45),
    "T-MST0": ("Masala Tea (Hot)", "Tea", 35),
    "T-MST1": ("Masala Tea (Cold)", "Tea", 45),
    "T-BPT0": ("Butterfly Pea Tea (Hot)", "Tea", 40),
    "T-BPT1": ("Butterfly Pea Tea (Cold)", "Tea", 50),
    "C-BLC0": ("Black Coffee (Hot)", "Coffee", 30),
    "C-BLC1": ("Black Coffee (Cold)", "Coffee", 40),
    "C-CPN0": ("Cappuccino (Hot)", "Coffee", 45),
    "C-CPN1": ("Cappuccino (Cold)", "Coffee", 55),
    "C-HZL0": ("Hazelnut Latte (Hot)", "Coffee", 45),
    "C-HZL1": ("Hazelnut Latte (Cold)", "Coffee", 55),
    "C-MCH0": ("Mocha (Hot)", "Coffee", 45),
    "C-MCH1": ("Mocha (Cold)", "Coffee", 55),
    "C-CCA0": ("Cocoa (Hot)", "Coffee", 40),
    "C-CCA1": ("Cocoa (Cold)", "Coffee", 50),
    "I-LIT": ("Lemon Iced Tea", "Iced Tea", 45),
    "I-PIT": ("Passionfruit Iced Tea", "Iced Tea", 45),
    "SO-SLS": ("Strawberry Lemon Soda", "Soda", 45),
    "SO-MPS": ("Mango Passion Soda", "Soda", 45),
    "SO-MBS": ("Mixed Berry Soda", "Soda", 45),
    "SO-LLS": ("Lychee Lemon Soda", "Soda", 45),
    "SO-BHS": ("Blue Hawaii Soda", "Soda", 45),
    "SO-CRC": ("Crispy Coke", "Soda", 45),
}

# Round 14 + Round 16's combined mapping (unchanged), plus every new name
# first seen in this July 7-31 parse.
MAPPING = {
    "Masala Tea": "T-MST0",
    "Masala tea": "T-MST0",
    "Masala Tea Iced": "T-MST1",
    "Grilled Cheese Sandwich": "SD-GCS",
    "Chicken Burger": None,
    "Peri Peri Fries": "SN-PPF",
    "Peri-Peri Fries": "SN-PPF",
    "Lemon Iced Tea": "I-LIT",
    "Water": None,
    "water": None,
    "Samosa": "SN-SMT",
    "Brownie": None,
    "Black Coffee": "C-BLC0",
    "Black coffee": "C-BLC0",
    "Ginger Lemon Tea": "T-GLT0",
    "Lemon Ginger Tea": "T-GLT0",
    "lemon Ginger Tea": "T-GLT0",
    "Hazelnut Latte": "C-HZL0",
    "Hazelnut latte": "C-HZL0",
    "Hazelnut Latte Hot": "C-HZL0",
    "Maggie": "SN-MGN",
    "Maggie Noodles": "SN-MGN",
    "Mushroom Sandwich": "SD-MUS",
    "Mocha": "C-MCH0",
    "Mocha Hot": "C-MCH0",
    "Mocha Iced": "C-MCH1",
    "Chicken Cheese Sandwich": "SD-CHS",
    "Chicken cheese sandwich": "SD-CHS",
    "Chicken Katti Roll": None,
    "Cocoa": "C-CCA0",
    "Thai Milk Tea": "T-TMT0",
    "Thai Milk tea": "T-TMT0",
    "Thai Milk Tea Hot": "T-TMT0",
    "Thai Milk tea(hot)": "T-TMT0",
    "Thai Milk Tea Cold": "T-TMT1",
    "Thai Milk Tea Iced": "T-TMT1",
    "Nachos": "SN-CLN",
    "Chicken Loaded Nachos": "SN-CLN",
    "Chicken Cheese Burger": "B-CCB",
    "Double Trouble Burger": "B-DTB",
    "French Fries": "SN-FRF",
    "Fries": None,
    "Cappucino": "C-CPN0",
    "Cappuccino": "C-CPN0",
    "Cappucino Hot": "C-CPN0",
    "Coke": None,
    "Alfredo Pasta - Chicken": "SP-AWS1",
    "Alfredo Pasta": None,
    "Pasta": None,
    "Pasta White saucs": None,
    "Milk Coffee": None,
    "Milk Coffee Iced": None,
    "Milk Tea": "T-TMT0",
    "Milk Tea Iced": "T-TMT1",
    "Lychee Lemon Soda": "SO-LLS",
    "Passionfruit Iced Tea": "I-PIT",
    "Passion Fruit Iced Tea": "I-PIT",
    "Passion Iced Tea": "I-PIT",
    "Passion Lemon Iced tea": None,
    "Mango passion Iced tea": None,
    "Muffin": None,
    "Black Tea Lemon": None,
    "Lemon Tea Hot": None,
    "Green Tea Lemon": None,
    "Lemonade": None,
    "Cake": None,
    "Blue Hawai": "SO-BHS",
    "Thai Chilli": None,
    "Tuna Sandwich": None,
    "Doritos": None,
    "Cupcake": None,
    "Mixberry Soda": "SO-MBS",
    "Pani Puri": None,
    "Strawberry Lemon Soda": "SO-SLS",
    "Gochujang Chicken Burger": "B-GCB",
    "Black Tea": "T-BLT0",
    "Black tea": "T-BLT0",
    "Zab Fries": "SN-ZAF",
    "Black Coffee Iced": "C-BLC1",
    "Black Tea Iced": "T-BLT1",
    "Butterfly Pea Tea": "T-BPT0",
    "Butterfly Pea Tea Hot": "T-BPT0",
    "Cappuccino Iced": "C-CPN1",
    "Chicken Masala Sandwich": None,
    "Cocoa Hot": "C-CCA0",
    "Ginger Lemon Tea Iced": "T-GLT1",
    "Latte Hot": "C-HZL0",
    "Lemon Soda": None,
    "Mango Passion Soda": "SO-MPS",
    "Masala Coke": None,
    "Momo": None,
    "Soda": None,
    "Spicy Chicken Burger": "B-SCB",
    "Thai Chilli - Chicken": None,
    "Thai Chilli - Mushroom": None,
    # --- new names first seen in this July 7-31 parse ---
    "Alfredo Mushroom": "SP-AWS0",          # ฿65 matches Spaghetti Alfredo (Mushroom) exactly
    "Alfredo Pasta Chicken": "SP-AWS1",     # ฿65 matches Spaghetti Alfredo (Chicken) exactly, same as "Alfredo Pasta - Chicken"
    "Americano Hot": None,                  # no Americano on today's menu
    "Black Coffee Cold": "C-BLC1",
    "Black Coffee Hot": "C-BLC0",
    "Black Tea Cold": "T-BLT1",
    "Black Tea Hot": "T-BLT0",
    "Cappuccino Cold": "C-CPN1",
    "Cappuccino Hot": "C-CPN0",
    "Chicken Sandwich": "SD-CHS",           # direct match, on today's menu as-is
    "Cocoa Cold": "C-CCA1",
    "Cocoa Iced": "C-CCA1",
    "Ginger Lemon Tea Cold": "T-GLT1",
    "Ginger lemon Tea": "T-GLT0",
    "Gochuchang Burger": "B-GCB",           # ฿65 (one row is ฿25 net after a 40-voucher discount) -- typo of Gochujang
    "Gochujang Burger": "B-GCB",            # ฿65, shortened name -- only one Gochujang item on the menu
    "Grill Cheese Sandwich": "SD-GCS",      # typo of Grilled Cheese Sandwich
    "Hazelnut latte Hot": "C-HZL0",
    "Marinara Pasta": None,                 # not on today's menu (only 2 Alfredo variants)
    "Masala Tea Cold": "T-MST1",
    "MasalaTea": "T-MST0",
    "Milk Coffee Cold": None,               # Milk Coffee isn't on today's menu, same as the plain/Iced variants
    "Mixed Berry Soda": "SO-MBS",           # full name of "Mixberry Soda"
    "Passion Fruit": None,                  # ambiguous -- ฿45 matches both Passionfruit Iced Tea and Mango Passion Soda
    "Potato Patty": None,                   # this is a recipe primary in this app, not a menu item sold on its own
    "Strawberry Soda": "SO-SLS",            # only one Strawberry-named soda on the menu
    "Thai Chilli Pasata": None,             # not on today's menu, same family as the already-unmatched Thai Chilli dishes
    "Thai Chilli Spaghetti": None,
    "Veg Burger": None,                     # ฿65 does NOT match Cheesy Veg Burger's ฿55 -- don't guess
    "masala Tea": "T-MST0",
}


def sql_str(s):
    if s is None:
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


def sql_num(n):
    if n is None:
        return "null"
    return str(n)


def main():
    rows = json.load(open("/root/work/cafe-tan90-ordering/scripts/historical/july_full.json"))
    rows = [r for r in rows if r["date"] >= "2026-07-07"]  # 07-01..07-06 already correctly imported

    names = set(r["item_name"] for r in rows)
    missing = names - set(MAPPING.keys())
    if missing:
        raise SystemExit(f"MAPPING is missing {len(missing)} names: {sorted(missing)}")
    unknown_codes = {v for v in MAPPING.values() if v is not None} - set(MENU.keys())
    if unknown_codes:
        raise SystemExit(f"MAPPING references codes not in MENU: {unknown_codes}")

    built = []
    for r in rows:
        code = MAPPING[r["item_name"]]
        built.append((r["date"], r["item_name"], code, r["quantity"], r["unit_price"], r["total_revenue"], "recorded", r["note"]))

    matched = sum(1 for r in built if r[2] is not None)
    total_qty = sum(r[3] for r in built)
    total_rev = sum(r[5] or 0 for r in built)
    jul7 = sum(1 for r in built if r[0] == "2026-07-07")
    print(f"{len(built)} rows total ({jul7} for 07-07, {len(built) - jul7} for 07-08..07-31)")
    print(f"{matched} matched to a current menu item, {len(built) - matched} kept as off-menu")
    print(f"total quantity: {total_qty}, total revenue: {total_rev:.2f}")

    START_ID = 879
    lines = []
    lines.append("-- Round 20: fixes and completes July's historical sales.")
    lines.append("-- Generated by scripts/historical/build_import_round20.py -- see that file's")
    lines.append("-- docstring for the full story and parse_sheet_round20.py for how this data")
    lines.append("-- was pulled from the spreadsheet's own complete \"MONTHLY SUMMARY JULY\"")
    lines.append("-- table (reconciled exactly against the sheet's own printed July totals).")
    lines.append("--")
    lines.append("-- Step 1: the 6 rows Round 14 imported for 2026-07-07 were an incomplete")
    lines.append("-- partial transcription (6 of that day's real 35 line items). Replace the")
    lines.append("-- whole day outright rather than risk a silent duplicate or gap trying to")
    lines.append("-- diff/merge the old 6 against the correct 35.")
    lines.append("delete from historical_sales where sale_date = '2026-07-07';")
    lines.append("")
    lines.append(f"-- Step 2: insert the complete, correct 2026-07-07 through 2026-07-31 data")
    lines.append(f"-- ({len(built)} rows: {jul7} for the 7th + {len(built) - jul7} for the 8th-31st).")
    lines.append("-- 2026-07-01 through 2026-07-06 are untouched -- already correctly imported")
    lines.append("-- in Round 14 (verified byte-for-byte identical against this same source).")
    lines.append("-- Safe to re-run: source_row_id is fixed per row, so on conflict do nothing.")
    lines.append("insert into historical_sales")
    lines.append("  (source_row_id, sale_date, item_name, menu_item_code, quantity, unit_price, total_revenue, price_source, payment_note)")
    lines.append("values")
    value_lines = []
    for i, (date, name, code, qty, price, revenue, source, note) in enumerate(built, start=START_ID):
        value_lines.append(
            f"  ({i}, {sql_str(date)}, {sql_str(name)}, {sql_str(code)}, {qty}, {sql_num(price)}, {sql_num(revenue)}, {sql_str(source)}, {sql_str(note)})"
        )
    lines.append(",\n".join(value_lines))
    lines.append("on conflict (source_row_id) do nothing;")
    lines.append("")

    with open("/root/work/cafe-tan90-ordering/supabase/historical_sales_import_round20.sql", "w") as f:
        f.write("\n".join(lines))
    print("Wrote supabase/historical_sales_import_round20.sql")


if __name__ == "__main__":
    main()
