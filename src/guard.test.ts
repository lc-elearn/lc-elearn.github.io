import { describe, expect, it } from "vitest";
import { shouldPublish } from "./guard";
import type { Collected } from "./types";

const COURSE = {
  repo: "r",
  siteUrl: "u",
  repoUrl: "g",
  courseTitle: "T",
  languageCode: "ru",
  blurb: "b",
  lessons: 1,
  updated: new Date(),
};

describe("shouldPublish", () => {
  it("allows a page with courses, even if some repos were skipped", () => {
    const collected: Collected = {
      courses: [COURSE],
      template: null,
      skipped: [{ repo: "x", reason: "no course.json on main" }],
    };
    expect(shouldPublish(collected)).toEqual({ ok: true });
  });

  it("allows an empty page when nothing was skipped", () => {
    expect(shouldPublish({ courses: [], template: null, skipped: [] })).toEqual(
      { ok: true },
    );
  });

  it("refuses an empty page when repos were skipped, listing why", () => {
    const result = shouldPublish({
      courses: [],
      template: null,
      skipped: [
        { repo: "a", reason: "course.json is not valid JSON" },
        { repo: "b", reason: "no course.json on main" },
      ],
    });
    expect(result.ok).toBe(false);
    const reason = !result.ok ? result.reason : "";
    expect(reason).toContain("a: course.json is not valid JSON");
    expect(reason).toContain("b: no course.json on main");
  });
});
