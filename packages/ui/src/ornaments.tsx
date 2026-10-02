import type { CSSProperties, ReactNode } from "react";

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const FLIP: Record<Corner, string> = {
  "top-left": "none",
  "top-right": "scaleX(-1)",
  "bottom-left": "scaleY(-1)",
  "bottom-right": "scale(-1, -1)",
};

const PLACE: Record<Corner, CSSProperties> = {
  "top-left": { top: 0, left: 0 },
  "top-right": { top: 0, right: 0 },
  "bottom-left": { bottom: 0, left: 0 },
  "bottom-right": { bottom: 0, right: 0 },
};

/**
 * The stepped, maze-like corner mark from the Figma design, drawn once for the top-left and mirrored for the other
 * corners. Gold by default; set the `--ornament-color` custom property on it or a parent to recolour.
 */
export function CornerOrnament({
  corner = "top-left",
  size = 50,
  inset = 0,
}: {
  corner?: Corner;
  size?: number;
  /** Distance in pixels from the box's edges. */
  inset?: number;
}) {
  const place = Object.fromEntries(Object.entries(PLACE[corner]).map(([edge]) => [edge, inset]));
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 100 102"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{
        position: "absolute",
        pointerEvents: "none",
        color: "var(--ornament-color, var(--pandora-gold))",
        transform: FLIP[corner],
        ...place,
      }}
    >
      <rect x="1" y="1" width="18" height="18" />
      <line x1="61" x2="61" y2="60" />
      <line x1="1" x2="1" y2="100" />
      <line x1="20.7071" y1="80.7071" x2="0.707107" y2="100.707" />
      <line x1="41" x2="41" y2="40" />
      <line y1="59" x2="60" y2="59" />
      <line y1="1" x2="100" y2="1" />
      <line x1="79.2929" y1="21.2929" x2="99.2929" y2="1.29289" />
      <line y1="39" x2="40" y2="39" />
    </svg>
  );
}

export type OrnamentFrameProps = {
  children: ReactNode;
  /** Corner mark size in pixels. */
  cornerSize?: number;
  /** Distance in pixels the corner marks sit in from the frame's edges. */
  inset?: number;
  /** Draw a border in the ornament colour around the frame. */
  bordered?: boolean;
  /** Element to render. Use "span" inside a button or link, where a div is not allowed. */
  as?: "div" | "span";
  style?: CSSProperties;
};

/** A positioned box with the corner ornament in all four corners; the track cards and the hero use it. */
export function OrnamentFrame({
  children,
  cornerSize = 50,
  inset = 0,
  bordered = false,
  as: Tag = "div",
  style,
}: OrnamentFrameProps) {
  return (
    <Tag
      style={{
        position: "relative",
        border: bordered ? "2px solid var(--ornament-color, var(--pandora-gold))" : undefined,
        ...style,
      }}
    >
      <CornerOrnament corner="top-left" size={cornerSize} inset={inset} />
      <CornerOrnament corner="top-right" size={cornerSize} inset={inset} />
      <CornerOrnament corner="bottom-left" size={cornerSize} inset={inset} />
      <CornerOrnament corner="bottom-right" size={cornerSize} inset={inset} />
      {children}
    </Tag>
  );
}

const rule: CSSProperties = { display: "block", width: "100%", overflow: "visible" };

/** A zigzag rule that repeats to fill its width (the purple lines beside "The Ideology"). */
export function ZigzagDivider({ height = 12 }: { height?: number }) {
  return (
    <svg aria-hidden="true" height={height} style={rule} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <defs>
        <pattern id="pandora-zigzag" width="12" height={height} patternUnits="userSpaceOnUse">
          <polyline points={`0,${height - 1} 6,1 12,${height - 1}`} />
        </pattern>
      </defs>
      <rect width="100%" height={height} fill="url(#pandora-zigzag)" stroke="none" />
    </svg>
  );
}

/** A row of small outlined diamonds that repeats to fill its width. */
export function DiamondRule({ height = 15 }: { height?: number }) {
  const half = height / 2;
  return (
    <svg aria-hidden="true" height={height} style={rule} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <defs>
        <pattern id="pandora-diamonds" width={height + 2} height={height} patternUnits="userSpaceOnUse">
          <polygon points={`${half},1 ${height - 1},${half} ${half},${height - 1} 1,${half}`} />
        </pattern>
      </defs>
      <rect width="100%" height={height} fill="url(#pandora-diamonds)" stroke="none" />
    </svg>
  );
}
