"""
September 2026 historical sales import (source: the owner's hand-corrected
"Cafe_Tan90_September_2026_Sales" Google Sheet, "Order Log (line items)" tab,
pulled into september_ledger_rows.json).

Rules (all decided to stay consistent with Rounds 14/16/20):

* One historical_sales row per ledger line. "x2"/"(x3)" etc. in the item name
  becomes quantity; unit_price = amount / quantity.
* total_revenue = the money actually collected for that line on that date, i.e.
  exactly what the owner's own per-day "Total" rows add up to (they exclude
  unpaid and coupon-paid amounts). Fully coupon-paid lines and unpaid lines are
  still imported (so item counts / cost of goods are right) but with
  total_revenue = 0 and price_source = 'unknown'.
* payment_note carries the owner's payment column: Online / Cash / Coupon, or a
  split like 'Online 30 / Cash 30'. Round 17's historical-cash FYI footnote
  keys off the word "cash" in this column, so cash rows are surfaced there too.
* menu_item_code uses the same "don't guess" discipline as before: a name is
  matched only when it unambiguously means one current menu item (plain
  hot/cold-less names default to Hot, same as Round 16). Genuinely ambiguous
  names (plain "Momo", "Alfredo", "Soda", "Butterfly pea tea" at a price that fits
  neither temperature, ...) stay NULL -> still counted as revenue, shown as
  off-menu / uncosted.
* source_row_id continues from 1279 (Round 20 ended at 1278).
* One deliberate omission: 2026-09-15 "Maggie" (unpaid, "paid next day") is NOT
  imported, because the 2026-09-16 "maggie (yesterday)" line is that same sale
  and carries the revenue -- importing both would double-count one Maggie.

The per-day check at the bottom reconciles every day against the owner's own
Total row and fails loudly if anything drifts.
"""
import json
import re
import sys
import collections

HERE = "/root/work/cafe-tan90-ordering/scripts/historical/"
START_ID = 1279

MENU_PRICE = {
    "SN-FRF": 45, "SN-PPF": 50, "SN-ZAF": 50, "SN-SMT": 35, "SN-MGN": 45, "SN-ECM": 65,
    "SN-CLN": 65, "M-VMM": 70, "M-CMM": 80, "SD-MUS": 55, "SD-GCS": 55, "SD-CHS": 60,
    "B-CVB": 55, "B-CCB": 60, "B-DTB": 75, "B-GCB": 65, "B-SCB": 65, "SP-AWS0": 65,
    "SP-AWS1": 65, "T-GLT0": 35, "T-GLT1": 45, "T-BLT0": 30, "T-BLT1": 40, "T-TMT0": 40,
    "T-TMT1": 45, "T-MST0": 35, "T-MST1": 45, "T-BPT0": 40, "T-BPT1": 50, "C-BLC0": 30,
    "C-BLC1": 40, "C-CPN0": 45, "C-CPN1": 55, "C-HZL0": 45, "C-HZL1": 55, "C-MCH0": 45,
    "C-MCH1": 55, "C-CCA0": 40, "C-CCA1": 50, "I-LIT": 45, "I-PIT": 45, "SO-SLS": 45,
    "SO-MPS": 45, "SO-MBS": 45, "SO-LLS": 45, "SO-BHS": 45, "SO-CRC": 45,
}

