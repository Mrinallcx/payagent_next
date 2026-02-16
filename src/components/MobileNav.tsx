"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

interface NavLink {
  href: string;
  label: string;
  active?: boolean;
}

export function MobileNav({
  links,
  children,
  className,
}: {
  links: NavLink[];
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className={className ?? "pt-8 animate-fade-up"}>
      <div className="flex justify-between items-center">
        {children}
        <button
          className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-slate-100 transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? (
            <span className="text-lg leading-none">✕</span>
          ) : (
            <span className="text-xl leading-none">☰</span>
          )}
        </button>
      </div>
      {open && (
        <nav className="sm:hidden mt-3 pb-3 border-b border-slate-200 flex flex-col gap-1">
          {links.map((link) =>
            link.active ? (
              <span
                key={link.label}
                className="text-sm font-semibold text-blue-600 py-2 px-3 rounded-lg bg-blue-50"
              >
                {link.label}
              </span>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-semibold text-gray-600 hover:text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-50 transition-colors"
              >
                {link.label}
              </Link>
            )
          )}
        </nav>
      )}
    </header>
  );
}
