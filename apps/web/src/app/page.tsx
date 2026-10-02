import type { Metadata } from "next";
import { pageTitle, siteConfig } from "@pandora/core";
import { LightScope } from "@pandora/ui";
import { About } from "../features/landing/about";
import { Challenge } from "../features/landing/challenge";
import { Hero } from "../features/landing/hero";
import { Ideology } from "../features/landing/ideology";
import { LandingNav } from "../features/landing/landing-nav";
import styles from "../features/landing/landing.module.css";
import { LandingFooter } from "../features/landing/landing-footer";
import { Register } from "../features/landing/register";
import { Timeline } from "../features/landing/timeline";
import { Tracks } from "../features/landing/tracks";

const description =
  "Pandora is a one-day build event by Microsoft Student Ambassadors SRM: teams of 3 or 4 take on four tracks and three episodes on 23rd October 2026.";

export const metadata: Metadata = {
  title: pageTitle(),
  description,
  openGraph: {
    title: pageTitle(),
    description,
    type: "website",
    images: [{ url: "/landing/hero-landscape.webp", width: 1600, height: 900 }],
  },
};

// Lets search engines show the event details. The date and venue match the facts grid.
const eventJsonLd = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: siteConfig.name,
  description,
  startDate: "2026-10-23",
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  location: {
    "@type": "Place",
    name: "TP Ganeshan Mini Hall 1",
    address: "SRM Institute of Science and Technology, Kattankulathur",
  },
  organizer: { "@type": "Organization", name: siteConfig.organizer },
};

export default function HomePage() {
  return (
    <LightScope>
      <div className={styles.page}>
        <a href="#overview" className={styles.skip}>
          Skip to the content
        </a>
        <LandingNav />
        <main>
          <Hero />
          <Ideology />
          <Challenge />
          <Tracks />
          <Timeline />
          <About />
          <Register />
        </main>
        <LandingFooter />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }} />
      </div>
    </LightScope>
  );
}
