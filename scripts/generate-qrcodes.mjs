#!/usr/bin/env node
// Generates one QR code per seat (T1-T9, S1-S4) pointing at that seat's order
// page, plus a printable HTML sheet laying all of them out with labels.
//
// Usage:
//   node scripts/generate-qrcodes.mjs https://your-deployed-domain.vercel.app
//
// Keep this seat list in sync with supabase/seed.sql if you add/remove
// tables — this script doesn't read the database, it just needs a base URL.

import QRCode from "qrcode";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "qrcodes");

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("Usage: node scripts/generate-qrcodes.mjs <base-url>");
  console.error("Example: node scripts/generate-qrcodes.mjs https://cafe-tan90-ordering.vercel.app");
  process.exit(1);
}

const SEATS = [
  ...Array.from({ length: 9 }, (_, i) => ({ id: `T${i + 1}`, label: `Table ${i + 1}` })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `S${i + 1}`, label: `Counter Seat ${i + 1}` })),
];

async function main() {
  await mkdir(outDir, { recursive: true });

  const cards = [];
  for (const seat of SEATS) {
    const url = `${baseUrl.replace(/\/$/, "")}/order/${seat.id}`;
    const file = path.join(outDir, `${seat.id}.png`);
    await QRCode.toFile(file, url, { width: 600, margin: 2 });
    cards.push({ ...seat, url, file: `${seat.id}.png` });
    console.log(`Generated ${seat.id} -> ${url}`);
  }

  const sheet = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Cafe Tan90 — Table QR Codes</title>
<style>
  body { font-family: sans-serif; margin: 0; padding: 24px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .card { border: 1px dashed #999; border-radius: 12px; padding: 16px; text-align: center; page-break-inside: avoid; }
  .card img { width: 100%; max-width: 220px; }
  .card p { margin: 8px 0 0; font-weight: 600; font-size: 14px; }
  @media print { .card { border-color: #ccc; } }
</style>
</head>
<body>
  <h1>Cafe Tan90 — Table &amp; Seat QR Codes</h1>
  <div class="grid">
    ${cards.map((c) => `<div class="card"><img src="${c.file}" alt="${c.label}" /><p>${c.label}</p></div>`).join("\n    ")}
  </div>
</body>
</html>
`;
  await writeFile(path.join(outDir, "print-sheet.html"), sheet, "utf8");
  console.log(`\nDone. Open qrcodes/print-sheet.html in a browser and print it.`);
}

main();
