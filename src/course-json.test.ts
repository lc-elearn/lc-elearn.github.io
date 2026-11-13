import { describe, expect, it } from "vitest";
import { parseCourseJson } from "./course-json";

const VALID = JSON.stringify({
  courseTitle: "Russian Basic Vocabulary",
  languageCode: "ru",
  landingCopy: {
    heading: "Базовая лексика",
    subheading: "Build up your Russian vocabulary",
  },
  logo: "logo.svg",
});

describe("parseCourseJson", () => {
  it("reads title, language and the subheading as blurb", () => {
    expect(parseCourseJson(VALID)).toEqual({
      ok: true,
      info: {
        courseTitle: "Russian Basic Vocabulary",
        languageCode: "ru",
        blurb: "Build up your Russian vocabulary",
      },
    });
  });

  it("gives a reason for text that is not JSON", () => {
    expect(parseCourseJson("{ nope")).toEqual({
      ok: false,
      reason: "course.json is not valid JSON",
    });
  });

  it("names a missing field", () => {
    const result = parseCourseJson(
      JSON.stringify({ languageCode: "ru", landingCopy: { subheading: "x" } }),
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain("courseTitle");
  });

  it("names a field of the wrong type", () => {
    const result = parseCourseJson(
      JSON.stringify({
        courseTitle: "T",
        languageCode: 7,
        landingCopy: { subheading: "x" },
      }),
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain("languageCode");
  });
});
