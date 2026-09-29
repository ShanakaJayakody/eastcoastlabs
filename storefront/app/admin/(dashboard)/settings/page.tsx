import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { getSettings } from "@/lib/settings";
import SettingsForm from "@/components/admin/SettingsForm";
import CronHealth from "@/components/admin/CronHealth";
import AdminSmsSettings from "@/components/admin/AdminSmsSettings";
import { getAdminSmsSettings, recentAdminSms } from "@/lib/admin/daily-sms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();
  const sms = await Promise.all([getAdminSmsSettings(),recentAdminSms()])
    .then(([settings,history])=>({settings,history,error:undefined as string|undefined}))
    .catch(()=>({settings:null,history:[],error:'Director SMS setup is not available yet.'}));
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
      <AdminSmsSettings {...sms} serverEnabled={process.env.ADMIN_SMS_ENABLED==='true'} />
    </div>
  );
}
