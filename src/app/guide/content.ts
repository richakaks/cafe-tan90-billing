// Round 41: the staff guide text (same as the shared "Cafe Tan90 — Staff Guidebook" doc).
// Edit here when a screen changes. Rendered by render.tsx.
export const GUIDE_MD = `## 1. Getting started

This guide lists every button in the system, page by page, with real examples in section 17. Words in **bold** are exactly what you see on the screen.

**Where things are — the one rule to remember:** anything you want to *change* about an order (items, payments, coupons, discount, void) is done on the **Counter** page by tapping the order. The Serving Screen and Billing are only for serving and getting paid.

**Logging in.** Open the site and tap any page; it asks for the staff **PIN**. You stay logged in for 12 hours. If a page says "Your staff login has expired", log in again — orders saved on the tablet are kept and sent afterwards. **Log out** is at the top right.

**Your name.** At the top of the Counter page, pick your name in **Taking orders as**. The tablet remembers it. Every order, payment, refund, coupon, edit and void is saved under that name, and Billing, Purchases and Cash use the same name.

**Edit names** (next to the name box) opens **Staff names**:
- **Add** — type a new name in **New name** and tap Add.
- **Rename** — fix a spelling; old orders show the new spelling.
- **Remove** — hides someone who left (their old orders keep their name).
- **Bring back** — shows a removed name again.
- **Close** — back to the counter.

**The pages** (top menu; on a phone swipe the row of tabs sideways):

| Page | Who | What it is for |
| --- | --- | --- |
| Counter | Staff | Take orders, take payment, give change, fix any order |
| Serve | Staff | Kitchen/handover list; mark orders served; pre-order pickups |
| Billing | Staff | Get paid for served bills that are still unpaid |
| Purchases | Staff | Record everything bought for the cafe |
| Cash | Staff | Count the drawer at opening and closing |
| Menu | Owner | Items, prices, photos, recipes |
| Inventory | Owner | Stock levels, stock switches, stock count |
| Coupons | Owner | Coupon batches, expiry, coupon lookup |
| Sales & Analytics | Owner | Sales reports and exports |
| Guide | Everyone | This guide |

**Badges on orders:** **QR** (yellow) = the customer ordered by scanning the table code · **COUNTER** (green) = staff took it · **TRIAL** (orange) = practice order, never counted · **Pending** = saved on the tablet, not sent yet.

**Stock alert.** When something is running low, a **Stock alert** box appears under the top menu listing items marked **Buy soon** (with roughly how many days are left) or **Can wait** (not sold in 30 days). **Go to inventory** jumps to the item; **OK** hides the alert until something new runs low.

**Phone and iPad.** On an iPad the counter shows the menu and the order side by side, and the order panel stays on screen while you scroll. On a phone the order panel is below the menu — tap the dark **Go to order ↓** bar at the bottom.

## 2. Counter page — every control, top to bottom

The Counter page is where orders are taken and where every existing order is opened and fixed.

**Top bar**
- **Taking orders as** — your name (section 1). The order button won't work until a name is picked.
- **Edit names** — add, rename or remove staff.
- **● Online** (green) / **Offline — orders are saved on this tablet** (red) — the connection. **N waiting to send** shows how many offline orders are queued.
- **Counter orders take stock off: ON/OFF** — owner switch (section 12). **settings** opens it on Inventory.

**Trial box** — "Want to practise?" → **Trial order** turns trial mode on (box turns orange, button becomes **Place TRIAL order**). **Turn trial mode off** goes back to real orders. Trial orders can't be pre-orders and can't use real coupon codes.

**Menu (left)**
- Category chips (**All**, Snacks, Momo, Sandwich, Burger, Spaghetti, Tea, Coffee, Iced Tea, Soda, Other Drinks, Dessert) filter the tiles.
- Each tile adds one of that item. The dark circle on a tile shows how many are in the current order.

**Order panel (right)**

| Control | What it does |
| --- | --- |
| **New order** / **Editing #12** | Title. It says Editing when you are changing an existing order (section 6) |
| **Now** / **Pre-order** | Now = normal order. Pre-order = pickup later; shows **Pickup date** and **Pickup time** |
| **−** / **+** | Change how many of that line |
| **Takeaway** (tick) | That line leaves the cafe (takeaway box, cup, cutlery are counted for stock) |
| **Add note** | A note for the kitchen on that line, e.g. "less sweet", "no onion". Shows as **Note: …** |
| **Customer / group name** | Optional label, e.g. "Ploy", "Table by window", "Grab #A12". Helps find the order and groups it on Billing |
| **Discount** **%** / **฿** + **Why?** | Percent or baht off the whole order, with an optional reason |
| **Coupons** | Coupon code → **Add**, or **No code? Amount off ฿** → **Code later** (section 4) |
| **Items / Discount / Coupons / To pay** | The running bill |
| **Payment** | **Cash**, **Online**, **Split**, **Pay later** (pre-orders: **Paid now (deposit)** and **At pickup**) — section 3 |
| **Customer gave** | Quick note buttons for change (section 3) |
| **Place order · ฿X** | Sends it to the kitchen. Pre-order: **Book pre-order**. Trial: **Place TRIAL order**. Editing: **Save changes** |
| **Clear** / **Cancel** | Empties the panel without saving (Cancel when editing) |
| **Recorded as taken by …** | Who the order will be saved under |

After **Place order** a dark message at the top says **Order #12 saved** (with any warning, e.g. "stock ran short"), and a green **Give change ฿X** banner appears if change is due.

## 3. Taking payment and giving change

Change is worked out for you: tap the note the customer handed over and the screen says how much to give back. Only the bill is recorded as cash, so the drawer stays right.

| Choice | When | What gets recorded |
| --- | --- | --- |
| **Cash** | Customer pays cash now | The bill, as cash (plus what they handed over and the change) |
| **Online** | Transfer / QR payment now | The bill, as online |
| **Split** | Part cash, part online | Cash part + online part |
| **Pay later** | They'll pay after eating, or a tab | Nothing yet — the order shows **Owes ฿X** |
| **Paid now (deposit)** (pre-order) | Booking a pre-order: the same Cash / Online / Split buttons take a deposit (or the full amount) | The deposit; the rest shows as owed until pickup |
| **At pickup** (pre-order) | Pre-order paid when they collect | Nothing yet |

**Customer gave** (shows under Cash, and under Split for the cash part):
- **Exact ฿65** — they gave the exact amount; no change.
- Next round notes (**฿100**, **฿500**, **฿1,000**; for small bills also ฿50) — tap the note they handed you.
- **Other ฿** — type any amount, e.g. 120 for a ฿100 note and a ฿20 note.
- Tap the same button again to clear it. Leaving it empty = exact amount.
- If they give *less* than the bill, it says "฿X short — only ฿Y is recorded; the rest stays owed". The order then shows **Owes**.

**Give change banner** — after saving, a large green **Give change ฿X** stays at the top until you tap **Done**, so you can send the order first and count the change after.

Example: bill ฿65, customer hands over ฿100 → tap **฿100** → **Place order** → banner says **Give change ฿35**. The drawer gets ฿65; the Cash page shows +฿100 handed over and −฿35 change.

Example (split): bill ฿120, ฿50 cash + rest by transfer → **Split** → Cash ฿ **50** (Online fills in **70**) → they paid the ฿50 with a ฿100 note → tap **฿100** under **Customer gave for the cash part** → change ฿50.

**Refund is different from change.** A refund is money given back *after* the sale (wrong item, cancelled extra). It is done on the order card with **Give money back (refund)…** (section 5) and comes out of the drawer.

## 4. Coupons and discounts

A coupon works like a gift card: it pays the bill up to what's left on it, and anything left stays on the same code for next time.

**Where you can add a coupon**

| Where | How |
| --- | --- |
| New order on the Counter | **Coupons** → type the code → **Add** (or press Enter) |
| An order already placed | Open the order → **Add coupon** |
| A bill on Billing | Under the order → **Coupon** |

**What the coupon line shows (new order):** e.g. **C75 −฿55 · ฿20 stays on it · use only [ ]** and **remove**. When nothing is left it says **used up**.

**Using only part of it** — the customer wants to save some for next time: type the amount in **use only** (Counter) or tick **Use only part of it** and type it in **Use ฿** (order card / Billing).

**No code on hand** (customer forgot the coupon, or it is unreadable) — record the amount taken off now:
- New order: **No code? Amount off ฿** → **Code later**.
- Order card / Billing: **Amount off ฿** → **Add as "code pending"**.
- The order shows **Coupon code pending** and appears in **Still owing or coupon code missing**. When the code turns up, type it in the yellow box **Code for the coupon that took ฿X off** → **Save code**. That amount then comes off the coupon.

**When a code is refused** (the message says why):
- **isn't in the system** — typo, or the batch wasn't recorded on the Coupons page. Check the code; if it's right, use code pending and tell the owner.
- **is used up (nothing left on it)** — all its value was spent.
- **expired on …** — past its Expires on date.
- **only has ฿X left** — when saving a pending code: the coupon had less left than was taken off. It stays on the to-fix list for the owner.
- **The bill is already fully covered** — nothing left for a coupon to pay.

Trial orders can't use real codes (that would spend real coupon money); practise with code pending.

**Discounts**
- New order: **Discount** → **%** or **฿** → amount → **Why?** (optional reason).
- Order already placed: counter orders → **Edit order** and change the discount; QR orders → **Discount** on the order card.
- Billing: **Discount** under the order → **% off** / **฿ off** → amount → **Reason (required)** → **Save discount**. **Remove discount** takes it off.
- A percent discount is taken off before coupons. If a bigger discount makes coupons worth more than the bill, the coupon amount shrinks and the difference goes back on the coupon.

## 5. The order card — every button

Every order on the Counter page (today's list, pre-orders, still owing, trial) is a card. Tap the card to open it; tap again to close.

**Closed card shows:** order number (or **Pickup** date for a pre-order, **Pending** if not sent yet), QR / COUNTER / TRIAL badge, time, customer name or table, the bill, and its state: **Pre-order**, **In kitchen**, **Served**, **Paid** or **Void**. Red **Owes ฿X** = money still due; **Overpaid ฿X** = more was recorded than the bill; **Coupon code pending** = a coupon without its code.

**Open card shows:** every item (with **Takeaway** and notes), Items, Discount (with reason), each coupon, **To pay**, and **Taken by** (who took the order).

| Button | What it does | Shown on |
| --- | --- | --- |
| **Payment / refund** | Take a payment, split, refund, or remove a wrong payment (below) | All orders |
| **Add coupon** | Add a coupon or a code-pending amount (section 4) | All orders |
| **Discount** | % or ฿ off with a reason; **Remove discount** | QR orders (counter orders change it in Edit) |
| **Edit order** | Change items, quantities, takeaway, notes, name, discount, pickup time (section 6) | Counter orders |
| **Void** | Cancel the order with a reason. It stops counting in sales; coupon money and stock go back; its payments stop counting in the drawer. It stays in History | All orders |
| **History** | Every change with time and who did it: created, edited, payment, refund, payment removed, coupon added, coupon resolved, discount changed, voided | All orders |
| **Save code** (yellow box) | Type the code for a code-pending coupon | Orders with code pending |
| **Delete for good** | Removes a voided order completely, including its history. Asks to confirm; can't be undone. Use for test orders | Voided orders only |

**Inside Payment / refund**
- **Recorded so far** — every payment and refund on this order, with date and who. **remove** deletes a wrong line (asks to confirm; it shows in History).
- **Cash / Online / Split** — how this payment came in.
- **Amount to record ฿** — filled in with what is still owed; change it for a part payment.
- **Customer gave** — quick notes for change (section 3).
- Date box — the day the money changed hands; it counts in that day's drawer. Change it only when recording yesterday's payment late.
- **Note (optional)** — e.g. "paid by friend".
- **Record payment** / **Record split · ฿X**.
- **Give money back (refund)…** — switches the panel to red refund mode: pick **Cash** or **Online**, type the **Refund amount ฿**, tap **Record refund**. **Back to taking a payment** switches back.

When the owner has locked a day, its orders show "This day is locked — unlock it on the summary to change orders" and the buttons are greyed out. Buttons are also greyed out while offline.

## 6. Editing an order that was already placed

Yes, a counter order can be changed after it is placed — even after it is served or paid — but only from the **Counter** page, never from Serve or Billing.

**How**
1. Go to **Counter** and find the order in today's list (use the date arrows for another day).
2. Tap the card to open it → tap **Edit order**.
3. The order panel at the top changes to **Editing #12** with the order's items loaded in.
4. Make the changes (below), then tap **Save changes**. **Cancel** leaves the order as it was.

**What you can change in Edit**

| Change | How |
| --- | --- |
| Add an item | Tap it on the menu, like a new order |
| More or fewer of an item | **−** / **+** on that line; − down to zero removes it |
| Dine-in ↔ takeaway | Tick or untick **Takeaway** on the line |
| Kitchen note | **Add note** on the line |
| Customer / group name | Type in the name box |
| Discount | **%** / **฿** amount and **Why?** |
| Pickup date and time | Only for a pre-order not yet picked up |

Items already on the order keep the price they were sold at; newly added items use today's menu price.

**What is not in Edit** (use the order card buttons instead): payments (**Payment / refund**), coupons (**Add coupon**), cancelling (**Void**).

**What happens after an edit**
- The bill is worked out again. If the order was already paid and you added items, it now shows **Owes ฿X** — take the extra with **Payment / refund**. If you removed items it shows **Overpaid ฿X** — give the money back with **Give money back (refund)…**.
- The Serving Screen shows the updated items (if the order isn't served yet).
- If counter orders take stock off, only the difference is taken off or put back.
- History records the order before and after the edit, with your name.

**When Edit order is not there**
- **QR orders** can't be edited — the customer ordered them. If a table wants more, they can scan again and order, or you take a separate counter order with the table in the customer name; on Billing it shows as a separate bill under "Counter · <name>". To take something off a QR order, void it and take the corrected order at the counter, or use **Discount**.
- Cards in the **Still owing or coupon code missing** list don't show Edit — open the same order in today's list instead.
- Voided orders, locked days, and while offline (editing needs the internet).

Example: Table 5 ordered 2 Thai Milk Tea at the counter and paid ฿90 cash. They now want a Samosa. Counter → open #18 → **Edit order** → tap **Samosa (3 Pcs)** → **Save changes**. The card shows **Owes ฿35** → **Payment / refund** → Cash → tap what they gave → **Record payment**. The kitchen sees the Samosa added on Serve.

## 7. Counter lists and the day summary

Below the order panel the Counter page shows up to four lists (each only when it has something in it) and then the day's summary.

| List | What is in it | Buttons |
| --- | --- | --- |
| **Saved on this tablet, waiting to send** | Orders taken while offline, shown as **Pending** with the time taken | **Send now** (tries again straight away). **Delete** appears only on an order the server refused (red, with the reason) — it removes the unsent copy |
| **Trial orders — not counted** | Practice orders from this tablet and others | **Clear all trial orders**; each card works like a real one |
| **Pre-orders to pick up** | Booked pre-orders, with pickup date and time | **Picked up — move to today** gives it today's number and sends it to Serve |
| **Still owing or coupon code missing** | Recent orders with money owed or a code-pending coupon | Open the card → **Payment / refund** or **Save code** |

**Day summary**
- **‹ date ›** and **Today** — look at any day's orders.
- **Export (Excel/CSV)** — downloads that day's orders.
- **Lock this day** / **🔒 Locked — unlock** — owner tool; a locked day can't be changed.
- Tiles: **Orders** (how many, counter vs QR) · **Sales** (after discounts and coupons) · **Online** received that day · **Cash** received that day · **Coupon** total (and how many codes are pending) · **Unpaid** on that day's orders.
- The order cards for that day (section 5). Voided orders are hidden; **Show N voided orders** / **Hide** shows them.

Without internet the page shows the last saved copy of the day and says so.

## 8. Serving Screen

The Serving Screen is the kitchen and handover list: what to make, for whom, and a button to mark it served. Nothing about an order can be changed here — to change an order go to the Counter (section 6).

| Control | What it does |
| --- | --- |
| **QR orders take stock off: ON/OFF** | Owner switch for QR stock (section 12) |
| **Trial order** | Adds a practice order to the list so new staff can try marking served and paying it on Billing. Never counted |
| **Clear trial orders** | Deletes all practice orders |
| **Upcoming pre-orders** | Pre-orders not collected yet, with pickup date and **Around 14:00** or **Any time** |
| **Fulfill now** | The customer is here: gives the pre-order today's number and moves it to Open orders |
| **Open orders** | Every order not served yet, grouped by table, **Counter** (with the customer name), or **Pickup (pre-order)** |
| Item lines | Quantity, item, **Takeaway** label and the kitchen note |
| **Mark served** | Food/drink handed over. Paid counter orders become **Paid**; everything else moves to Billing |

The list refreshes by itself every few seconds; orders edited at the counter update here too. Trial orders appear in their own group, **Trial orders (practice — not counted)**.

## 9. Billing

Billing lists every served bill that isn't paid yet, grouped by table (counter orders under **Counter · name**, pre-orders under **Pickup (pre-order)**, practice under **Trial orders**). A paid bill disappears from the page.

**Each order shows:** number and badge, items, then Items / Discount / each coupon / **To pay**. If part was paid already: **Already paid ฿X · still owed ฿Y** — the buttons only take what is still owed.

| Button | What it does |
| --- | --- |
| **Coupon** | Code (covers up to what's left), **Use only part of it**, or **Add as "code pending"** (section 4) |
| **Discount** | **% off** / **฿ off**, amount, **Reason (required)** → **Save discount**; **Remove discount** |
| **Void** | **Reason (required)** → **Void this order**. Removes the bill (e.g. order entered twice) |
| **Save code** (yellow box) | Add the code for a code-pending coupon |
| **💵 Cash** | Opens **Customer gave — tap to mark paid:** **Exact ฿X**, ฿100, ฿500, ฿1,000. One tap = paid. **Other ฿** + **Mark paid · change ฿X** for any amount |
| **💳 Online** | One tap = paid by transfer |
| **½ Split** | **Cash ฿** part (online is the rest) → optional **Customer gave for the cash part** → **Mark paid · ฿X cash + ฿Y online** |

**Whole table at once:** when a table has two or more orders there is a **Combined total** and dark **Cash / Online / Split** buttons under **Bill together — mark all paid, how?** They pay every order of that table in one go. With Split, the cash is used on the orders in turn and the rest is online.

After a cash payment with change, the green **Give change ฿X** banner (with the order number) stays at the top until **Done**.

A bill with ฿0 to pay (e.g. fully covered by a coupon) still needs one tap on **Cash** or **Online** to close it.

## 10. Purchases

Record every purchase on the day it is made, before the drawer is counted — drawer purchases are subtracted on the Cash page.

**Purchases add to inventory: ON/OFF** (owner, top card) — when on, purchases linked to a stock item add to its stock. **Turn on / Turn off**, **record one on Inventory** (stock count link) and **Add earlier purchases to stock…** (pick **Since the last stock count** or **Pick dates** → **Preview** → add; never adds anything twice) are owner tools.

**To buy (shopping list)**
- **Add something to buy** + **Add** — type anything, e.g. "dish soap".
- **+ Add everything that's low on stock** — fills the list from Inventory.
- Tick an item when you buy it: it jumps into the purchase form below, already linked to its stock item. It leaves the list when you save. **remove** takes it off without buying.

**Add purchases (one receipt at a time)**

| Field | What to put |
| --- | --- |
| Date | Day of purchase (today by default) |
| **How was it paid?** | **Cash (drawer)** taken from the till · **Online** · **Own pocket** someone's own money |
| **Who paid** | Name — required for Own pocket (suggestions appear as you type) |
| **Item** / **Brand (optional)** | e.g. Onion / Makro. Past items are suggested |
| **Amount** + **Unit** | e.g. 3 + kg, 2 + bottle |
| **Price ฿** | Total for that line, not per unit |
| **— inventory item? —** | Which stock item this is (remembered next time). **Not for inventory** for things we don't stock. **+ Add to inventory…** creates a new stock item (**Name**, category, **Tracked in (unit)**, **Low-stock level** → **Create and link**) |
| **1 bottle = [ ] ml** | Appears when the units differ and the system doesn't know the conversion; type it once, it's remembered |
| **+ Add another item** | More lines on the same receipt |
| **Note** | e.g. "Makro trip" |
| **Receipt photo** | Optional photo of the receipt |

Under a linked line you'll see **→ adds 3000 g to Onion** (or "once the inventory switch is on"). **Total of these lines** should match the receipt. Then **Save**.

**The day's list**
- **‹ date ›** / **Today**, **Export day**, **Export month**.
- Tiles: **Total**, **Cash (drawer)**, **Online**, **Own pocket**.
- Each purchase: item · brand, amount, how paid, who paid, and stock status (**✓ +2000 g added to Onion**, **not linked to inventory**).
- **▲ ฿5/kg** (red) or **▼ ฿1.67/kg** (green) — price per unit went up or down since the last purchase of the same item.
- **📷 Receipt** opens the photo; **+ photo** adds one later.
- **Edit** — change any field (Item, Brand, Date, Price, Amount, Unit, Who paid, Note, Inventory). If it already added stock, saving changes stock by the difference only. **Delete** removes it (and takes back the stock it added).

**Still to pay back (own pocket)** — money owed to staff, grouped by person. **Paid back** → **Paid back on** date → **from the cash drawer** or **online transfer**. Paid back from the drawer is subtracted on the Cash page that day.

## 11. Cash Balance

Staff count the drawer at opening and closing; the system works out what should be there and flags any difference until someone explains it.

**Controls**
- **‹ date ›** / **Today** — any day.
- **Opening balance (counted at opening)** — pre-filled from the last counted closing ("Filled in from the last counted closing"); type your count if it differs.
- **Closing balance (counted at closing)** — type exactly what you counted. Never copy the suggestion.
- **Note** — anything unusual, e.g. "took ฿200 out for change".
- **Save** — saves the counts; the message says **Saved** or **Saved — the difference is flagged until someone resolves it**. "Saved as …" shows your name.

**Suggested closing**

| Line | What it is |
| --- | --- |
| Opening | Your opening count |
| + Cash handed over by customers | All cash payments that day, including the notes that needed change |
| − Change given back | Change from Customer gave |
| − Cash refunds | Refunds recorded as cash |
| − Purchases / pay-backs from the drawer | Purchases paid Cash (drawer) + own-pocket pay-backs from the drawer (**see Purchases**) |
| = Suggested closing | What should be in the drawer |

Online and coupon payments never go in the drawer. A payment counts on the day in its date box (section 5), not the day of the order.

**Checking and flags**
- While typing the closing you see **Drawer matches the suggestion ✓**, **Drawer has ฿X MORE than suggested** or **Drawer is ฿X SHORT of the suggestion**.
- On Save, a difference **flags** the day: a red box "⚑ Flagged: counted … vs suggested …" and the day is listed at the top under **⚑ Drawer differences to resolve** (tap a day to open it).
- To clear it: find the cause, type it in **Reason** (e.g. "฿100 given as change twice", "owner took ฿500") → **Mark resolved**. The day then shows **Resolved** with the reason, who and when.
- If you fix the real cause (e.g. record a missing payment), Save the day again — if it now matches, the flag clears by itself.
- **Recent days** table: Day, Opening, Closing, and Check (**✓ matched**, **⚑ ฿X**, **resolved**). Tap a row to open that day.

## 12. Inventory (owner)

Inventory holds every stock item, the switches that decide what takes stock off, and the full stock count everything is measured from.

**Full stock count** — after physically counting everything and updating the numbers, type an optional **Note** and tap **Record a full stock count** (asks to confirm). Shows when the last one was. Purchases and orders from before it are never added or taken off later.

**Sales take stock off**

| Switch | ON | OFF |
| --- | --- | --- |
| **QR orders** | Each QR order takes its ingredients, cups, boxes, straws off stock. An out-of-stock item can't be ordered and shows **Unavailable** on the QR menu | Nothing taken off; QR menu shows everything |
| **Counter orders** | Each counter sale takes stock off but is never refused; if something runs out its stock goes below zero and the order says **stock ran short** | Nothing taken off |

- Each switch asks to confirm. Turning on doesn't touch orders from while it was off — **Earlier orders…** → **Since the last stock count** or **Pick dates** → **Preview** ("N orders will take stock off; M skipped") → **Take stock off for N orders**. Nothing is ever counted twice.
- Voiding an order gives its stock back; editing a counter order moves only the difference; pre-orders take stock when picked up.

**Finding items** — **Find an ingredient…** searches. Items are grouped into **Batch Prep**, **Raw Ingredients**, **Consumables** and **Supplies**.

**Each item row**

| Part | What it does |
| --- | --- |
| Name, brand, **Previously: …** | Current brand, and the old brand when a purchase changed it |
| **Used in: …** | Menu items that use it |
| **OK** / **Low** / **Out of stock** | Stock status against its low-stock level |
| **Edit** | Name, brand, unit, current stock, category (Raw ingredient / Batch prep / Consumable / Supplies) → **Save** |
| **Manage used-in** | Link it to menu items: **Add to menu item…** + **Qty per order** → **Link**; **Remove** a link; **Done** |
| **Delete** | Removes the item and its history (**Yes, delete**) |
| **Prep a batch** (batch-prep items) | **Batch qty** → **Prep batch**: adds the prepared amount and takes its raw ingredients off |
| **In stock** | Current amount (can be negative — means the count needs checking) |
| **Low-stock alert at** + **Save** | Level that triggers Low and the stock alert |
| **Restock / use** | **Amount**, optional **฿ paid** → **+ Restock** or **− Use** (spill, staff meal, waste). Shows **Last bought: +X for ฿Y** |

**Add a new ingredient** — **Name**, **Brand**, **Unit** (g, ml, pcs…), **Starting stock**, **Category**, optional **Used in** menu items with qty (**+ Add another menu item**) → **Add ingredient**; **Clear** empties the form.

**Recent stock changes** — the latest restocks and use-ups. **Full history & export** opens the history page: **From / To**, **Last 7 days**, **This month**, and **Export as CSV** → **Download CSV**.

**Danger zone** (testing/setup only, permanent): **Reset all orders**, **Reset all stock to 0**, **Clear stock history** — each asks "Yes, …" before it runs.

## 13. Menu (owner)

The Menu page controls what customers see on the QR menu and what staff see on the Counter: names, prices, photos, order and recipes.

**The list** — items grouped by category. Each shows its code (e.g. SN-SMT), name, category and price.
- **☰** handle — drag to change the order within its category; the QR menu uses the same order.
- **Active** tick — untick to hide an item from the QR menu and the Counter (e.g. sold out for the season). Old orders are not affected.
- **Edit** opens the item; **Close** closes it.

**Inside Edit**

| Part | What it does |
| --- | --- |
| **Name**, **Category**, **Price** | As shown on the menu. A new price applies to new orders only |
| **Yield (servings)** + **Yield note** | How many servings one order of the recipe makes, e.g. "2 skewers" |
| **Packaging type** | **Food**, **Drink — Hot**, **Drink — Cold**, **As-is with a straw (no glass)**, **No packaging** — decides which takeaway box / cup / straw is counted |
| **Description** | Shown to customers under the item name |
| **Photo** | **Add photo** / **Change photo** → drag and zoom the crop → **Save photo**; **Remove photo** |
| **Save details** | Saves the fields above |
| **Item code** → **Change code** → **Confirm** | The item's permanent ID; changing it updates its recipe, history and past orders |
| **Ingredients used per order** | **Add ingredient…** + **Qty per order** → **Link**; **Remove** a line. This is what stock is taken off per order |
| **Delete item** | Removes the item (**Yes, delete**). Untick Active instead if it may come back |

**Add a new menu item** — **Name**, **Category**, **Price**, **Code** (e.g. CT007), packaging → **Add item**. Add ingredients from its Edit panel afterwards.

## 14. Coupons page (owner)

Record every coupon batch here before the coupons are used, or the counter will say "isn't in the system".

**Look up a coupon** — type a code → **Look up**. Shows the buyer, value, **฿X left** or **used up**, the expiry, every bill it was used on (date, order, amount; voided ones crossed out as "given back"), and any bill where it was tried but couldn't be used.

**Record a coupon batch sale**

| Field | What to put |
| --- | --- |
| **Buyer** | Person, organisation or event |
| **Value per coupon (฿)** | e.g. 75 |
| **Total collected** | What they paid for the batch (defaults to value × number of codes) |
| **Date sold** | When it was sold (can be backdated) |
| **Expires on (optional)** | From this date the coupons stop working. Blank = no expiry |
| Codes box | The codes printed on the coupons, one per line or comma-separated. The count shows underneath |
| **Paid** / **Collected** ticks | Whether the buyer has paid, and whether the physical coupons were handed over |

→ **Save batch**.

**All coupon batches** table: **Buyer**, **Value each**, **Used** ("1/3 used up", part-used count, ฿ still to spend), **Total collected**, **Sold** date (change it → **Save**), **Expires on** (change or clear → **Save**; **Expired** in red), **Paid**/**Unpaid** and **Collected**/**Not collected** (tap to switch), **Edit** (buyer, value each, total collected → **Save** / **Cancel**).

## 15. Sales & Analytics (owner)

Sales & Analytics shows sales for any day, month or date range; trial and voided orders are never included.

**Range** — **Day** (**← Prev day**, **Next day →**, **Today**), **Month** (**← Prev month**, **Next month →**, **This month**), or **Custom** (**From** / **To**, **Last 7 days**, **This month**). **Export orders (CSV)** downloads every order in the range (items, discount, coupons, paid, payment method incl. split, QR/Counter).

**Cards** — **Revenue**, **Profit (est.)** (revenue minus each item's cost from the costing table), **Orders**, **Avg. order**, **Days with sales**. The small badge compares with the same-length period just before (**New** when there was nothing before).

**Charts and lists** — **Daily sales**, **Bestsellers** and **Slow movers**, **Sales by category**, **Best day of the week**, **Peak ordering hours** (live orders only), **Coupons & discounts** (discount given, coupon uses), **Payment method** (💵 Cash, 💳 Online, **Not yet recorded**; a split bill counts toward both) with **Where orders came from** (QR vs Counter), and **Frequently ordered together**.

**Danger zone** — **Reset all orders** or **Reset orders in a date range** (From / To → **Continue** → confirm). Permanent; for clearing test data only. Stock is not touched.

## 16. What customers see

Knowing the customer's screen helps you answer "how do I order?" at the table.

**QR table menu** (scanning the code on a table or counter seat) — the menu by category with photos, prices and descriptions.
- **Add**, then **− / +** to change how many. Items marked **Low in stock** can still be ordered; **Unavailable** can't (only while QR orders take stock off).
- **Your basket** → each item **Dine In** or **Takeaway** → **Place order**. **Keep browsing** goes back to the menu.
- After ordering: **Order placed**, the order number and total, and "Please pay a staff member at the counter or table". **Order something else** starts another order for the same table.
- Their order appears on Serve under their table with a **QR** badge, then on Billing after you mark it served.

**Pre-order page** (a separate link for ordering ahead) — customers pick **Date** and **Any time within opening hours** or **Specific time**, add items, choose Dine In / Takeaway, then **Place pre-order**. It shows **Pre-order placed** and "Please pay a staff member when you pick up your order". It appears under **Upcoming pre-orders** on Serve and **Pre-orders to pick up** on the Counter.

Customers can't change or cancel an order after placing it — staff void it on the Counter if needed.

## 17. Example cases, step by step

Each case is a real situation and the exact taps; → means "then tap".

**Taking orders and payment**
1. **Walk-in pays cash with a big note.** Bill ฿65, customer gives ฿500 → items → **Cash** → **฿500** → **Place order** → give the change shown (**฿435**) → **Done**.
2. **Exact cash.** Items → **Cash** → **Place order** (or tap **Exact**). No banner.
3. **Half and half.** Bill ฿120: ฿20 cash, rest by transfer → **Split** → Cash ฿ **20** → Online fills **100** → **Place order**.
4. **Eats first, pays later.** Items → **Pay later** → **Place order**. When they pay: open the order → **Payment / refund** → **Cash** → tap the note → **Record payment** → give change → **Done**.
5. **Group pays one bill at the end (QR table).** Billing → their table → **Combined total** → **💵 Cash** → **฿1,000** → give change.
6. **Takeaway with a note.** Tap **Thai Milk Tea (Cold)** → tick **Takeaway** → **Add note** → "less sweet".
7. **Phone order for tomorrow 10:00, ฿50 deposit.** **Pre-order** → date and time → items → under **Paid now (deposit)** tap **Cash** → type 50 in **Other** (it records ฿50; the rest stays owed) → **Book pre-order**. Tomorrow: Counter → **Picked up — move to today** → take the rest with **Payment / refund**.

**Changing an order**

8. **Customer adds an item after ordering.** Counter → open the order → **Edit order** → tap the item → **Save changes** → if it was paid, **Payment / refund** for the extra.
9. **Wrong item entered (Hot instead of Cold).** **Edit order** → **−** on the Hot line → tap the Cold item → **Save changes**. If the price differs, the card shows Owes or Overpaid — settle it.
10. **Customer cancels one of two drinks, already paid.** **Edit order** → **−** → **Save changes** → card shows **Overpaid ฿45** → **Payment / refund** → **Give money back (refund)…** → Cash → 45 → **Record refund**.
11. **QR table wants one more drink.** QR orders can't be edited: take a counter order with the table name in **Customer / group name** (pay now or Pay later), or let them scan and order again.
12. **Order entered twice by mistake.** Open the duplicate → **Void** → "duplicate" → **Void this order**. If it was a test, **Show voided orders** → open it → **Delete for good**.
13. **Wrong payment amount recorded** (฿650 instead of ฿65). Open the order → **Payment / refund** → **Recorded so far** → **remove** next to ฿650 → record ฿65.
14. **Paid by transfer, but cash was recorded.** **remove** the cash line → record it again as **Online**.

**Coupons and discounts**

15. **฿75 coupon on a ฿55 bill.** Coupon code → **Add** → "−฿55 · ฿20 stays on it" → tell the customer ฿20 is left for next time.
16. **Next visit, same coupon, ฿65 bill.** Add the code → −฿20 (used up) → they pay ฿45.
17. **Customer forgot the coupon.** **No code? Amount off ฿** → 55 → **Code later**. When they bring it: open the order → type the code in the yellow box → **Save code**.
18. **Staff meal, 50% off.** **Discount** → **%** → 50 → **Why?** "staff meal".

**Money and stock**

19. **Bought ice with own money.** Purchases → **Own pocket** → **Who paid** your name → Ice → **Not for inventory** → **Save**. When the owner repays you from the till: **Still to pay back** → **Paid back** → **from the cash drawer**.
20. **Makro trip from the drawer.** **Cash (drawer)** → one line per item, link each to its stock item → check the total → photo → **Save**.
21. **Drawer is ฿100 short at closing.** Type the real count → **Save** (flagged). Check Still owing, payments recorded as cash that were transfers, change mistakes. Found it → fix it and Save again; can't explain it → type the reason → **Mark resolved**.
22. **Counter order says "stock ran short: Straw".** The sale is done. Tell the owner — the straw count needs checking or restocking.
23. **No internet at the counter.** Keep taking orders (they show **Pending**). When the connection is back they send by themselves, or tap **Send now**.
24. **New staff wants to practise.** Counter → **Trial order** → take orders → practise serving and Billing → **Turn trial mode off** → **Clear all trial orders**.

## 18. Quick answers

| Question | Answer |
| --- | --- |
| Where do I edit an order? | **Counter** → open the order → **Edit order**. Not on Serve or Billing. QR orders can't be edited (section 6) |
| Where do I take a late payment? | Counter → open the order → **Payment / refund**, or Billing if it was served |
| Do I record a refund for change? | No. Tap the note under **Customer gave**; the change is worked out |
| How do I give money back? | Order → **Payment / refund** → **Give money back (refund)…** |
| I recorded the wrong payment | **Payment / refund** → **remove** → record again |
| Customer pays part cash, part transfer | **Split** |
| Customer wants to keep coupon money | **use only** / **Use only part of it** |
| Coupon code refused | Read the reason (not in system, used up, expired); use code pending if the code is unreadable and tell the owner |
| What does Owes / Overpaid mean? | Money still due / more recorded than the bill — settle with Payment or Refund |
| Order shows Pending | Saved on the tablet, waiting for internet. Don't close the tab |
| Buttons are grey | You are offline, or the day is locked by the owner |
| My name isn't in the list | Counter → **Edit names** → **Add** |
| A test order is in the list | **Void** it, then **Delete for good** — or use **Trial order** next time |
| Drawer doesn't match | Save the real count; fix the cause or **Mark resolved** with the reason. Never change the count |
| "Stock ran short" | The sale went through; tell the owner |
| Something not in this guide | Check **History** on the order, then ask the owner |`;
