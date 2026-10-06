"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

// Round 37: phones get the staff pages as one swipeable row of tabs (instead
// of four wrapped lines of links), with the current page scrolled into view.
export default function NavStrip({ items, active }: { items: { href: string; label: string }[]; active: string }) {
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);
  return (
    <nav className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          ref={active === item.href ? activeRef : undefined}
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
            active === item.href ? "bg-white text-navy-950" : "bg-white/10 text-navy-100"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
