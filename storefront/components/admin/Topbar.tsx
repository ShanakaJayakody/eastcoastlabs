"use client";

import { usePathname } from "next/navigation";
import { Menu, Search, Moon, Sun } from "lucide-react";
import {useAdminTheme} from './AdminThemeProvider';
import { NAV } from "@/lib/admin/nav";

function titleFor(pathname: string): string {
  const match = [...NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
  return match?.label ?? "Admin";
}

/**
 * Dispatch a synthetic ⌘K so the (self-contained) CommandPalette opens.
 * Must target `document` — the palette's keydown listener is registered there, and
 * window.dispatchEvent would never reach it.
 */
function openPalette() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
  );
}

export default function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const pathname = usePathname();
  const {theme,setTheme}=useAdminTheme();

  return (
    <header className="admin-workspace-topbar sticky top-0 z-20 flex items-center gap-3 border-b border-line px-5">
      <button
        onClick={onOpenNav}
        aria-label="Open menu"
        className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-fg lg:hidden"
      >
        <Menu size={20} />
      </button>

      <h1 className="text-sm font-semibold text-fg">
        {titleFor(pathname)}
      </h1>

      <div className="flex-1" />
      <button className="admin-theme-toggle" onClick={()=>setTheme(theme==='light'?'dark':'light')} aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button>

      <button
        onClick={openPalette}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:border-accent/40 hover:text-fg-2 hover:shadow-[0_0_16px_-6px_rgba(55,226,212,0.5)]"
      >
        <Search size={14} />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] text-muted-2 sm:inline">
          ⌘K
        </kbd>
      </button>
    </header>
  );
}
