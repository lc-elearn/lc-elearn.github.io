import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  formatDate,
  lessonLabel,
  renderPage,
  sortCourses,
} from "./render";
import type { Course, TemplateSite } from "./types";

const UPDATED = new Date("2026-11-13T12:01:00Z");

function course(overrides: Partial<Course> = {}): Course {
  return {
    repo: "lc-russian-basic-vocabulary",
    siteUrl: "https://lc-elearn.github.io/lc-russian-basic-vocabulary/",
    repoUrl: "https://github.com/lc-elearn/lc-russian-basic-vocabulary",
    courseTitle: "Russian Basic Vocabulary",
    languageCode: "ru",
    blurb: "Build up your Russian vocabulary",
    lessons: 6,
    updated: UPDATED,
    ...overrides,
  };
}

const TEMPLATE: TemplateSite = {
  repo: "lc-base-template",
  siteUrl: "https://lc-elearn.github.io/lc-base-template/",
  repoUrl: "https://github.com/lc-elearn/lc-base-template",
  updated: UPDATED,
};

describe("escapeHtml", () => {
  it("escapes the five HTML characters", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
    );
  });
});

describe("lessonLabel", () => {
  it("words the count", () => {
    expect(lessonLabel(0)).toBe("No lessons yet");
    expect(lessonLabel(1)).toBe("1 lesson");
    expect(lessonLabel(6)).toBe("6 lessons");
  });
});

describe("formatDate", () => {
  it("uses UK order in London time", () => {
    expect(formatDate(new Date("2026-11-13T23:30:00Z"))).toBe("13 Nov 2026");
    expect(formatDate(new Date("2026-07-01T23:30:00Z"))).toBe("2 Jul 2026");
  });
});

describe("sortCourses", () => {
  it("sorts by language name, then title, without changing the input", () => {
    const input = [
      course({ languageCode: "ru", courseTitle: "B" }),
      course({ languageCode: "de", courseTitle: "Z" }),
      course({ languageCode: "ru", courseTitle: "A" }),
    ];
    const sorted = sortCourses(input);
    expect(sorted.map((c) => `${c.languageCode} ${c.courseTitle}`)).toEqual([
      "de Z",
      "ru A",
      "ru B",
    ]);
    expect(input[0]?.courseTitle).toBe("B");
  });
});

describe("renderPage", () => {
  const html = renderPage({
    courses: [course()],
    template: TEMPLATE,
    refreshed: UPDATED,
  });

  it("asks search engines not to index it", () => {
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
  });

  it("shows a course card with every field", () => {
    expect(html).toContain("Russian Basic Vocabulary");
    expect(html).toContain("Russian");
    expect(html).toContain("Build up your Russian vocabulary");
    expect(html).toContain("6 lessons");
    expect(html).toContain("Updated 13 Nov 2026");
    expect(html).toContain(
      'href="https://lc-elearn.github.io/lc-russian-basic-vocabulary/"',
    );
    expect(html).toContain(
      'Open course<span class="visually-hidden">: Russian Basic Vocabulary</span>',
    );
    expect(html).toContain(
      'href="https://github.com/lc-elearn/lc-russian-basic-vocabulary"',
    );
  });

  it("shows the template card with its debug pages, after the courses", () => {
    expect(html).toContain("Course template");
    expect(html).toContain("exercise-showcase.html");
    expect(html).toContain("ui-showcase.html");
    expect(html).toContain("debug-sandbox.html");
    expect(html.indexOf("Russian Basic Vocabulary")).toBeLessThan(
      html.indexOf("Course template"),
    );
  });

  it("says when it was refreshed", () => {
    expect(html).toContain("Refreshed 13 Nov 2026, 12:01");
  });

  it("escapes course text", () => {
    const page = renderPage({
      courses: [course({ courseTitle: 'A <b>bold</b> "title"' })],
      template: null,
      refreshed: UPDATED,
    });
    expect(page).toContain("A &lt;b&gt;bold&lt;/b&gt; &quot;title&quot;");
    expect(page).not.toContain("<b>bold</b>");
  });

  it("says so when there are no courses and no template", () => {
    expect(
      renderPage({ courses: [], template: null, refreshed: UPDATED }),
    ).toContain("No courses are published yet.");
  });
});

describe("renderPage details", () => {
  it("gives each Source link a unique name", () => {
    const page = renderPage({
      courses: [course()],
      template: TEMPLATE,
      refreshed: UPDATED,
    });
    expect(page).toContain(
      'Source on GitHub<span class="visually-hidden">: Russian Basic Vocabulary</span>',
    );
    expect(page).toContain(
      'Source on GitHub<span class="visually-hidden">: Course template</span>',
    );
  });

  it("shows the time just after midnight as 00:05, not 24:05", () => {
    const page = renderPage({
      courses: [],
      template: null,
      refreshed: new Date("2026-11-14T00:05:00Z"),
    });
    expect(page).toContain("Refreshed 14 Nov 2026, 00:05");
  });

  it("escapes quotes and angle brackets in a course URL", () => {
    const page = renderPage({
      courses: [course({ siteUrl: 'https://x/"><script>/' })],
      template: null,
      refreshed: UPDATED,
    });
    expect(page).toContain('href="https://x/&quot;&gt;&lt;script&gt;/"');
    expect(page).not.toContain("<script>");
  });

  it("shows the lesson label on the card", () => {
    const one = renderPage({
      courses: [course({ lessons: 1 })],
      template: null,
      refreshed: UPDATED,
    });
    const none = renderPage({
      courses: [course({ lessons: 0 })],
      template: null,
      refreshed: UPDATED,
    });
    expect(one).toContain("1 lesson ·");
    expect(none).toContain("No lessons yet ·");
  });
});
