import Image from "next/image";
import Reveal from "@/components/Reveal";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";
import {
  creatorAssets,
  creatorCategoryPanels,
  creatorCopy,
  creatorFaqs,
  creatorStages,
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
          <p className={styles.kicker}>East Coast Labs / Creator Collective</p>
          <h1 id="creator-title" className={styles.headline}>{creatorCopy.heading}</h1>
          <p className={styles.heroText}>{creatorCopy.heroBody}</p>
          <div className={styles.heroActions} data-creator-hero-cta>
            <CreatorCtaLink href="#apply" placement="hero" className={styles.primaryCta}>
              {creatorCopy.cta}<span aria-hidden="true">↗</span>
            </CreatorCtaLink>
            <a href="#rewards" className={styles.secondaryCta}>What&apos;s involved <span aria-hidden="true">↓</span></a>
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
              sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1239px) 48vw, 560px"
              priority
              unoptimized
              className={styles.heroImage}
            />
          </div>
          <span className={styles.marginNote} aria-hidden="true">Between takes</span>
        </figure>
      </section>

      <aside className={`${styles.openingNote} ${styles.container}`} aria-label="About the collaboration">
        <span className={styles.noteMark} aria-hidden="true">↳</span>
        <p>
          You know what works on your account. We&apos;ll agree a brief with you and leave room
          for how you&apos;d tell it. The first collaboration is paid in products; the details are below.
        </p>
        <a href="#rewards" className={styles.noteLink}>Read the arrangement <span aria-hidden="true">↓</span></a>
      </aside>

      <Reveal className="reveal">
        <section className={`${styles.creatorTypes} ${styles.container}`} aria-labelledby="creator-types-title">
          <div className={styles.sectionIntro}>
            <h2 id="creator-types-title">From your corner of the internet</h2>
            <p>These are a few of the worlds we&apos;re interested in. If your work sits somewhere between them, tell us about it.</p>
          </div>
          <div className={styles.creatorCards}>
            {creatorCategoryPanels.map((item) => (
              <article key={item.title} className={`${styles.creatorCard} ${styles[item.shape]}`}>
                <div className={styles.creatorImageWrap}>
                  <Image
                    src={item.asset.src}
                    alt={item.asset.alt}
                    width={item.asset.width}
                    height={item.asset.height}
                    sizes="(max-width: 767px) calc(100vw - 72px), (max-width: 1239px) 29vw, 340px"
                    unoptimized
                    className={styles.creatorImage}
                    style={{ objectPosition: item.asset.objectPosition }}
                  />
                </div>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <section id="rewards" className={styles.rewards} aria-labelledby="creator-rewards-title">
        <div className={`${styles.rewardsInner} ${styles.container}`}>
          <div className={styles.rewardOverview}>
            <h2 id="creator-rewards-title">Here&apos;s the arrangement.</h2>
            <div className={styles.rewardStamp}>
              <p className={styles.rewardLabel}>Your first product, worth up to</p>
              <p className={styles.rewardNumber}>A$300</p>
              <p className={styles.rewardUnit}>In product. No upfront cash fee.</p>
            </div>
            <p className={styles.rewardNote}>
              Selected creators choose an eligible peptide. We confirm availability and both
              product choices, including any allowance for the second vial, before you commit.
            </p>
          </div>
          <div className={styles.arrangement}>
            {creatorStages.map(({ title, copy }) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
            <p className={styles.finePrint}>
              A$300 is the maximum value of the first product in Australian dollars, not a cash payment.
              Product rewards can&apos;t be exchanged for cash. Selection and referral invitations are subject to review.
            </p>
          </div>
        </div>
      </section>

      <Reveal className="reveal">
        <section className={`${styles.editorial} ${styles.container}`} aria-labelledby="creator-standard-title">
          <div className={styles.editorialText}>
            <h2 id="creator-standard-title">We&apos;ll spend more time on your posts than your follower count.</h2>
            <CreatorCtaLink href="#apply" placement="editorial" className={styles.textLink}>
              Tell us about your work <span aria-hidden="true">↗</span>
            </CreatorCtaLink>
          </div>
          <div className={styles.selectionCopy}>
            <p>
              We&apos;ll look through your recent work to get a feel for what you make and who it reaches.
              Your Australian audience and usual organic views matter. We&apos;ll ask for platform
              insights before offering a place.
            </p>
            <p>
              It helps to tell us what you&apos;d make for ECL, even if the idea is still rough.
              We also need to know you can follow an agreed brief and clearly disclose the collaboration.
            </p>
            <div className={styles.ownershipNote}>
              <h3>The work stays yours.</h3>
              <p>
                Any reposting rights go in the brief. Paid ads, exclusivity or use of your
                likeness beyond that need a separate agreement.
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      <section id="apply" aria-labelledby="creator-apply-title" tabIndex={-1} className={`${styles.apply} ${styles.container}`}>
        <div className={styles.applyIntro}>
          <p className={styles.kicker}>Your application</p>
          <h2 id="creator-apply-title" tabIndex={-1}>Send something our way.</h2>
          <p>
            A link to your work and a few details about your audience will get us started.
            There&apos;s space for an idea, too. A few sentences are enough.
          </p>
          <p className={styles.applicationNote}>We read each application and get in touch by email if there&apos;s a fit.</p>
        </div>
        {application}
      </section>

      <Reveal className="reveal">
        <section className={`${styles.faq} ${styles.container}`} aria-labelledby="creator-faq-title">
          <div className={styles.faqHeader}>
            <h2 id="creator-faq-title">A few things you might be wondering</h2>
            <p>Anything else? <a href={`mailto:${supportEmail}`}>Email us.</a></p>
          </div>
          <div className={styles.faqList}>
            {creatorFaqs.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
          <div className={styles.footerCta}>
            <CreatorCtaLink href="#apply" placement="footer" className={styles.primaryCta}>
              {creatorCopy.cta}<span aria-hidden="true">↗</span>
            </CreatorCtaLink>
            <p>We&apos;d like to see what you have in mind.</p>
          </div>
          <ResearchDisclaimer />
          <p className={styles.conceptNote}>
            Images are AI-created scenes with fictional adults, not photographs of ECL partners or product users.
          </p>
        </section>
      </Reveal>
      <CreatorStickyApply />
    </div>
  );
}
