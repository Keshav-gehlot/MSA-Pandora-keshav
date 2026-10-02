import { Button } from "@pandora/ui";
import styles from "./landing.module.css";

const buttonShape = { minWidth: "var(--nav-button-width)", height: 44, borderRadius: 8, fontWeight: 700 } as const;

const LINKS = [
  { href: "#overview", label: "Overview" },
  { href: "#about", label: "About" },
  { href: "#timeline", label: "Timeline" },
] as const;

export function LandingNav() {
  return (
    <header className={styles.nav}>
      <a href="#overview" className={styles.brand}>
        MSA Pandora
      </a>
      <nav aria-label="Sections" className={styles.links}>
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} className={styles.link}>
            {link.label}
          </a>
        ))}
      </nav>
      <div className={styles.actions}>
        <Button
          label="Sign In"
          variant="secondary"
          href="/sign-in"
          style={{ ...buttonShape, background: "transparent", color: "var(--pandora-ink)", border: "1px solid var(--pandora-ink)" }}
        />
        <Button
          label="Register"
          variant="primary"
          href="#register"
          style={{ ...buttonShape, background: "var(--pandora-ink)", color: "var(--pandora-paper)" }}
        />
      </div>
    </header>
  );
}
