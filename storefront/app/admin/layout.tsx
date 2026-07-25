import type { Metadata } from "next";

// Applies to every /admin route (login + dashboard). Keeps the admin out of
// search indexes. The auth guard lives one level down, in (dashboard)/layout.tsx,
// so /admin/login itself stays reachable.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
