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
    // Verb-first shortcuts for the jobs done many times a day, so ⌘K reaches an
    // action — not just a page — in two keystrokes.
    const actions: CommandItem[] = [
      {
        id: "action:new-product",
        label: "Add product",
        group: "Actions",
        href: "/admin/products/new",
        keywords: ["create", "new", "add", "product", "sku"],
      },
      {
        id: "action:new-order",
        label: "Create manual order",
        group: "Actions",
        href: "/admin/orders/new",
        keywords: ["new", "order", "manual", "phone", "bank transfer"],
      },
      {
        id: "action:to-fulfil",
        label: "Orders to fulfil",
        group: "Actions",
        href: "/admin/orders",
        keywords: ["ship", "fulfil", "fulfill", "queue", "pack"],
      },
      {
        id: "action:low-stock",
        label: "Low stock products",
        group: "Actions",
        href: "/admin/products?low=1",
        keywords: ["restock", "stock", "inventory", "reorder", "low"],
      },
      {
        id: "action:pending-reviews",
        label: "Review moderation queue",
        group: "Actions",
        href: "/admin/reviews",
        keywords: ["review", "moderate", "approve", "pending"],
      },
    ];

    return [
      ...nav,
      ...actions,
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
