import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { getSettings } from "@/lib/settings";
import SettingsForm from "@/components/admin/SettingsForm";
import CronHealth from "@/components/admin/CronHealth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();
  const [settings, { data: admins }] = await Promise.all([
    getSettings(),
    adminDb().from("admin_users").select("id, email, name").eq("active", true).order("email"),
  ]);
  return (
    <div className="space-y-6">
      <SettingsForm
        settings={settings}
        admins={admins ?? []}
      />
      <CronHealth />
    </div>
  );
}
