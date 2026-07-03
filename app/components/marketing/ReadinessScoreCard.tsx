import { readinessSignals } from "./marketingContent";
import styles from "./MarketingShell.module.css";

export function ReadinessScoreCard() {
  return (
    <aside className={styles.scoreCard} aria-label="Example readiness snapshot">
      <div className={styles.scoreHeader}>
        <div>
          <p className={styles.scoreLabel}>Example workspace snapshot</p>
          <h2 className={styles.scoreTitle}>Readiness signal</h2>
        </div>
        <span className={styles.scoreBadge}>Signal only</span>
      </div>

      <div className={styles.scoreBody}>
        {readinessSignals.map((signal) => (
          <div className={styles.metricRow} key={signal.label}>
            <div className={styles.metricTop}>
              <span>{signal.label}</span>
              <span>{signal.value}</span>
            </div>
            <div className={styles.metricTrack} aria-hidden="true">
              <div
                className={styles.metricFill}
                style={{ width: signal.width }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className={styles.scoreNote}>
        Illustration only. This is not user data and not an automatic release
        decision. Final release approval remains with the QA/release owner.
      </p>
    </aside>
  );
}
