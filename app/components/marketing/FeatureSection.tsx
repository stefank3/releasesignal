import { features } from "./marketingContent";
import styles from "./MarketingShell.module.css";

export function FeatureSection() {
  return (
    <section className={`${styles.section} ${styles.lightSection}`} id="features">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>Features</p>
          <h2 className={styles.sectionTitle}>
            Built for structured QA decisions, not one-off prompt output.
          </h2>
        </div>

        <div className={styles.featureGrid}>
          {features.map((feature) => (
            <article className={styles.featureCard} key={feature.title}>
              <h3 className={styles.cardTitle}>{feature.title}</h3>
              <p className={styles.cardText}>{feature.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
