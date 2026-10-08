import StaffHeader from "@/components/StaffHeader";
import { GUIDE_MD } from "./content";
import { headings, renderGuide } from "./render";

// Round 40/41: staff guidebook inside the site. Content lives in content.ts.
export default function GuidePage() {
  const toc = headings(GUIDE_MD);
  return (
    <div className="flex flex-1 flex-col">
      <StaffHeader active="/guide" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold text-navy-950">Staff guide</h1>
          <p className="mt-1 text-sm text-navy-600">Every page and button, with examples. Tap a topic to jump to it.</p>
        </div>
        <nav className="card flex flex-wrap gap-2 p-4 text-sm">
          {toc.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full border border-card-border px-3 py-1 text-navy-900 hover:bg-navy-100">
              {s.title}
            </a>
          ))}
        </nav>
        {renderGuide(GUIDE_MD)}
      </main>
    </div>
  );
}
