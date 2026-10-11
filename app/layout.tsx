import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Requiem — AI learning workspace",
  description: "Organize course material, learn with grounded AI, and think on an interactive canvas."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" rel="stylesheet" />
        {/*
          Hydration safety net: animated wrappers ship at opacity 0 and rely
          on client JS to fade in. If React never hydrates (stale cached
          chunks, blocked scripts, interrupted load), this inline script —
          which needs no fetch — force-reveals them instead of a blank page.
          No-op on a healthy load (nothing is still at opacity 0 by then).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(){setTimeout(function(){try{var n=document.querySelectorAll("[data-reveal]"),r=!1;for(var i=0;i<n.length;i++){var e=n[i];if(e&&e.style&&e.style.opacity==="0"){e.style.opacity="1";e.style.transform="none";r=!0}}if(r&&window.console)console.warn("Requiem: content revealed by fallback (animations never ran).")}catch(e){}},6000)}();`,
          }}
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
