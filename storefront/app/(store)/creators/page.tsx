import type { Metadata } from "next";
import { inter, newsreader, plexMono } from "@/lib/fonts";
import { getSettings } from "@/lib/settings";
import CreatorLanding from "@/components/creators/CreatorLanding";
import CreatorApplicationForm from "@/components/creators/CreatorApplicationForm";

export const metadata: Metadata = {
  title: "Creator Collective",
  description:
    "Apply to the ECL Creator Collective. Selected creators start with product rewards and three agreed posts, with a path to referral commission and ongoing support.",
  alternates: { canonical: "/creators" },
};

export default async function CreatorsPage() {
  const settings = await getSettings();
  return (
    <div className={`${inter.variable} ${newsreader.variable} ${plexMono.variable}`}>
      <CreatorLanding
        supportEmail={settings.supportEmail}
        application={<CreatorApplicationForm />}
      />
    </div>
  );
}
