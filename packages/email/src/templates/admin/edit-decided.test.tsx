import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { editDecided } from "./edit-decided";

describe("admin edit decided email template", () => {
  it("renders approved email with expected subject and content", async () => {
    const props = { teamName: "Alpha", approved: true, note: null };
    expect(editDecided.subject(props)).toBe("Alpha: change request approved");

    const text = editDecided.text(props);
    expect(text).toContain("Alpha");
    expect(text).toContain("approved");

    const html = await render(editDecided.html(props));
    expect(html).toContain("Alpha");
    expect(html).toContain("MSA Pandora");
    expect(html).toContain("approved");
  });

  it("renders declined email with expected subject and note", async () => {
    const props = {
      teamName: "Alpha",
      approved: false,
      note: "Cannot change leader registration number",
    };
    expect(editDecided.subject(props)).toBe("Alpha: change request declined");

    const text = editDecided.text(props);
    expect(text).toContain("Alpha");
    expect(text).toContain("declined");
    expect(text).toContain("Cannot change leader registration number");

    const html = await render(editDecided.html(props));
    expect(html).toContain("Alpha");
    expect(html).toContain("declined");
    expect(html).toContain("Cannot change leader registration number");
  });
});
