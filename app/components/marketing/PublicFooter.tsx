import { contactEmail, trustLinks } from "./marketingContent";
import styles from "./MarketingShell.module.css";

export function PublicFooter() {
  return (
    <footer className={styles.footerRoot}>
      <div className={`${styles.container} ${styles.footer}`}>
        <div className={styles.footerInner}>
          <div>
            <div>Release Signal by RSF Labs.</div>
            <div>
              Controlled beta contact:{" "}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </div>
          </div>

          <nav className={styles.footerNav} aria-label="Trust and legal pages">
            {trustLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
