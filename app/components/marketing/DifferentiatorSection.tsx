import { differentiators, guardrailCopy } from "./marketingContent";
import styles from "./MarketingShell.module.css";

export function DifferentiatorSection() {
  return (
    <section className={`${styles.section} ${styles.darkSection}`}>
      <div className={`${styles.container} ${styles.differentiatorGrid}`}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>Differentiator</p>
          <h2 className={styles.sectionTitle}>
            AI helps. Your QA stays the source of truth.
          </h2>
          <p className={styles.sectionCopy}>
            AI can assist with drafting and analysis, but Release Signal keeps
            product truth in structured artifacts and deterministic system
            logic.
          </p>
        </div>

        <div className={styles.guardrailPanel}>
          <strong>{guardrailCopy}</strong>
          <ul>
            {differentiators.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
