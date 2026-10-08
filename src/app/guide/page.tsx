import StaffHeader from "@/components/StaffHeader";
import type { ReactNode } from "react";

// Round 40: staff guidebook inside the site (same content as the shared
// "Cafe Tan90 — Staff Guidebook" doc). Plain static page; update it when a
// screen changes.

const SECTIONS: { id: string; title: string }[] = [
  { id: "start", title: "1. Getting started" },
  { id: "counter", title: "2. Counter — taking an order" },
  { id: "serve", title: "3. Serving Screen" },
  { id: "billing", title: "4. Billing — settling a bill" },
  { id: "fix", title: "5. After the order — payments, changes, mistakes" },
  { id: "purchases", title: "6. Purchases" },
  { id: "cash", title: "7. Cash Balance — opening and closing" },
  { id: "owner", title: "8. Owner section" },
  { id: "faq", title: "9. Quick answers" },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-4 space-y-3 p-5 text-sm leading-relaxed text-navy-800">
      <h2 className="text-base font-semibold text-navy-950">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: [string, string] | [string, string, string]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="text-xs font-semibold uppercase tracking-wide text-navy-600">
            {head.map((h) => (
              <th key={h} className="pb-2 pr-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-card-border align-top">
              {r.map((c, j) => (
                <td key={j} className={`py-2 pr-3 ${j === 0 ? "font-medium text-navy-950" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const B = ({ children }: { children: ReactNode }) => <b className="text-navy-950">{children}</b>;

export default function GuidePage() {
  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/guide" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold text-navy-950">Staff guide</h1>
          <p className="mt-1 text-sm text-navy-600">How to use every page, in the order you use them during the day.</p>
        </div>

        <nav className="card flex flex-wrap gap-2 p-4 text-sm">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full border border-card-border px-3 py-1 text-navy-900 hover:bg-navy-100">
              {s.title}
            </a>
          ))}
        </nav>

        <Section id="start" title={SECTIONS[0].title}>
          <p>
            Open any page and enter the staff PIN. The login lasts 12 hours; if a page says it expired, log in again — nothing saved is lost.
          </p>
          <p>
            <B>Pick your name first.</B> On the Counter page choose your name in <B>Taking orders as</B>. Every order, payment, refund and void is recorded
            under it. Missing? Tap <B>Edit names</B>.
          </p>
          <Table
            head={["Page", "What it is for"]}
            rows={[
              ["Counter", "Take walk-in and phone orders, take payment, give change"],
              ["Serving Screen", "See every open order (QR and counter) and mark it served"],
              ["Billing", "Settle served bills not paid yet (mostly QR tables)"],
              ["Purchases", "Record everything bought for the cafe"],
              ["Cash Balance", "Count the drawer at opening and closing"],
              ["Menu · Inventory · Coupons · Sales & Analytics", "Owner pages (section 8)"],
            ]}
          />
          <p>
            Badges: <B>QR</B> = customer scanned the table code · <B>COUNTER</B> = staff took it · <B>TRIAL</B> (orange) = practice, never counted.
          </p>
        </Section>

        <Section id="counter" title={SECTIONS[1].title}>
          <p>A counter order is about four taps: items → payment → what the customer gave → Place order.</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Tap each item. Tap again for more, or use − / + in the order panel.</li>
            <li>
              Tick <B>Takeaway</B> if it leaves the cafe, or <B>Add note</B> (e.g. &ldquo;no onion&rdquo;).
            </li>
            <li>
              Optional: a <B>Customer / group name</B>.
            </li>
            <li>
              Pick <B>Cash</B>, <B>Online</B>, <B>Split</B> or <B>Pay later</B>.
            </li>
            <li>
              Cash: tap what the customer handed you — <B>Exact</B>, <B>฿100</B>, <B>฿500</B>, <B>฿1,000</B> or <B>Other</B>. It shows <B>Give change ฿X</B>.
            </li>
            <li>
              Tap <B>Place order</B>. The green <B>Give change ฿X</B> banner stays until you tap <B>Done</B>.
            </li>
          </ol>
          <p>Only the bill is recorded as cash: bill ฿65, customer gives ฿100 → ฿65 cash + ฿35 change. Never record a refund for change.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <B>Split:</B> type the cash part; the rest fills in as online. Paid the cash part with a bigger note? Tap it under <B>Customer gave for the cash part</B>.
            </li>
            <li>
              <B>Pay later:</B> the order shows <B>Owes ฿X</B>; take the money later on the order (section 5) or on Billing.
            </li>
            <li>
              <B>Pre-order:</B> tap <B>Pre-order</B>, set pickup date and time, take a deposit or choose <B>At pickup</B>.
            </li>
            <li>
              <B>Discount:</B> % or ฿ plus a reason.
            </li>
            <li>
              <B>Coupon:</B> type the code → <B>Add</B>. It covers the bill up to what&rsquo;s left on it; the rest stays on the code. Keep some for later: type
              the smaller amount in <B>use only</B>. No code: <B>No code? Amount off ฿</B> → <B>Code later</B>.
            </li>
            <li>
              <B>Trial order:</B> practice mode — orange button, never counted, deleted after a day. Turn it off before real orders.
            </li>
            <li>
              <B>No internet:</B> keep going; orders are saved on the tablet as <B>Pending</B> and sent later. Don&rsquo;t close the tab.
            </li>
          </ul>
        </Section>

        <Section id="serve" title={SECTIONS[2].title}>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Tap <B>Mark served</B> when food or drink is handed over. A fully paid counter order goes straight to Paid; anything unpaid moves to Billing.
            </li>
            <li>Notes and Takeaway show on each order. The page updates by itself.</li>
            <li>
              Pre-orders: <B>Fulfill now</B> when the customer comes (on the Counter: <B>Picked up — move to today</B>).
            </li>
            <li>
              <B>QR orders take stock off: ON/OFF</B> at the top is an owner setting.
            </li>
          </ul>
        </Section>

        <Section id="billing" title={SECTIONS[3].title}>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <B>💵 Cash</B> → tap the note the customer gave (<B>Exact</B>, <B>฿100</B>, <B>฿500</B>, <B>฿1,000</B> or Other). The bill is paid at once and{" "}
              <B>Give change ฿X</B> shows until <B>Done</B>.
            </li>
            <li>
              <B>💳 Online</B> → one tap.
            </li>
            <li>
              <B>½ Split</B> → type the cash part (and the note it came in, for change) → <B>Mark paid</B>.
            </li>
            <li>
              A table with several orders: the dark buttons under <B>Combined total</B> pay them all together.
            </li>
            <li>
              Under each order: <B>Coupon</B>, <B>Discount</B> (with reason) and <B>Void</B> (with reason; coupon money and stock go back).
            </li>
          </ul>
        </Section>

        <Section id="fix" title={SECTIONS[4].title}>
          <p>
            Tap the order on the Counter page. Every change is kept in <B>History</B> with your name.
          </p>
          <Table
            head={["Situation", "What to tap"]}
            rows={[
              ["Pay-later order is paid", "Payment / refund → Cash / Online / Split → what they gave → Record payment"],
              ["Part paid now", "Payment / refund → change Amount to record"],
              ["Money must go back", "Payment / refund → Give money back (refund)… → Cash or Online → amount → Record refund"],
              ["Payment entered by mistake", "Payment / refund → Recorded so far → remove"],
              ["Wrong items or label (counter)", "Edit order → Save changes"],
              ["Forgot coupon / discount", "Add coupon (counter) or Discount (QR)"],
              ["Coupon code wasn't to hand", "Yellow box: Code for the coupon that took ฿X off → Save code"],
              ["Order shouldn't exist", "Void → reason → Void this order"],
              ["Voided test order", "Show voided → open it → Delete for good"],
            ]}
          />
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <B>Change is not a refund.</B> Change is handled by Customer gave. Refund = money given back after the sale.
            </li>
            <li>A payment&rsquo;s date = the day the money changed hands (it counts in that day&rsquo;s drawer).</li>
            <li>
              Clear <B>Still owing or coupon code missing</B> before closing.
            </li>
          </ul>
        </Section>

        <Section id="purchases" title={SECTIONS[5].title}>
          <p>Record purchases the same day, before counting the drawer — drawer purchases are subtracted on the Cash page.</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Check the date.</li>
            <li>
              <B>How was it paid?</B> Cash (drawer) · Online · Own pocket (type who paid).
            </li>
            <li>Item, brand (optional), amount + unit, price. + Add another item for more lines.</li>
            <li>
              Stock item? Pick it in the inventory box (remembered next time). Not stocked (e.g. ice): <B>Not for inventory</B>.
            </li>
            <li>Check the total matches the receipt, add a photo, Save.</li>
          </ol>
          <ul className="list-disc space-y-1 pl-5">
            <li>▲ / ▼ = price per unit went up / down since last time.</li>
            <li>
              <B>To buy</B> = shopping list; tick an item when bought.
            </li>
            <li>
              <B>Still to pay back</B>: tap Paid back when someone is repaid (from the drawer or online).
            </li>
          </ul>
        </Section>

        <Section id="cash" title={SECTIONS[6].title}>
          <p>
            <B>Opening:</B> count the drawer, type it in Opening balance, Save. <B>Closing:</B> record everything, count the drawer, type the real count in
            Closing balance (never copy the suggestion), Save.
          </p>
          <Table
            head={["Line", "Where it comes from"]}
            rows={[
              ["Opening", "What you counted at opening"],
              ["+ Cash handed over", "All cash payments, including notes that needed change"],
              ["− Change given back", "From Customer gave"],
              ["− Cash refunds", "Refunds recorded as cash"],
              ["− Purchases / pay-backs from drawer", "Purchases paid Cash (drawer) + own-pocket pay-backs from the drawer"],
              ["= Suggested closing", "What should be in the drawer"],
            ]}
          />
          <p>
            Doesn&rsquo;t match → the day is <B>flagged ⚑</B> and listed at the top under <B>Drawer differences to resolve</B> until someone types the reason
            and taps <B>Mark resolved</B>.
          </p>
        </Section>

        <Section id="owner" title={SECTIONS[7].title}>
          <Table
            head={["Switch", "When ON", "When OFF"]}
            rows={[
              ["QR orders take stock off", "Takes stock off; out-of-stock items can't be ordered", "Nothing taken off; QR menu shows everything"],
              ["Counter orders take stock off", "Takes stock off, never refuses; may go below zero with a warning", "Nothing taken off"],
              ["Purchases add to inventory", "Linked purchases add stock", "Purchases only recorded"],
            ]}
          />
          <ul className="list-disc space-y-1 pl-5">
            <li>Switches don&rsquo;t touch orders from while they were off — use Earlier orders… (preview first, never twice).</li>
            <li>Void puts stock back; editing changes only the difference.</li>
            <li>After a physical count: update the numbers, then Record a full stock count.</li>
            <li>Coupons: record batches with optional Expires on; Look up a coupon shows what&rsquo;s left and where it was used.</li>
            <li>Menu: edit, untick Active to hide, drag ☰ to reorder.</li>
            <li>Counter day: Export (Excel/CSV) and Lock this day.</li>
          </ul>
        </Section>

        <Section id="faq" title={SECTIONS[8].title}>
          <Table
            head={["Question", "Answer"]}
            rows={[
              ["฿100 for a ฿65 bill — refund?", "No. Tap ฿100 under Customer gave; change ฿35 shows."],
              ["Wrong amount recorded", "Payment / refund → remove → record again."],
              ["Half cash, half online", "Split."],
              ["Keep coupon money for later", "use only (Counter) / Use only part of it (Billing)."],
              ["Coupon used up or expired", "It can't be used; tell the owner."],
              ["Internet down", "Counter keeps working; Billing, Purchases and Cash need internet."],
              ["Drawer doesn't match", "Save the real count, find the reason, Mark resolved."],
              ["“Stock ran short”", "The sale went through; tell the owner."],
            ]}
          />
        </Section>
      </main>
    </div>
  );
}
