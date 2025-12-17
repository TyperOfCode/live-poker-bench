"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const navItems = [
  { href: "/about", label: "About" },
  { href: "/replay", label: "Hand Replay" },
  { href: "/summary", label: "Tournament Summary" },
  { href: "/overall", label: "Overall Statistics" },
];

export function TopNavigation() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/replay") {
      return pathname.startsWith("/replay");
    }
    if (href === "/summary") {
      return pathname.startsWith("/summary");
    }
    return pathname === href;
  };

  return (
    <div className="flex gap-1 rounded-lg bg-gray-800 p-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={clsx(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            isActive(item.href)
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:bg-gray-700 hover:text-white",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
