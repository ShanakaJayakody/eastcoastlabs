"use client";

import { useMemo, useState } from "react";
import { Toaster } from "sonner";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { CommandPalette, type CommandItem } from "./CommandPalette";
import { NAV } from "@/lib/admin/nav";
import { signOut } from "@/lib/admin/auth-actions";
import { searchAdmin } from "@/app/admin/search-actions";

export default function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  const paletteItems: CommandItem[] = useMemo(() => {
    const nav = NAV.map((n) => ({
      id: `nav:${n.href}`,
      label: n.label,
      group: "Go to",
      href: n.href,
      hint: n.phase ? "soon" : undefined,
    }));
    return [
      ...nav,
      {
        id: "action:signout",
        label: "Sign out",
        group: "Actions",
        onSelect: () => {
          void signOut();
        },
        keywords: ["logout", "log out", "exit"],
      },
    ];
  }, []);

  return (
    <div className="min-h-screen bg-ink text-fg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:flex">
        <Sidebar email={email} />
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
            onClick={() => setNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0">
            <Sidebar
              email={email}
              showClose
              onClose={() => setNavOpen(false)}
              onNavigate={() => setNavOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <Topbar onOpenNav={() => setNavOpen(true)} />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <CommandPalette items={paletteItems} onSearch={searchAdmin} />
      <Toaster theme="dark" position="top-right" richColors />
    </div>
  );
}
