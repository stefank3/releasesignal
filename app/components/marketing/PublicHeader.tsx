import {
  betaTrialHref,
  navLinks,
  primaryCtaLabel,
  signInHref,
} from "./marketingContent";
import styles from "./MarketingShell.module.css";

export function PublicHeader() {
  return (
    <header className={styles.header}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <a className={styles.brand} href="/">
          Release Signal
        </a>

        <nav className={styles.nav} aria-label="Public navigation">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <a className={styles.signInLink} href={signInHref}>
            Sign in
          </a>
          <a className={styles.buttonPrimary} href={betaTrialHref}>
            {primaryCtaLabel}
          </a>
        </div>
      </div>
    </header>
  );
}
