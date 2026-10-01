import { Wordmark } from "@pandora/ui";

import { RegistrationSection } from "../features/registration/registration-section";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#1f1f1f", color: "#fff" }}>
      <Wordmark />
      <section id="register">
        <RegistrationSection />
      </section>
    </main>
  );
}
