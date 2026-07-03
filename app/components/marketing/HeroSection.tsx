import {
  betaMicrocopy,
  betaTrialHref,
  guardrailCopy,
  primaryCtaLabel,
} from "./marketingContent";
import { ReadinessScoreCard } from "./ReadinessScoreCard";
import styles from "./MarketingShell.module.css";

export function HeroSection() {
  return (
    <section className={`${styles.section} ${styles.hero}`}>
      <div className={`${styles.container} ${styles.heroGrid}`}>
        <div>
          <p className={styles.eyebrow}>QA intelligence for release teams</p>
          <h1 className={styles.heroTitle}>
            Know when you&apos;re actually ready to ship.
          </h1>
          <p className={styles.heroCopy}>
            Release Signal helps QA teams turn requirements, test suites,
            reviews, and execution evidence into a structured
            release-readiness signal.
          </p>

          <div className={styles.actionRow}>
            <a className={styles.buttonPrimary} href={betaTrialHref}>
              {primaryCtaLabel}
            </a>
            <a className={styles.buttonSecondary} href="#how-it-works">
              See how it works
            </a>
          </div>

          <p className={styles.microcopy}>{betaMicrocopy}</p>
          <p className={styles.heroFootnote}>{guardrailCopy}</p>
        </div>

        <ReadinessScoreCard />
      </div>
    </section>
  );
}
