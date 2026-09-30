import { describe, expect, it } from "vitest";
import * as ui from "./index";

// The apps import these from "@pandora/ui". If an Astryx subpath is renamed or removed, this fails here
// instead of in a flow owner's form.
describe("@pandora/ui exports", () => {
  it.each([
    "Wordmark",
    "AppProviders",
    "Banner",
    "Button",
    "Field",
    "FieldLabel",
    "FieldStatus",
    "FileInput",
    "Heading",
    "HStack",
    "Link",
    "Selector",
    "SelectorOption",
    "Step",
    "Stepper",
    "Text",
    "TextInput",
    "VStack",
  ])("exports %s", (name) => {
    expect((ui as Record<string, unknown>)[name]).toBeDefined();
  });
});