# key = normalized lowercase base name (see normalize()); value = (display name, code or None)
MAPPING = {
    "achar": ("Achar (extra sauce)", None),
    "alfredo": ("Alfredo", None),                              # owner's own note: "chicken or mushroom?" -- unresolved, don't guess
    "alfredo chicken": ("Spaghetti Alfredo (Chicken)", "SP-AWS1"),
    "alfredo mushroom": ("Spaghetti Alfredo (Mushroom)", "SP-AWS0"),
    "black coffee": ("Black Coffee", "C-BLC0"),                # no temperature given -> Hot (Round 16 convention; matches the ฿30 hot price)
    "black coffee hot": ("Black Coffee (Hot)", "C-BLC0"),
    "black coffee iced": ("Black Coffee (Iced)", "C-BLC1"),
    "iced black coffee": ("Black Coffee (Iced)", "C-BLC1"),
    "hot black coffee": ("Black Coffee (Hot)", "C-BLC0"),
    "hot black tea": ("Black Tea (Hot)", "T-BLT0"),
    "butterfly pea tea": ("Butterfly Pea Tea", None),          # owner's own note: hot or cold? ฿45 fits neither ฿40 hot nor ฿50 cold
    "chicken burger": ("Chicken Burger", None),                # not a current menu item name (Round 14 precedent)
    "chicken cheese burger": ("Chicken Cheese Burger", "B-CCB"),
    "chicken loaded nacho": ("Chicken Loaded Nachos", "SN-CLN"),
    "chicken loaded nachos": ("Chicken Loaded Nachos", "SN-CLN"),
    "chicken momo": ("Chicken Momo", "M-CMM"),
    "momo chicken": ("Chicken Momo", "M-CMM"),
    "momo (chicken)": ("Chicken Momo", "M-CMM"),
    "chicken san": ("Chicken Sandwich", "SD-CHS"),             # "san" = sandwich, written between two sandwich-size items on the 17th
    "chicken sandwich": ("Chicken Sandwich", "SD-CHS"),
    "chocolate mousse": ("Chocolate Mousse", None),            # not on the menu
    "chocolate mousse (big)": ("Chocolate Mousse (Big)", None),
    "chocolate mousse (small)": ("Chocolate Mousse (Small)", None),
    "chocolate mousse big": ("Chocolate Mousse (Big)", None),
    "chocolate mousse small": ("Chocolate Mousse (Small)", None),
    "cocoa hot": ("Cocoa (Hot)", "C-CCA0"),
    "hot cocoa": ("Cocoa (Hot)", "C-CCA0"),
    "iced cocoa": ("Cocoa (Iced)", "C-CCA1"),
    "coke": ("Coke", None),
    "double trouble burger": ("Double Trouble Burger", "B-DTB"),
    "extra cheese maggie": ("EXTRA CHEESY Maggie", "SN-ECM"),
    "extra cheesy maggie": ("EXTRA CHEESY Maggie", "SN-ECM"),
    "french fries": ("French Fries", "SN-FRF"),
    "ginger lemon tea": ("Ginger Lemon Tea", "T-GLT0"),
    "ginger-lemon tea": ("Ginger Lemon Tea", "T-GLT0"),
    "hot ginger lemon": ("Ginger Lemon Tea (Hot)", "T-GLT0"),
    "hot ginger lemon tea": ("Ginger Lemon Tea (Hot)", "T-GLT0"),
    "hot ginger-lemon tea": ("Ginger Lemon Tea (Hot)", "T-GLT0"),
    "ginger lemon tea (iced)": ("Ginger Lemon Tea (Iced)", "T-GLT1"),
    "iced ginger lemon tea": ("Ginger Lemon Tea (Iced)", "T-GLT1"),
    "gochujang burger": ("Gochujang Chicken Burger", "B-GCB"),
    "gochujang chicken burger": ("Gochujang Chicken Burger", "B-GCB"),
    "grilled cheese": ("Grilled Cheese Sandwich", "SD-GCS"),
    "grilled cheese sandwich": ("Grilled Cheese Sandwich", "SD-GCS"),
    "hazel latte iced": ("Hazelnut Latte (Iced)", "C-HZL1"),
    "iced hazel latte": ("Hazelnut Latte (Iced)", "C-HZL1"),
    "hazelnut latte iced": ("Hazelnut Latte (Iced)", "C-HZL1"),
    "iced hazelnut": ("Hazelnut Latte (Iced)", "C-HZL1"),
    "iced hazelnut latte": ("Hazelnut Latte (Iced)", "C-HZL1"),
    "hazelnut latte hot": ("Hazelnut Latte (Hot)", "C-HZL0"),
    "hot hazelnut latte": ("Hazelnut Latte (Hot)", "C-HZL0"),
    "hot cappuccino": ("Cappuccino (Hot)", "C-CPN0"),
    "iced cappuccino": ("Cappuccino (Iced)", "C-CPN1"),
    "hot masala tea": ("Masala Tea (Hot)", "T-MST0"),
    "iced masala tea": ("Masala Tea (Iced)", "T-MST1"),
    "hot mocha": ("Mocha (Hot)", "C-MCH0"),
    "iced mocha": ("Mocha (Iced)", "C-MCH1"),
    "mocha iced": ("Mocha (Iced)", "C-MCH1"),
    "hot thai milk tea": ("Thai Milk Tea (Hot)", "T-TMT0"),
    "hot thai tea": ("Thai Milk Tea (Hot)", "T-TMT0"),
    "thai milk tea hot": ("Thai Milk Tea (Hot)", "T-TMT0"),
    "thai milk tea": ("Thai Milk Tea", "T-TMT0"),              # no temperature given -> Hot (Round 16 convention)
    "iced thai milk tea": ("Thai Milk Tea (Iced)", "T-TMT1"),
    "iced thai tea": ("Thai Milk Tea (Iced)", "T-TMT1"),
    "thai milk tea iced": ("Thai Milk Tea (Iced)", "T-TMT1"),
    "iced honey lemon tea": ("Honey Lemon Tea (Iced)", None), # owner's own note: "supposed to be ginger lemon iced tea??" -- unresolved
    "lemon iced tea": ("Lemon Iced Tea", "I-LIT"),
    "lemon soda": ("Lemon Soda", None),                        # owner's own note: "strawberry lemon soda?" -- unresolved, same as Round 16
    "lemon tea": ("Lemon Tea", None),                          # Round 16 precedent
    "lychee lemon soda": ("Lychee Lemon Soda", "SO-LLS"),
    "maggie": ("Maggie", "SN-MGN"),
    "mango passion fruit iced tea": ("Mango Passion Fruit Iced Tea", None),  # Round 16 precedent
    "masala coke": ("Masala Coke", None),
    "mixed berry soda": ("Mixed Berry Soda", "SO-MBS"),
    "momo": ("Momo", None),                                    # ambiguous Veg vs Chicken -- Round 16 rule: don't guess
    "mushroom sandwich": ("Mushroom Sandwich", "SD-MUS"),
    "passion fruit": ("Passion Fruit", None),                  # Round 20 precedent: ambiguous
    "passion fruit iced tea": ("Passionfruit Iced Tea", "I-PIT"),
    "passionfruit iced tea": ("Passionfruit Iced Tea", "I-PIT"),
    "peri peri": ("Peri-Peri Fries", "SN-PPF"),                # only Peri-Peri item on the menu
    "peri peri fries": ("Peri-Peri Fries", "SN-PPF"),
    "samosa": ("Samosa", "SN-SMT"),
    "soda": ("Soda", None),                                    # too generic (6 sodas on the menu)
    "spicy chicken burger": ("Spicy Chicken Burger", "B-SCB"),
    "spicy chicken cheese burger": ("Spicy Chicken Cheese Burger", None),  # not the same name as either neighbouring menu item
    "strawberry lemon soda": ("Strawberry Lemon Soda", "SO-SLS"),
    "veg momo": ("Veg Momo", "M-VMM"),
    "water": ("Water", None),
    "zab fries": ("Zab Fries", "SN-ZAF"),
}

