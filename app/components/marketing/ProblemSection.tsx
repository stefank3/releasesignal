import { problemPoints } from "./marketingContent";
import styles from "./MarketingShell.module.css";

export function ProblemSection() {
  return (
    <section className={`${styles.section} ${styles.lightSection}`}>
      <div className={`${styles.container} ${styles.problemGrid}`}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>The problem</p>
          <h2 className={styles.sectionTitle}>
            More test cases don&apos;t equal more confidence.
          </h2>
          <p className={styles.sectionCopy}>
            QA teams need evidence they can review, explain, and improve.
            Release Signal helps turn messy planning inputs into structured
            artifacts that support clearer release conversations.
          </p>
        </div>

        <ul className={styles.problemList}>
          {problemPoints.map((point) => (
            <li className={styles.problemItem} key={point}>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
