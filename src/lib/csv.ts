// Tiny CSV builder — no library needed for the handful of flat exports this
// app has (stock history, orders). Wraps every field in quotes and doubles
// up any embedded quotes, which is enough to survive commas/newlines in
// ingredient or item names.
function csvField(value: string | number): string {
  const s = String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvField).join(","), ...rows.map((row) => row.map(csvField).join(","))];
  // Leading BOM so Excel opens UTF-8 (฿, Thai text, etc.) correctly instead
  // of mangling it into mojibake.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
