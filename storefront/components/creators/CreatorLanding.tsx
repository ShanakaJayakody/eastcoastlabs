import Image from "next/image";
import Reveal from "@/components/Reveal";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";
import {
  creatorAssets,
  creatorCategoryPanels,
  creatorCopy,
  creatorFaqs,
} from "@/lib/creators/content";
import CreatorStickyApply from "./CreatorStickyApply";
import CreatorCtaLink from "./CreatorCtaLink";
import styles from "@/app/(store)/creators/creators.module.css";

export default function CreatorLanding({
  application,
  supportEmail,
}: {
  application: React.ReactNode;
  supportEmail: string;
}) {
  return (
    <div className={styles.root}>
      <section className={`${styles.hero} ${styles.container}`} aria-labelledby="creator-title">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>ECL / Creator Collective</p>
          <h1 id="creator-title" className={styles.headline}>
            <span>{creatorCopy.heading[0]}</span>
            <em>{creatorCopy.heading[1]}</em>
          </h1>
          <p className={styles.heroText}>{creatorCopy.heroBody}</p>
          <div className={styles.heroActions} data-creator-hero-cta>
            <CreatorCtaLink href="#apply" placement="footer" className={styles.primaryCta}>
              {creatorCopy.cta}
              <span aria-hidden="true">-&gt;</span>
            </CreatorCtaLink>
            <a href="#rewards" className={styles.secondaryCta}>
              Explore the rewards
              <span aria-hidden="true">v</span>
            </a>
          </div>
          <p className={styles.practical}>{creatorCopy.practical}</p>
        </div>
        <figure className={styles.coverFigure}>
          <div className={styles.heroMedia}>
            <Image
              src={creatorAssets.cover.src}
              alt={creatorAssets.cover.alt}
              width={creatorAssets.cover.width}
              height={creatorAssets.cover.height}
              sizes="(max-width: 767px) calc(100vw - 40px), min(1200px, calc(100vw - 64px))"
              priority
              className={styles.heroImage}
            />
          </div>
          <figcaption>{creatorAssets.cover.caption}</figcaption>
        </figure>
      </section>

      <section className={`${styles.opportunity} ${styles.container}`} aria-label="Program structure">
        <p>Paid creative briefs</p>
        <p>Your individual perspective</p>
        <p>Ongoing opportunities</p>
      </section>

      <Reveal className="reveal">
        <section className={`${styles.creatorTypes} ${styles.container}`} aria-labelledby="creator-types-title">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>Creator focus</p>
            <h2 id="creator-types-title">Different worlds. Shared curiosity.</h2>
            <p>
              A strong point of view matters more than a follower count. We&apos;re looking for
              original storytellers with a style of their own.
            </p>
          </div>
          <div className={styles.creatorCards}>
            {creatorCategoryPanels.map((item) => (
              <article key={item.title} className={styles.creatorCard}>
                <div className={styles.creatorImageWrap}>
                  <Image
                    src={item.asset.src}
                    alt={item.asset.alt}
                    width={item.asset.width}
                    height={item.asset.height}
                    sizes="(max-width: 767px) calc(100vw - 40px), 31vw"
                    className={styles.creatorImage}
                    style={{ objectPosition: item.asset.objectPosition }}
                  />
                </div>
                <p className={styles.cardIndex}>{item.index}</p>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal className="reveal">
        <section className={`${styles.editorial} ${styles.container}`} aria-labelledby="creator-standard-title">
          <div className={styles.editorialText}>
            <p className={styles.kicker}>01 / The standard</p>
            <h2 id="creator-standard-title">An eye for detail. A point of view.</h2>
            <p>
              We&apos;re looking for creators who notice the details and know how to make a story
              feel considered. Photographers, filmmakers and visual storytellers: show us the work
              that feels most like you.
            </p>
            <CreatorCtaLink href="#apply" placement="editorial" className={styles.textLink}>
              Show us your work -&gt;
            </CreatorCtaLink>
          </div>
          <div className={styles.editorialImages}>
            <figure className={styles.editorialLandscape}>
              <Image
                src={creatorAssets.editorial.src}
                alt={creatorAssets.editorial.alt}
                width={creatorAssets.editorial.width}
                height={creatorAssets.editorial.height}
                sizes="(max-width: 767px) calc(100vw - 40px), 46vw"
                className={styles.editorialImage}
              />
              <figcaption>01 / Natural light</figcaption>
            </figure>
            <figure className={styles.editorialPortrait}>
              <Image
                src={creatorAssets.studio.src}
                alt={creatorAssets.studio.alt}
                width={creatorAssets.studio.width}
                height={creatorAssets.studio.height}
                sizes="(max-width: 767px) calc(100vw - 40px), 28vw"
                className={styles.editorialImage}
              />
              <figcaption>02 / Studio perspective</figcaption>
            </figure>
          </div>
        </section>
      </Reveal>

      <section id="rewards" className={styles.rewards} aria-labelledby="creator-rewards-title">
        <div className={`${styles.rewardsInner} ${styles.container}`}>
          <p className={styles.kicker}>02 / Rewards</p>
          <h2 id="creator-rewards-title">Good work deserves a clear offer.</h2>
          <div className={styles.rewardGrid}>
            <div>
              <p className={styles.rewardNumber}>A$300</p>
              <p className={styles.rewardLabel}>Paid briefs from</p>
              <p className={styles.rewardNote}>
                For selected creators. We agree the scope, fee and usage rights before you start.
              </p>
            </div>
            <div className={styles.rewardCopy}>
              <h3>Create in your own voice</h3>
              <p>
                A clear brief and space for your perspective. We agree what you&apos;ll make and
                how it will be used.
              </p>
            </div>
            <div className={styles.rewardCopy}>
              <h3>Build something ongoing</h3>
              <p>
                A first project can become a longer creative relationship, with each collaboration
                agreed together.
              </p>
            </div>
          </div>
          <p className={styles.finePrint}>
            Fees are in AUD, excluding GST where applicable. Applying does not guarantee selection
            or paid work.
          </p>
        </div>
      </section>

      <Reveal className="reveal">
        <section className={`${styles.process} ${styles.container}`} aria-labelledby="creator-process-title">
          <p className={styles.kicker}>03 / Process</p>
          <h2 id="creator-process-title">How it works</h2>
          <div className={styles.processGrid}>
            {[
              ["01", "Send your perspective.", "Share your profile, portfolio and the kind of work you love making."],
              ["02", "Find the right brief.", "If there is a fit, we will agree a concept, deliverables, fee and usage rights."],
              ["03", "Create. Get paid.", "Deliver the agreed work, collaborate on feedback and receive payment under your brief."],
            ].map(([index, title, copy]) => (
              <article key={title}>
                <p>{index}</p>
                <h3>{title}</h3>
                <span>{copy}</span>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal className="reveal">
        <section className={`${styles.who} ${styles.container}`} aria-labelledby="creator-who-title">
          <p className={styles.kicker}>04 / Who should apply</p>
          <h2 id="creator-who-title">A strong point of view goes further than a follower count.</h2>
          <div className={styles.whoRows}>
            <p>
              <strong>Photographers</strong>
              <span>Composition, light and product detail</span>
            </p>
            <p>
              <strong>Filmmakers</strong>
              <span>Considered short-form stories</span>
            </p>
            <p>
              <strong>Content creators</strong>
              <span>Original ideas and a clear visual identity</span>
            </p>
          </div>
          <p className={styles.whoCopy}>
            You don&apos;t need a huge audience. You do need original work, reliable communication
            and an understanding of the brief. Initial applications are open to Australia-based
            creators aged 18 or over.
          </p>
        </section>
      </Reveal>

      <section id="apply" aria-labelledby="creator-apply-title" tabIndex={-1} className={`${styles.apply} ${styles.container}`}>
        <div className={styles.applyIntro}>
          <p className={styles.kicker}>05 / Application</p>
          <h2 id="creator-apply-title" tabIndex={-1}>Let&apos;s make something considered.</h2>
          <p>
            Tell us a little about yourself and share your best work. We review applications
            individually and contact creators when there is a suitable opportunity.
          </p>
        </div>
        {application}
      </section>

      <Reveal className="reveal">
        <section className={`${styles.faq} ${styles.container}`} aria-labelledby="creator-faq-title">
          <p className={styles.kicker}>06 / FAQ</p>
          <h2 id="creator-faq-title">Questions before you apply</h2>
          <div className={styles.faqList}>
            {creatorFaqs.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
          <div className={styles.footerCta}>
            <CreatorCtaLink href="#apply" placement="hero" className={styles.primaryCta}>
              {creatorCopy.cta}
              <span aria-hidden="true">-&gt;</span>
            </CreatorCtaLink>
            <p>
              Need help with the application? Email{" "}
              <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
            </p>
          </div>
          <ResearchDisclaimer />
          <p className={styles.conceptNote}>
            Concept imagery uses fictional adult models and does not represent actual ECL partners,
            customers, endorsers or product users.
          </p>
        </section>
      </Reveal>

      <CreatorStickyApply />
    </div>
  );
}
