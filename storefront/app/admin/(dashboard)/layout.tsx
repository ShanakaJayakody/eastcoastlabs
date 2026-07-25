import { requireAdmin } from "@/lib/admin/auth";
import AdminShell from "@/components/admin/AdminShell";

// The guarded shell. requireAdmin() redirects unauthenticated users to /admin/login
// and returns a 403 for authenticated-but-not-allow-listed users, BEFORE any
// protected page renders.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  return <AdminShell email={session.email}>{children}</AdminShell>;
}
