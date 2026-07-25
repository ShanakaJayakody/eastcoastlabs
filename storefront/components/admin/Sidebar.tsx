"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { NAV } from "@/lib/admin/nav";
import { signOut } from "@/lib/admin/auth-actions";

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({
  email,
  onNavigate,
  onClose,
  showClose,
}: {
  email: string;
  onNavigate?: () => void;
  onClose?: () => void;
  showClose?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r border-line bg-ink-2">
      <div className="flex items-center justify-between px-5 py-4">
        <Link href="/admin" onClick={onNavigate} className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-2 bg-surface font-mono text-sm font-bold text-accent">
            EC
          </span>
          <span className="text-sm font-semibold text-fg">East Coast Labs</span>
        </Link>
        {showClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-md p-1 text-muted hover:text-fg lg:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-surface-2 font-medium text-fg"
                  : "text-fg-2 hover:bg-surface hover:text-fg"
              }`}
            >
              <Icon
                size={17}
                className={active ? "text-accent" : "text-muted group-hover:text-fg-2"}
              />
              <span className="flex-1">{item.label}</span>
              {item.phase && (
                <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-2">
                  soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-3 py-3">
        <div className="truncate px-3 pb-2 text-xs text-muted" title={email}>
          {email}
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg-2 transition hover:bg-surface hover:text-fg"
          >
            <LogOut size={17} className="text-muted" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