# Hand-checked per-row overrides keyed by the source sheet's row number.
QTY_OVERRIDE = {
    121: 2,   # 'Hazelnut latte iced (9)' ฿110 = 2 x ฿55 -- '(9)' is a stray mark, not a quantity of 9
    # Below: no quantity written, but the amount is an exact multiple of the item's price and
    # the owner's own sheet notes ask "did they order two? 'x2' missing in the picture".
    # Quantity inferred from the amount (flagged in the hand-off message so it can be corrected).
    494: 2,   # 'Iced Thai tea' ฿90 = 2 x ฿45
    606: 2,   # 'Hot Hazelnut latte' ฿90 = 2 x ฿45
    416: 3,   # 'Momo chicken' ฿240 = 3 x ฿80
}
SKIP_ROWS = {
    313: "2026-09-15 unpaid Maggie, 'paid next day (16/09/2026)' -- the 16th's 'maggie (yesterday)' line is the same sale",
}
SPLIT_NOTE = {   # rows paid with two methods; parsed by hand from the sheet's own note
    44: "Online 30 / Cash 30",
    319: "Online 20 / Cash 20",
    415: "Cash 5 / Coupon 75",
    192: "Online 5 / Coupon 75",
}


def normalize(raw):
    s = raw.strip()
    s = re.sub(r"\s*--\s*see 'Receipt to Student Union'", "", s)
    qty = 1
    m = re.search(r"\(?\s*x\s*(\d+)\s*\)?", s, re.I)
    if m:
        qty = int(m.group(1))
        s = s[:m.start()] + " " + s[m.end():]
    else:
        m = re.search(r"\((\d+)\)", s)
        if m:
            qty = int(m.group(1))
            s = s[:m.start()] + " " + s[m.end():]
    s = re.sub(r"\(?\b(takeaway|take away|TA|yesterday)\b\)?", " ", s, flags=re.I)
    s = re.sub(r",\s*(less ice|no sugar)", " ", s, flags=re.I)
    s = re.sub(r"\((less sweet|low sugar|less ice|no sugar)\)", " ", s, flags=re.I)
    s = s.replace(",", " ")
    s = re.sub(r"\s+", " ", s)
    return s.strip().lower(), qty


