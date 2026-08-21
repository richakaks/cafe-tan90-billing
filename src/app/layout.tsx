import type { Metadata } from "next";
import "./globals.css";

// Loaded via a <link> tag rather than next/font/google so the production
// build never depends on reaching fonts.googleapis.com at build time (Vercel
// builds usually can, but this keeps `next build` fully offline-friendly).
// Falls back to the system sans-serif stack if the request fails at runtime.

export const metadata: Metadata = {
  title: "Cafe Tan90",
  description: "Cafe Tan90 — QR ordering, serving & inventory",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- targets Pages Router's _app.js; in the
            App Router, root layout.tsx <head> content is already applied to every route, as intended here. */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col bg-page">{children}</body>
    </html>
  );
}
