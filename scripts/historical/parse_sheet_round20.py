"""
Round 20: parses the "MONTHLY SUMMARY JULY" block (a full, real, row-level
table for 2026-07-01 through 2026-07-31) out of a fresh CSV export of the
owner's spreadsheet, and writes it to july_full.json.

Why this exists as a separate parse from Round 14's clean_rows.json: that
file came from a DIFFERENT table in the same spreadsheet -- a "clean
consolidated" table that, it turns out, was itself an incomplete manual
transcription stopping at 2026-07-07 (only 6 of that day's real 35 line
items made it in, and nothing from 07-08 onward was ever transcribed into
it). This script instead parses the spreadsheet's own "MONTHLY SUMMARY
JULY" section directly -- the same section that already fully backs the
May/June import and the August import (Round 14/16) -- which turns out to
have complete, real per-line data for the whole month, with real recorded
prices (unlike August, which has broken #REF! formulas). Verified against
the sheet's own printed totals: this parse's summed revenue (23,250.00)
and summed cash-flagged revenue (4,115.00) match the sheet's own "MONTHLY
SUMMARY JULY / Total sales" and "Cash Sales" cells exactly, and the
2026-07-01 through 2026-07-06 portion of this parse matches Round 14's
already-imported data item-for-item (same items, same order, same
prices) -- only 2026-07-07 onward is new.
"""
import csv
import json
from datetime import datetime

SRC = "/tmp/sheet_csv_new.csv"


def main():
    with open(SRC, newline="") as f:
        rows = list(csv.reader(f))

    # The "MONTHLY SUMMARY JULY" header sits at 0-indexed row 312; its own
    # "Date,Item Name,..." column header is the next row (313), so real data
    # starts at 314.
    assert rows[312][0].strip() == "MONTHLY SUMMARY JULY", f"unexpected row 313: {rows[312]}"
    assert rows[313][0].strip() == "Date", f"unexpected row 314: {rows[313]}"

    out = []
    last_date_raw = None
    for r in rows[314:]:
        date_s = (r[0] if len(r) > 0 else "").strip()
        item = (r[1] if len(r) > 1 else "").strip()
        qty_s = (r[2] if len(r) > 2 else "").strip()
        price_s = (r[3] if len(r) > 3 else "").strip()
        rev_s = (r[4] if len(r) > 4 else "").strip()
        note_s = (r[5] if len(r) > 5 else "").strip()
        if date_s:
            last_date_raw = date_s
        if not item:
            continue
        low = item.lower()
        if low in ("item name",):
            continue
        if "total" in low or low in ("weekend", "weekend+buddhist holiday"):
            continue
        if not qty_s.replace(".", "", 1).isdigit():
            continue
        qty = int(float(qty_s))
        price = float(price_s.replace(",", "")) if price_s else None
        rev = float(rev_s.replace(",", "")) if rev_s else None
        d = datetime.strptime(last_date_raw, "%d/%m/%Y").date().isoformat()
        out.append({
            "date": d,
            "raw_date": last_date_raw,
            "item_name": item,
            "quantity": qty,
            "unit_price": price,
            "total_revenue": rev,
            "note": note_s or None,
        })

    total_rev = round(sum(r["total_revenue"] or 0 for r in out), 2)
    cash_rev = round(sum(r["total_revenue"] or 0 for r in out if r["note"] and "cash" in r["note"].lower()), 2)
    dates = sorted(set(r["date"] for r in out))
    print(f"parsed {len(out)} rows, dates {dates[0]}..{dates[-1]} ({len(dates)} distinct sale days)")
    print(f"total revenue: {total_rev} (sheet's own July 'Total sales' cell: 23250.00)")
    print(f"cash-flagged revenue: {cash_rev} (sheet's own 'Cash Sales' cell: 4115.00)")
    assert total_rev == 23250.00, "total revenue does not reconcile with the sheet's own July total"
    assert cash_rev == 4115.00, "cash revenue does not reconcile with the sheet's own July cash total"

    with open("/root/work/cafe-tan90-ordering/scripts/historical/july_full.json", "w") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    print("Wrote scripts/historical/july_full.json")


if __name__ == "__main__":
    main()
