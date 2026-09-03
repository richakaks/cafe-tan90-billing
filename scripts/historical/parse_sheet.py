import re, json, sys
from datetime import datetime

SRC = "/tmp/sheet_raw.txt"

def clean_cell(s):
    s = s.strip()
    # unescape markdown escapes like \! \# \-
    s = re.sub(r'\\(.)', r'\1', s)
    return s

def split_row(line):
    line = line.rstrip("\n")
    if not line.startswith("|"):
        return None
    parts = line.split("|")
    # drop first (before leading |) and last (after trailing |) empty strings
    if parts and parts[0].strip() == "":
        parts = parts[1:]
    if parts and parts[-1].strip() == "":
        parts = parts[:-1]
    return [clean_cell(p) for p in parts]

with open(SRC) as f:
    lines = f.readlines()

# ---------- 1) Clean consolidated table: lines 355-709 (1-indexed) ----------
clean_rows = []
last_date = None
for i in range(354, 709):  # 0-indexed 354..708 == 1-indexed 355..709
    line = lines[i]
    cells = split_row(line)
    if not cells:
        continue
    if len(cells) < 5:
        continue
    date_s, item, qty_s, price_s, rev_s = cells[0], cells[1], cells[2], cells[3], cells[4]
    cash = cells[5] if len(cells) > 5 else ""
    voucher = cells[6] if len(cells) > 6 else ""
    if date_s:
        last_date = date_s
    if not item:
        continue
    if item.lower() in ("item name",) or "grand total" in item.lower():
        continue
    if not qty_s or not qty_s.replace(".", "", 1).isdigit():
        continue
    try:
        qty = int(float(qty_s))
        price = float(price_s) if price_s else None
        rev = float(rev_s) if rev_s else None
    except ValueError:
        continue
    # parse date like "27-May-2026"
    try:
        d = datetime.strptime(last_date, "%d-%b-%Y").date().isoformat()
    except Exception:
        try:
            d = datetime.strptime(last_date, "%d/%m/%Y").date().isoformat()
        except Exception:
            d = None
    clean_rows.append({
        "date": d,
        "raw_date": last_date,
        "item_name": item,
        "quantity": qty,
        "unit_price": price,
        "total_revenue": rev,
        "cash": cash or None,
        "voucher": voucher or None,
    })

# ---------- 2) August block: lines 97-201, columns idx6..11 ----------
august_rows = []
last_aug_date = None
for i in range(96, 201):  # 0-indexed 96..200 == 1-indexed 97..201
    line = lines[i]
    cells = split_row(line)
    if not cells or len(cells) < 12:
        continue
    date_s, item, qty_s = cells[6], cells[7], cells[8]
    mode = cells[11] if len(cells) > 11 else ""
    if date_s:
        last_aug_date = date_s
    if not item:
        continue
    if item.lower() in ("item name",):
        continue
    if not qty_s or not qty_s.replace(".", "", 1).isdigit():
        continue
    qty = int(float(qty_s))
    try:
        d = datetime.strptime(last_aug_date, "%d/%m/%Y").date().isoformat()
    except Exception:
        d = None
    august_rows.append({
        "date": d,
        "raw_date": last_aug_date,
        "item_name": item,
        "quantity": qty,
        "mode": mode or None,
    })

print("clean_rows:", len(clean_rows), "sum qty:", sum(r["quantity"] for r in clean_rows), "sum rev:", round(sum(r["total_revenue"] or 0 for r in clean_rows),2))
print("august_rows:", len(august_rows), "sum qty:", sum(r["quantity"] for r in august_rows))

with open("/root/work/cafe-tan90-ordering/scripts/historical/clean_rows.json", "w") as f:
    json.dump(clean_rows, f, indent=1, ensure_ascii=False)
with open("/root/work/cafe-tan90-ordering/scripts/historical/august_rows.json", "w") as f:
    json.dump(august_rows, f, indent=1, ensure_ascii=False)
