import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Wordmark } from "./wordmark";

describe("Wordmark", () => {
  it("renders the event name as one accessible image", () => {
    const html = renderToStaticMarkup(<Wordmark />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="MSA Pandora"');
  });

  it("stacks MSA above Pandora", () => {
    const html = renderToStaticMarkup(<Wordmark />);
    expect(html.indexOf(">MSA<")).toBeGreaterThan(-1);
    expect(html.indexOf(">MSA<")).toBeLessThan(html.indexOf(">Pandora<"));
  });

  it("renders the large size by default and halves it for sm", () => {
    expect(renderToStaticMarkup(<Wordmark />)).toContain("font-size:4.5rem");
    expect(renderToStaticMarkup(<Wordmark size="sm" />)).toContain("font-size:2.25rem");
  });
});
