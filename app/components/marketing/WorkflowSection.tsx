import { workflowSteps } from "./marketingContent";
import styles from "./MarketingShell.module.css";

export function WorkflowSection() {
  return (
    <section
      className={`${styles.section} ${styles.bandSection}`}
      id="how-it-works"
    >
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>How it works</p>
          <h2 className={styles.sectionTitle}>
            From rough requirement to readiness support in seven steps.
          </h2>
        </div>

        <div className={styles.workflowGrid}>
          {workflowSteps.map((step, index) => (
            <article className={styles.workflowCard} key={step.title}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <h3 className={styles.cardTitle}>{step.title}</h3>
              <p className={styles.cardText}>{step.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
