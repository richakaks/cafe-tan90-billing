"""
One-time build script for the historical sales import.

Reads the two parsed JSON files (clean_rows.json = the complete 27-May-2026
through 7-Jul-2026 line-item table; august_rows.json = the August block,
which only has date/item/quantity because its price columns are broken
#REF! formulas in the source sheet) and produces a single SQL file
(supabase/historical_sales_import.sql) with one INSERT per source row into
the new historical_sales table.

Matching rules (see MAPPING below): every historical item name is mapped to
either a current menu_items.code, or to None when there's no reasonable
match (item no longer sold, or genuinely ambiguous between two current
items/variants — in that case we do NOT guess, we leave it unmatched rather
than risk misattributing revenue to the wrong SKU). Unmatched rows are
still imported — every row from the source is imported — just with
menu_item_code = null, which the app displays as "no longer on the menu".

Pricing:
  - May/Jun/Jul rows carry their own real recorded unit_price/total_revenue
    from the sheet — we keep those exactly as recorded (price_source =
    'recorded'), since that's more accurate than today's price.
  - August rows have no usable price in the source (#REF! errors). Per the
    owner's instruction, we reconstruct August's price using today's app
    price for any row that matched a current menu item (price_source =
    'reconstructed'). Unmatched August rows get null price and
    price_source = 'unknown' — there's no current price to reconstruct
    from and no recorded historical price either.
"""
import json
import re

CLEAN = json.load(open("/root/work/cafe-tan90-ordering/scripts/historical/clean_rows.json"))
AUGUST = json.load(open("/root/work/cafe-tan90-ordering/scripts/historical/august_rows.json"))

# Snapshot of the current menu (code, name, category, price) as of this
# import, pulled from supabase/seed.sql. Only used to (a) validate FK codes
# and (b) reconstruct August prices from "today's app price" per the
# owner's instruction.
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

# Every distinct historical item name -> current menu code, or None.
# None means: genuinely no reliable current-menu match (discontinued item,
# or ambiguous between >=2 current items/variants with no signal to break
# the tie) -- these are imported with menu_item_code = null and shown in
# the app as "no longer on the menu" rather than being skipped or guessed.
MAPPING = {
    "Masala Tea": "T-MST0",              # no hot/cold given -> default Hot (documented assumption)
    "Masala tea": "T-MST0",
    "Masala Tea Iced": "T-MST1",
    "Grilled Cheese Sandwich": "SD-GCS",
    "Chicken Burger": None,               # no plain "Chicken Burger" on today's menu; ambiguous which current burger this became
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
    "Chicken Katti Roll": None,            # no "Roll" category on today's menu
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
    "Fries": None,                          # too generic: 3 different fries on the menu
    "Cappucino": "C-CPN0",
    "Cappuccino": "C-CPN0",
    "Cappucino Hot": "C-CPN0",
    "Coke": None,                           # plain Coke can, distinct from the "Crispy Coke" mixed soda drink
    "Alfredo Pasta - Chicken": "SP-AWS1",
    "Alfredo Pasta": None,                  # Mushroom vs Chicken both cost the same -- no signal to pick one
    "Pasta": None,
    "Pasta White saucs": None,
    "Milk Coffee": None,                    # not on today's menu
    "Milk Coffee Iced": None,
    "Milk Tea": "T-TMT0",                   # taken as shorthand for Thai Milk Tea, Hot default
    "Milk Tea Iced": "T-TMT1",
    "Lychee Lemon Soda": "SO-LLS",
    "Passionfruit Iced Tea": "I-PIT",
    "Passion Fruit Iced Tea": "I-PIT",
    "Passion Iced Tea": "I-PIT",
    "Passion Lemon Iced tea": None,         # distinct blended flavor, not on today's menu
    "Mango passion Iced tea": None,
    "Muffin": None,
    "Black Tea Lemon": None,                # distinct flavor combo, not on today's menu
    "Lemon Tea Hot": None,                  # not specifically "Ginger Lemon Tea" -- too uncertain
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
}


