import { faqs } from "./marketingContent";
import styles from "./MarketingShell.module.css";

export function FaqSection() {
  return (
    <section className={`${styles.section} ${styles.lightSection}`} id="faq">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>FAQ</p>
          <h2 className={styles.sectionTitle}>
            Clear boundaries for the controlled beta.
          </h2>
        </div>

        <div className={styles.faqList}>
          {faqs.map((faq) => (
            <details className={styles.faqItem} key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
