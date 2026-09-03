"""
Round 16 extension: imports 2026-08-07 through 2026-08-31 (the rest of
August; 08-03 through 08-06 were already imported in Round 14 as
source_row_id 1-457). Source: a fresh CSV export of the owner's spreadsheet
(gid=1323664208, the "MONTHLY SUMMARY AUGUST" block), parsed directly with
Python's csv module rather than the markdown-table hack used in Round 14 --
more robust, and this file also has real Mode-of-Payment / coupon notes in
column L.

Pricing, per row:
  - If the source's own Unit Price cell is a real number (not a #REF!
    formula error), we use exactly that recorded price/revenue
    (price_source = 'recorded') -- a handful of rows in the sheet do have
    a working price despite most of August being broken.
  - Otherwise, for any row that maps to a current menu item, we reconstruct
    the price from today's app price (price_source = 'reconstructed'),
    per the same owner-approved rule used for the Aug 3-6 rows in Round 14.
  - Otherwise (no current-menu match), price/revenue stay null
    (price_source = 'unknown').

Matching rules are unchanged from Round 14: only map a historical name to a
current menu_items.code when it's unambiguous. Genuinely ambiguous or
discontinued items (e.g. "Momo" -- Veg or Chicken?, "Coke" vs "Crispy
Coke", "Latte" variants beyond Hazelnut) are imported with
menu_item_code = null rather than guessed, and show in the app as
"no longer on the menu."
"""
import csv
import json
from datetime import datetime

SRC = "/tmp/sheet_csv.csv"

# Same menu snapshot as Round 14's build_import.py (supabase/seed.sql prices).
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

# Round 14's mapping (unchanged) plus every new name found in Aug 7-31.
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
    # --- new names first seen in Aug 7-31 ---
    "Black Coffee Iced": "C-BLC1",
    "Black Tea Iced": "T-BLT1",
    "Butterfly Pea Tea": "T-BPT0",         # no hot/cold given -> default Hot (same convention as plain "Masala Tea")
    "Butterfly Pea Tea Hot": "T-BPT0",
    "Cappuccino Iced": "C-CPN1",
    "Chicken Masala Sandwich": None,        # distinct named dish, not today's "Chicken Sandwich" -- don't guess
    "Cocoa Hot": "C-CCA0",
    "Ginger Lemon Tea Iced": "T-GLT1",
    "Latte Hot": "C-HZL0",                  # Hazelnut Latte is the only latte on the menu, same pattern as "Hazelnut Latte Hot"
    "Lemon Soda": None,                     # no plain "Lemon Soda" on today's menu -- distinct from Strawberry Lemon Soda etc.
    "Mango Passion Soda": "SO-MPS",
    "Masala Coke": None,                    # not the same drink as "Crispy Coke"
    "Momo": None,                           # ambiguous -- Veg Momo or Chicken Momo, no signal to pick one
    "Soda": None,                           # too generic -- 6 different sodas on the menu
    "Spicy Chicken Burger": "B-SCB",
    "Thai Chilli - Chicken": None,          # not on today's menu
    "Thai Chilli - Mushroom": None,
}


def sql_str(s):
    if s is None:
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


def sql_num(n):
    if n is None:
        return "null"
    return str(n)


def is_real_number(s):
    if not s:
        return False
    s = s.strip().replace(",", "")
    try:
        float(s)
        return True
    except ValueError:
        return False


