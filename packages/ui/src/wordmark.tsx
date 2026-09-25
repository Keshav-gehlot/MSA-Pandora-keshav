export type WordmarkProps = { size?: "sm" | "lg" };

export function Wordmark({ size = "lg" }: WordmarkProps) {
  const scale = size === "lg" ? 1 : 0.5;
  return (
    <div
      role="img"
      aria-label="MSA Pandora"
      style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1, fontWeight: 600 }}
    >
      <span style={{ fontSize: `${1.5 * scale}rem` }}>MSA</span>
      <span style={{ fontSize: `${4.5 * scale}rem`, letterSpacing: "-0.02em" }}>Pandora</span>
    </div>
  );
}
