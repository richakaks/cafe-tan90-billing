import type { ReactNode } from "react";

// Round 41: a tiny renderer for the guide's markdown (headings, paragraphs,
// **bold**, *italic*, bullet / numbered lists, pipe tables). Only the subset
// content.ts uses -- no HTML is ever injected.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined)
      out.push(
        <b key={`${key}-b${i++}`} className="font-semibold text-navy-950">
          {m[1]}
        </b>
      );
    else out.push(<i key={`${key}-i${i++}`}>{m[2]}</i>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function headings(md: string): { id: string; title: string }[] {
  return md
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => ({ id: slug(l.slice(3)), title: l.slice(3) }));
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

// Renders the markdown as a list of section cards, one per "## " heading.
export function renderGuide(md: string): ReactNode[] {
  const sections: { title: string; lines: string[] }[] = [];
  for (const line of md.split("\n")) {
    if (line.startsWith("## ")) sections.push({ title: line.slice(3), lines: [] });
    else if (sections.length) sections[sections.length - 1].lines.push(line);
  }
  return sections.map((s, si) => {
    const blocks: ReactNode[] = [];
    const lines = s.lines;
    let i = 0;
    let k = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i++;
        continue;
      }
      const key = `${si}-${k++}`;
      if (line.trim().startsWith("|")) {
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          if (!/^\|\s*-/.test(lines[i].trim())) rows.push(cells(lines[i]));
          i++;
        }
        const [head, ...body] = rows;
        blocks.push(
          <div key={key} className="overflow-x-auto">
            <table className={`w-full text-left text-sm ${head.length > 2 ? "min-w-[560px]" : ""}`}>
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-navy-600">
                  {head.map((h, j) => (
                    <th key={j} className="pb-2 pr-3">
                      {inline(h, `${key}h${j}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((r, ri) => (
                  <tr key={ri} className="border-t border-card-border align-top">
                    {r.map((c, ci) => (
                      <td key={ci} className="py-2 pr-3">
                        {inline(c, `${key}r${ri}c${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
      if (/^\s*- /.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*- /.test(lines[i])) items.push(lines[i++].replace(/^\s*- /, ""));
        blocks.push(
          <ul key={key} className="list-disc space-y-1 pl-5">
            {items.map((t, j) => (
              <li key={j}>{inline(t, `${key}l${j}`)}</li>
            ))}
          </ul>
        );
        continue;
      }
      if (/^\s*\d+\. /.test(line)) {
        const start = Number(line.trim().split(".")[0]);
        const items: string[] = [];
        while (i < lines.length && /^\s*\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\. /, ""));
        blocks.push(
          <ol key={key} start={start} className="list-decimal space-y-1 pl-5">
            {items.map((t, j) => (
              <li key={j}>{inline(t, `${key}o${j}`)}</li>
            ))}
          </ol>
        );
        continue;
      }
      blocks.push(
        <p key={key}>{inline(line, key)}</p>
      );
      i++;
    }
    return (
      <section key={si} id={slug(s.title)} className="card scroll-mt-4 space-y-3 p-5 text-sm leading-relaxed text-navy-800">
        <h2 className="text-base font-semibold text-navy-950">{s.title}</h2>
        {blocks}
      </section>
    );
  });
}