def parse_rows():
    with open(SRC, newline="") as f:
        reader = list(csv.reader(f))

    rows = []
    last_date = None
    for r in reader:
        if len(r) < 12:
            continue
        date_s, item, qty_s, price_s, rev_s, mode = r[6], r[7], r[8], r[9], r[10], r[11]
        if date_s.strip():
            last_date = date_s.strip()
        item = item.strip()
        if not item:
            continue
        if item.lower() in ("item name",):
            continue
        if item.lower() == "total":
            continue
        qty_s = qty_s.strip()
        if not qty_s or not qty_s.replace(".", "", 1).isdigit():
            continue
        qty = int(float(qty_s))
        try:
            d = datetime.strptime(last_date, "%d/%m/%Y").date().isoformat()
        except Exception:
            raise SystemExit(f"Unparsed date near row with item {item!r}: raw={last_date!r}")
        if d < "2026-08-07":
            continue  # already imported in Round 14 (source_row_id 1-457)
        rows.append({
            "date": d,
            "item_name": item,
            "quantity": qty,
            "price_raw": price_s.strip(),
            "revenue_raw": rev_s.strip(),
            "mode": mode.strip() or None,
        })
    return rows


def check_coverage(rows):
    names = set(r["item_name"] for r in rows)
    missing = names - set(MAPPING.keys())
    if missing:
        raise SystemExit(f"MAPPING is missing {len(missing)} names: {sorted(missing)}")
    unknown_codes = {v for v in MAPPING.values() if v is not None} - set(MENU.keys())
    if unknown_codes:
        raise SystemExit(f"MAPPING references codes not in MENU: {unknown_codes}")
    print(f"Coverage OK: {len(names)} distinct names in Aug 7-31, all mapped.")


def build_sql_rows(rows):
    out = []
    for r in rows:
        code = MAPPING[r["item_name"]]
        if is_real_number(r["price_raw"]):
            price = float(r["price_raw"].replace(",", ""))
            revenue = float(r["revenue_raw"].replace(",", "")) if is_real_number(r["revenue_raw"]) else round(price * r["quantity"], 2)
            source = "recorded"
        elif code is not None:
            price = MENU[code][2]
            revenue = round(price * r["quantity"], 2)
            source = "reconstructed"
        else:
            price = None
            revenue = None
            source = "unknown"
        out.append((r["date"], r["item_name"], code, r["quantity"], price, revenue, source, r["mode"]))
    return out


def main():
    rows = parse_rows()
    print(f"Parsed {len(rows)} rows for 2026-08-07..2026-08-31")
    check_coverage(rows)
    built = build_sql_rows(rows)

    matched = sum(1 for r in built if r[2] is not None)
    recorded = sum(1 for r in built if r[6] == "recorded")
    reconstructed = sum(1 for r in built if r[6] == "reconstructed")
    unknown = sum(1 for r in built if r[6] == "unknown")
    total_qty = sum(r[3] for r in built)
    total_rev = sum(r[5] or 0 for r in built)
    print(f"{len(built)} rows total ({matched} matched to a current menu item, {len(built)-matched} unmatched/off-menu)")
    print(f"price_source: recorded={recorded}, reconstructed={reconstructed}, unknown={unknown}")
    print(f"total quantity: {total_qty}, total revenue (recorded+reconstructed): {total_rev:.2f}")

    START_ID = 458
    lines = []
    lines.append("-- Round 16 addition to historical_sales_import.sql: 2026-08-07 through")
    lines.append("-- 2026-08-31 (the rest of August; 08-03..08-06 were already imported as")
    lines.append("-- source_row_id 1-457). Generated by scripts/historical/build_import_round16.py --")
    lines.append("-- see that file's docstring for the full pricing methodology")
    lines.append("-- (recorded where the sheet had a real price, reconstructed from today's")
    lines.append("-- app price where it didn't, null/unknown where there's no current-menu")
    lines.append("-- match to reconstruct from). Paste this AFTER historical_sales_import.sql")
    lines.append("-- has already been applied once. Safe to re-run (on conflict do nothing).")
    lines.append(f"-- {len(built)} rows ({matched} matched to a current menu item, {len(built)-matched} kept as off-menu).")
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

    with open("/root/work/cafe-tan90-ordering/supabase/historical_sales_import_round16.sql", "w") as f:
        f.write("\n".join(lines))
    print("Wrote supabase/historical_sales_import_round16.sql")


if __name__ == "__main__":
    main()
