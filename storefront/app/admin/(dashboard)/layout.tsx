import { requireAdmin } from "@/lib/admin/auth";
import AdminShell from "@/components/admin/AdminShell";
import {cookies} from 'next/headers';
import {isReadOnlyPreview} from '@/lib/admin/preview-policy';

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
  const theme=(await cookies()).get('ecl-admin-theme')?.value==='dark'?'dark':'light';
  return <AdminShell email={session.email} initialTheme={theme} readOnly={isReadOnlyPreview()}>{children}</AdminShell>;
}
