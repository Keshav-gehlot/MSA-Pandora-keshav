import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CornerOrnament, DiamondRule, OrnamentFrame, ZigzagDivider } from "./ornaments";

describe("CornerOrnament", () => {
  it("is decorative: hidden from assistive technology", () => {
    expect(renderToStaticMarkup(<CornerOrnament />)).toContain('aria-hidden="true"');
  });

  it("mirrors the one drawing into each corner", () => {
    expect(renderToStaticMarkup(<CornerOrnament corner="top-left" />)).not.toContain("scale");
    expect(renderToStaticMarkup(<CornerOrnament corner="top-right" />)).toContain("scaleX(-1)");
    expect(renderToStaticMarkup(<CornerOrnament corner="bottom-left" />)).toContain("scaleY(-1)");
    expect(renderToStaticMarkup(<CornerOrnament corner="bottom-right" />)).toContain("scale(-1, -1)");
  });

  it("sits inset from the edges when asked to", () => {
    const html = renderToStaticMarkup(<CornerOrnament corner="top-right" inset={12} />);
    expect(html).toContain("top:12px");
    expect(html).toContain("right:12px");
  });

  it("is gold unless a parent sets --ornament-color", () => {
    expect(renderToStaticMarkup(<CornerOrnament />)).toContain("var(--ornament-color, var(--pandora-gold))");
  });
});

describe("OrnamentFrame", () => {
  it("renders its content between four corner marks", () => {
    const html = renderToStaticMarkup(
      <OrnamentFrame>
        <p>Track A</p>
      </OrnamentFrame>,
    );
    expect(html.match(/<svg/g)).toHaveLength(4);
    expect(html).toContain("<p>Track A</p>");
  });
});

describe("OrnamentFrame as a span", () => {
  it("can render a span so it is valid inside a button", () => {
    const html = renderToStaticMarkup(<OrnamentFrame as="span">x</OrnamentFrame>);
    expect(html.startsWith("<span")).toBe(true);
    expect(html).not.toContain("<div");
  });
});

describe("dividers", () => {
  it("render as decorative, full-width rules", () => {
    for (const html of [renderToStaticMarkup(<ZigzagDivider />), renderToStaticMarkup(<DiamondRule />)]) {
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain("width:100%");
    }
  });
});
