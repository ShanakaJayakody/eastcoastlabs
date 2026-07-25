import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { getSettings } from "@/lib/settings";
import SettingsForm from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();
  const [settings, { data: admins }] = await Promise.all([
    getSettings(),
    adminDb().from("admin_users").select("email").eq("active", true).order("email"),
  ]);
  return (
    <SettingsForm
      settings={settings}
      adminEmails={(admins ?? []).map((a) => a.email as string)}
    />
  );
}
