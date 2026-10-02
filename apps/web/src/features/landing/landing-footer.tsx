import { siteConfig } from "@pandora/core";
import styles from "./landing.module.css";

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <p>
        {siteConfig.name} <span className={styles.footerMuted}>· {siteConfig.organizer}</span>
      </p>
      <p>
        <a href="/sign-in">Sign in</a> <span className={styles.footerMuted}>· 23rd October 2026</span>
      </p>
    </footer>
  );
}
