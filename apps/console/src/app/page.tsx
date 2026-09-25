import { Wordmark } from "@pandora/ui";

export default function ConsoleHomePage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", alignContent: "center", gap: "1rem" }}>
      <Wordmark size="sm" />
      <h1 style={{ margin: 0, fontSize: "1rem", fontWeight: 500 }}>Console</h1>
    </main>
  );
}
