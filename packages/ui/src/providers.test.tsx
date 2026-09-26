import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppProviders } from "./providers";

describe("AppProviders", () => {
  it("renders its children inside the theme", () => {
    const html = renderToStaticMarkup(
      <AppProviders>
        <p>hello</p>
      </AppProviders>,
    );
    expect(html).toContain("<p>hello</p>");
  });
});
