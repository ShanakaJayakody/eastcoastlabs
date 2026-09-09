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
          <p className={styles.kicker}>ECL / Creator Collective</p>
          <h1 id="creator-title" className={styles.headline}>
            <span>{creatorCopy.heading[0]}</span>
            <em>{creatorCopy.heading[1]}</em>
          </h1>
          <p className={styles.heroText}>{creatorCopy.heroBody}</p>
          <div className={styles.heroActions} data-creator-hero-cta>
            <CreatorCtaLink href="#apply" placement="hero" className={styles.primaryCta}>
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
        <p>Apply for your first product</p>
        <p>Three posts. A second vial.</p>
        <p>A path to commission</p>
      </section>

      <Reveal className="reveal">
        <section className={`${styles.creatorTypes} ${styles.container}`} aria-labelledby="creator-types-title">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>Creator focus</p>
            <h2 id="creator-types-title">Different worlds. Shared curiosity.</h2>
            <p>
              We&apos;re looking for original storytellers with a clear point of view and an
              engaged community. Show us who you reach and what makes your audience listen.
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
            <h2 id="creator-standard-title">Your voice. A community that listens.</h2>
            <p>
              The strongest partnerships begin with a natural fit. Bring thoughtful content,
              real audience insight and a style of your own. We bring a clear brief, product
              rewards and a path to a longer relationship. Every stage is agreed together.
            </p>
            <CreatorCtaLink href="#apply" placement="editorial" className={styles.textLink}>
              Tell us about your community -&gt;
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
          <h2 id="creator-rewards-title">Start with product. Build a partnership.</h2>
          <div className={styles.rewardGrid}>
            <div>
              <p className={styles.rewardLabel}>Your first product · valued up to</p>
              <p className={styles.rewardNumber}>A$300</p>
              <p className={styles.rewardNote}>
                Pass the fit review and choose an eligible peptide. We confirm your selection
                and posting brief before sending it to you.
              </p>
            </div>
            <div className={styles.rewardCopy}>
              <h3>Three posts. Your next vial.</h3>
              <p>
                After your first product arrives, complete at least three agreed posts to your
                audience. We then send a second vial of your choice from the eligible range.
              </p>
            </div>
            <div className={styles.rewardCopy}>
              <h3>Your audience saves. You earn.</h3>
              <p>
                Successful creators can progress to an audience discount, referral commission,
                and regular gifts and product supplies through an agreed ongoing partnership.
              </p>
            </div>
          </div>
          <p className={styles.finePrint}>
            The first collaboration offers product rewards, with no upfront cash fee. A$300 is
            the first product&apos;s maximum value in Australian dollars. Selection and referral
            progression are subject to review. Product choices and terms are agreed before you start.
          </p>
        </div>
      </section>

      <Reveal className="reveal">
        <section className={`${styles.process} ${styles.container}`} aria-labelledby="creator-process-title">
          <p className={styles.kicker}>03 / Process</p>
          <h2 id="creator-process-title">One partnership. Three stages.</h2>
          <div className={styles.processGrid}>
            {creatorStages.map(({ index, title, copy }) => (
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
          <h2 id="creator-who-title">Real reach. Relevant people. Your own voice.</h2>
          <div className={styles.whoRows}>
            <p>
              <strong>An engaged community</strong>
              <span>Audience size, relevant interests and a clear Australian audience fit</span>
            </p>
            <p>
              <strong>Reach you can show</strong>
              <span>Recent organic views, platform insights and meaningful engagement</span>
            </p>
            <p>
              <strong>A reliable creative partner</strong>
              <span>Original posts, clear disclosures and follow-through on an agreed brief</span>
            </p>
          </div>
          <p className={styles.whoCopy}>
            Audience size matters in context. We look at who you reach, how consistently your
            content connects and whether the partnership makes sense for both of us. Before
            selection, we ask for recent platform insights. Open to Australia-based creators aged 18 or over.
          </p>
        </section>
      </Reveal>

      <section id="apply" aria-labelledby="creator-apply-title" tabIndex={-1} className={`${styles.apply} ${styles.container}`}>
        <div className={styles.applyIntro}>
          <p className={styles.kicker}>05 / Application</p>
          <h2 id="creator-apply-title" tabIndex={-1}>Let&apos;s see what we can build together.</h2>
          <p>
            Tell us about your audience, recent reach and the content you want to create.
            We review every application individually. If there&apos;s a fit, we&apos;ll contact
            you to confirm your insights, product choice and three-post brief.
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
            <CreatorCtaLink href="#apply" placement="footer" className={styles.primaryCta}>
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
