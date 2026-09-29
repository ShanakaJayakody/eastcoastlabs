import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import CreatorLanding from "@/components/creators/CreatorLanding";
import CreatorApplicationForm from "@/components/creators/CreatorApplicationForm";

export const metadata: Metadata = {
  title: "Creator Collective",
  description:
    "Make content about fitness, everyday health or biohacking? Apply to work with East Coast Labs. See the product rewards, three-post brief and how to get started.",
  alternates: { canonical: "/creators" },
};

export default async function CreatorsPage() {
  const settings = await getSettings();
  return (
    <>
      <CreatorLanding
        supportEmail={settings.supportEmail}
        application={<CreatorApplicationForm />}
      />
    </>
  );
}
