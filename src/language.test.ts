import { describe, expect, it } from "vitest";
import { languageName } from "./language";

describe("languageName", () => {
  it("names known codes in English", () => {
    expect(languageName("ru")).toBe("Russian");
    expect(languageName("es")).toBe("Spanish");
    expect(languageName("de")).toBe("German");
    expect(languageName("fr")).toBe("French");
  });

  it("returns an unknown or malformed code as given", () => {
    expect(languageName("zz")).toBe("zz");
    expect(languageName("not a code")).toBe("not a code");
  });
});
