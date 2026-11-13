import { describe, expect, it } from "vitest";
import { collect } from "./collect";

const API = "https://api.github.com";
const COURSE_JSON = JSON.stringify({
  courseTitle: "Russian",
  languageCode: "ru",
  landingCopy: { subheading: "Blurb" },
});

function repo(name: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    html_url: `https://github.com/lc-elearn/${name}`,
    has_pages: true,
    archived: false,
    is_template: false,
    default_branch: "main",
    ...extra,
  };
}

/** A fake fetch: URL → [status, body]. An unlisted URL is a 404. */
function fakeFetch(routes: Record<string, [number, unknown]>) {
  return async (url: string): Promise<Response> => {
    const [status, body] = routes[url] ?? [404, { message: "Not Found" }];
    return new Response(
      typeof body === "string" ? body : JSON.stringify(body),
      { status },
    );
  };
}

function repoRoutes(
  name: string,
  courseJson: [number, unknown] = [200, COURSE_JSON],
) {
  return {
    [`${API}/repos/lc-elearn/${name}/contents/course.json?ref=main`]:
      courseJson,
    [`${API}/repos/lc-elearn/${name}/contents/lo-config?ref=main`]: [
      200,
      [
        { name: "lo-00-example", type: "dir" },
        { name: "lo-01-family", type: "dir" },
        { name: "lo-02-work", type: "dir" },
        { name: "README.md", type: "file" },
      ],
    ],
    [`${API}/repos/lc-elearn/${name}/commits?sha=main&per_page=1`]: [
      200,
      [{ commit: { committer: { date: "2026-11-13T12:01:00Z" } } }],
    ],
  } satisfies Record<string, [number, unknown]>;
}

const ORG_URL = `${API}/orgs/lc-elearn/repos?type=public&per_page=100&page=1`;
const OPTIONS = { org: "lc-elearn", selfRepo: "lc-elearn.github.io" };

describe("collect", () => {
  it("builds a course from a published repo", async () => {
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({
        [ORG_URL]: [200, [repo("lc-russian")]],
        ...repoRoutes("lc-russian"),
      }),
    });
    expect(result.courses).toEqual([
      {
        repo: "lc-russian",
        siteUrl: "https://lc-elearn.github.io/lc-russian/",
        repoUrl: "https://github.com/lc-elearn/lc-russian",
        courseTitle: "Russian",
        languageCode: "ru",
        blurb: "Blurb",
        lessons: 2,
        updated: new Date("2026-11-13T12:01:00Z"),
      },
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("leaves out repos without Pages, archived repos and itself", async () => {
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({
        [ORG_URL]: [
          200,
          [
            repo("no-pages", { has_pages: false }),
            repo("old", { archived: true }),
            repo("lc-elearn.github.io"),
          ],
        ],
      }),
    });
    expect(result).toEqual({ courses: [], template: null, skipped: [] });
  });

  it("makes the template repo the template card, without reading its course.json", async () => {
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({
        [ORG_URL]: [200, [repo("lc-base-template", { is_template: true })]],
        [`${API}/repos/lc-elearn/lc-base-template/commits?sha=main&per_page=1`]:
          [200, [{ commit: { committer: { date: "2026-11-12T10:00:00Z" } } }]],
      }),
    });
    expect(result.template).toEqual({
      repo: "lc-base-template",
      siteUrl: "https://lc-elearn.github.io/lc-base-template/",
      repoUrl: "https://github.com/lc-elearn/lc-base-template",
      updated: new Date("2026-11-12T10:00:00Z"),
    });
    expect(result.courses).toEqual([]);
  });

  it("skips a repo with no course.json, with a reason, and keeps the others", async () => {
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({
        [ORG_URL]: [200, [repo("lc-russian"), repo("not-a-course")]],
        ...repoRoutes("lc-russian"),
        ...repoRoutes("not-a-course", [404, { message: "Not Found" }]),
      }),
    });
    expect(result.courses.map((c) => c.repo)).toEqual(["lc-russian"]);
    expect(result.skipped).toEqual([
      { repo: "not-a-course", reason: "no course.json on main" },
    ]);
  });

  it("skips a repo whose course.json is invalid", async () => {
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({
        [ORG_URL]: [200, [repo("broken")]],
        ...repoRoutes("broken", [200, "{ nope"]),
      }),
    });
    expect(result.skipped).toEqual([
      { repo: "broken", reason: "course.json is not valid JSON" },
    ]);
  });

  it("counts no lessons when lo-config is missing", async () => {
    const routes = repoRoutes("lc-new");
    delete (routes as Record<string, unknown>)[
      `${API}/repos/lc-elearn/lc-new/contents/lo-config?ref=main`
    ];
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({ [ORG_URL]: [200, [repo("lc-new")]], ...routes }),
    });
    expect(result.courses[0]?.lessons).toBe(0);
  });

  it("throws when the organisation cannot be listed", async () => {
    await expect(
      collect({
        ...OPTIONS,
        fetch: fakeFetch({ [ORG_URL]: [500, { message: "boom" }] }),
      }),
    ).rejects.toThrow("GitHub API 500");
  });

  it("sends the token when given one", async () => {
    const seen: (string | null)[] = [];
    const fetch = async (
      url: string,
      init?: RequestInit,
    ): Promise<Response> => {
      seen.push(new Headers(init?.headers).get("authorization"));
      return new Response(JSON.stringify(url === ORG_URL ? [] : {}), {
        status: 200,
      });
    };
    await collect({ ...OPTIONS, token: "abc", fetch });
    expect(seen).toEqual(["Bearer abc"]);
  });
});