def sql_str(s):
    if s is None:
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


def sql_num(n):
    if n is None:
        return "null"
    return repr(round(float(n), 2))


def build():
    src = json.load(open(HERE + "september_ledger_rows.json"))
    out, skipped, day_checks = [], [], []
    cur_day_rows = []
    last_date = None
    for rownum, d, dd, item, pt, amt, note in src:
        if d:
            last_date = d
        if pt == "Total":
            day_checks.append((cur_day_rows, amt, note))
            cur_day_rows = []
            continue
        if not item:
            continue
        if rownum in SKIP_ROWS:
            skipped.append((rownum, item, SKIP_ROWS[rownum]))
            continue
        base, qty = normalize(item)
        qty = QTY_OVERRIDE.get(rownum, qty)
        if base not in MAPPING:
            raise SystemExit(f"row {rownum}: no MAPPING for {item!r} -> {base!r}")
        name, code = MAPPING[base]
        date = (d or last_date)[:10]   # a few rows have a blank date cell; they belong to the day block they sit in
        amt_f = float(amt) if amt is not None else None

        # --- payment + revenue
        low_note = (note or "")
        if rownum in SPLIT_NOTE:
            pay = SPLIT_NOTE[rownum]
            revenue = amt_f
        elif amt_f is None and pt != "Coupon":
            # A line with no amount of its own: the bill's money sits on an adjacent line
            # (the sheet's own notes say e.g. "combined total for the pair"). Counted as an
            # item, revenue 0 here so nothing is double counted.
            pay = (pt + " " if pt else "") + "(billed together with adjacent line)"
            revenue = 0.0
        elif pt == "Coupon":
            pay, revenue = "Coupon", 0.0
        elif pt is None:
            pay, revenue = "Unpaid", 0.0
        elif pt == "Unclear":
            pay, revenue = "Student Union group bill (475 total)", amt_f
        else:
            pay, revenue = pt, amt_f
            if "coupon" in low_note.lower():
                pay += f" (net of coupon: {low_note.strip()})"
        if pt == "Coupon" or pt is None or amt_f is None:
            unit, psrc = None, "unknown"
        else:
            unit, psrc = round(revenue / qty, 2), "recorded"
        out.append(dict(row=rownum, date=date, name=name, code=code, qty=qty, unit=unit,
                        revenue=revenue, psrc=psrc, pay=pay, raw=item, pt=pt))
        cur_day_rows.append(out[-1])
    return out, skipped, day_checks