def sql_str(s):
    if s is None:
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


def sql_num(n):
    if n is None:
        return "null"
    return str(n)


def check_coverage():
    names = set(r["item_name"] for r in CLEAN) | set(r["item_name"] for r in AUGUST)
    missing = names - set(MAPPING.keys())
    if missing:
        raise SystemExit(f"MAPPING is missing {len(missing)} names: {sorted(missing)}")
    unknown_codes = {v for v in MAPPING.values() if v is not None} - set(MENU.keys())
    if unknown_codes:
        raise SystemExit(f"MAPPING references codes not in MENU: {unknown_codes}")
    print(f"Coverage OK: {len(names)} distinct historical names, all mapped.")


def build_rows():
    rows = []  # each: (date, item_name, code, qty, unit_price, total_revenue, price_source, payment_note)

    for r in CLEAN:
        if r["date"] is None:
            raise SystemExit(f"Unparsed date for row: {r}")
        code = MAPPING[r["item_name"]]
        note = None
        parts = [p for p in (r.get("cash"), r.get("voucher")) if p]
        if parts:
            note = ", ".join(parts)
        rows.append((r["date"], r["item_name"], code, r["quantity"], r["unit_price"], r["total_revenue"], "recorded", note))

    for r in AUGUST:
        if r["date"] is None:
            raise SystemExit(f"Unparsed date for row: {r}")
        code = MAPPING[r["item_name"]]
        if code is not None:
            price = MENU[code][2]
            revenue = round(price * r["quantity"], 2)
            source = "reconstructed"
        else:
            price = None
            revenue = None
            source = "unknown"
        rows.append((r["date"], r["item_name"], code, r["quantity"], price, revenue, source, r.get("mode")))

    return rows


def main():
    check_coverage()
    rows = build_rows()

    matched = sum(1 for r in rows if r[2] is not None)
    unmatched = len(rows) - matched
    total_qty = sum(r[3] for r in rows)
    total_rev = sum(r[5] or 0 for r in rows)
    print(f"{len(rows)} rows total ({matched} matched to a current menu item, {unmatched} unmatched/off-menu)")
    print(f"total quantity: {total_qty}, total revenue (recorded + reconstructed): {total_rev:.2f}")

    out = []
    out.append("-- One-time historical sales import, generated by scripts/historical/build_import.py")
    out.append("-- from the owner's business-planning spreadsheet (27-May-2026 through 26-Aug-2026).")
    out.append("-- Paste this into the Supabase SQL editor ONCE, after schema.sql has been re-pasted")
    out.append("-- (schema.sql creates the historical_sales table this depends on). Safe to re-run:")
    out.append("-- every row carries a fixed source_row_id so re-pasting just no-ops on conflict.")
    out.append(f"-- {len(rows)} rows ({matched} matched to a current menu item, {unmatched} kept as off-menu).")
    out.append("insert into historical_sales")
    out.append("  (source_row_id, sale_date, item_name, menu_item_code, quantity, unit_price, total_revenue, price_source, payment_note)")
    out.append("values")
    value_lines = []
    for i, (date, name, code, qty, price, revenue, source, note) in enumerate(rows, start=1):
        value_lines.append(
            f"  ({i}, {sql_str(date)}, {sql_str(name)}, {sql_str(code)}, {qty}, {sql_num(price)}, {sql_num(revenue)}, {sql_str(source)}, {sql_str(note)})"
        )
    out.append(",\n".join(value_lines))
    out.append("on conflict (source_row_id) do nothing;")
    out.append("")

    with open("/root/work/cafe-tan90-ordering/supabase/historical_sales_import.sql", "w") as f:
        f.write("\n".join(out))
    print("Wrote supabase/historical_sales_import.sql")


if __name__ == "__main__":
    main()
