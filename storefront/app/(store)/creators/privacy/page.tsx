import type { Metadata } from "next";
import Link from "next/link";
import { inter, newsreader, plexMono } from "@/lib/fonts";
import { getSettings } from "@/lib/settings";
import { CREATOR_PRIVACY_VERSION } from "@/lib/creators/content";
import styles from "../creators.module.css";

export const metadata: Metadata = {
  title: "Creator Privacy Notice",
  description: "How East Coast Labs handles Creator Collective application details.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/creators/privacy" },
};

export default async function CreatorPrivacyPage() {
  const settings = await getSettings();
  return (
    <div className={`${inter.variable} ${newsreader.variable} ${plexMono.variable}`}>
      <main className={`${styles.root} ${styles.privacyPage}`}>
        <article className={styles.privacyArticle}>
          <p className={styles.kicker}>Creator Privacy Notice</p>
          <h1>How we handle creator applications</h1>
          <p>
            This notice applies to ECL Creator Collective applications submitted through the
            East Coast Labs website. Version: {CREATOR_PRIVACY_VERSION}.
          </p>
          <h2>What we collect</h2>
          <p>
            We collect your name, email address, primary social profile, optional portfolio URL,
            main discipline, content focus, Australian state or territory, optional audience range,
            application pitch (including any audience and reach insights you choose to share),
            age/location confirmation, application consent and submission
            timestamps.
          </p>
          <h2>Why we collect it</h2>
          <p>
            We use these details to assess audience fit and suitability for the creator program and
            to contact you about your application. Applying does not subscribe you to marketing,
            create an account, create a contract, trigger product supply or arrange payment.
          </p>
          <h2>Who can access it</h2>
          <p>
            Creator application records are available only to authorised East Coast Labs reviewers
            and service providers needed to operate the website and database. We do not fetch,
            scrape or embed your profile pages as part of submission.
          </p>
          <h2>Retention and deletion</h2>
          <p>
            Unselected applications are deleted in a weekly review once they are older than 180
            days. Accepted creator records are handled under a separately agreed creator
            relationship and retention policy. You can request deletion or ask questions by
            emailing{" "}
            <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>.
          </p>
          <p>
            <Link href="/creators">Return to Creator Collective</Link>
          </p>
        </article>
      </main>
    </div>
  );
}