def reconcile(out, day_checks):
    """Each day's imported revenue must equal the owner's own Total row (minus the
    one skipped unpaid Maggie, which is revenue-neutral)."""
    ok = True
    for rows, total, note in day_checks:
        got = sum(r["revenue"] or 0 for r in rows)
        date = rows[0]["date"]
        status = "OK " if abs(got - total) < 0.01 else "DIFF"
        if status == "DIFF":
            ok = False
        print(f"  {status} {date}: imported revenue {got:>8.2f} vs sheet Total row {total:>8}")
    return ok


def main():
    out, skipped, day_checks = build()
    print(f"{len(out)} rows built, {len(skipped)} deliberately skipped: {skipped}")
    print("Per-day reconciliation against the sheet's own Total rows:")
    ok = reconcile(out, day_checks)

    # price sanity: flag matched rows whose per-unit price differs from the menu price
    off = [r for r in out if r["code"] and r["unit"] is not None and abs(r["unit"] - MENU_PRICE[r["code"]]) > 0.01]
    print(f"\n{len(off)} matched rows whose recorded unit price differs from today's menu price:")
    for r in off:
        print(f"   row {r['row']} {r['date']} {r['raw']!r}: {r['unit']} vs menu {MENU_PRICE[r['code']]} ({r['code']})  [{r['pay']}]")

    matched = [r for r in out if r["code"]]
    print(f"\nmatched {len(matched)} / {len(out)}; unmatched revenue "
          f"{sum(r['revenue'] or 0 for r in out if not r['code']):.2f}")
    print(f"total quantity {sum(r['qty'] for r in out)}, total revenue {sum(r['revenue'] or 0 for r in out):.2f}")
    unm = collections.Counter(r["name"] for r in out if not r["code"])
    print("unmatched names:", dict(unm))
    if "--check" in sys.argv:
        return

    lines = [
        "-- September 2026 historical sales (owner's hand-checked ledger).",
        "-- Generated by scripts/historical/build_import_september.py -- see that file's",
        "-- docstring for every rule. source_row_id continues from 1279 (Round 20 ended at 1278).",
        "-- Safe to re-run: source_row_id is fixed per row, so on conflict do nothing.",
        "-- Nothing here touches orders / order_items / stock.",
        "insert into historical_sales",
        "  (source_row_id, sale_date, item_name, menu_item_code, quantity, unit_price, total_revenue, price_source, payment_note)",
        "values",
    ]
    vals = []
    for n, r in enumerate(out):
        vals.append("  (%d, %s, %s, %s, %d, %s, %s, %s, %s)" % (
            START_ID + n, sql_str(r["date"]), sql_str(r["name"]), sql_str(r["code"]), r["qty"],
            sql_num(r["unit"]), sql_num(r["revenue"]), sql_str(r["psrc"]), sql_str(r["pay"])))
    lines.append(",\n".join(vals))
    lines.append("on conflict (source_row_id) do nothing;")
    path = "/root/work/cafe-tan90-ordering/supabase/historical_sales_import_september.sql"
    open(path, "w").write("\n".join(lines) + "\n")
    print(f"\nwrote {path} ({START_ID}..{START_ID + len(out) - 1})")
    if not ok:
        print("WARNING: some days did not reconcile -- review above")


if __name__ == "__main__":
    main()
