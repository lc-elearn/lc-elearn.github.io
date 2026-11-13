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

describe("collect: failures that must not hide a repo", () => {
  it("rejects on a 500 from a course repo", async () => {
    const routes = {
      [ORG_URL]: [200, [repo("lc-russian")]],
      ...repoRoutes("lc-russian"),
      [`${API}/repos/lc-elearn/lc-russian/commits?sha=main&per_page=1`]: [
        500,
        { message: "x" },
      ],
    } as Record<string, [number, unknown]>;
    await expect(
      collect({ ...OPTIONS, fetch: fakeFetch(routes) }),
    ).rejects.toThrow("GitHub API 500");
  });

  it("rejects on a 403 (rate limit)", async () => {
    const routes = {
      [ORG_URL]: [200, [repo("lc-russian")]],
      ...repoRoutes("lc-russian", [403, { message: "rate limited" }]),
    } as Record<string, [number, unknown]>;
    await expect(
      collect({ ...OPTIONS, fetch: fakeFetch(routes) }),
    ).rejects.toThrow("GitHub API 403");
  });

  it("rejects on a network error", async () => {
    const fetch = async (url: string): Promise<Response> => {
      if (url === ORG_URL)
        return new Response(JSON.stringify([repo("lc-russian")]));
      throw new TypeError("network down");
    };
    await expect(collect({ ...OPTIONS, fetch })).rejects.toThrow(
      "network down",
    );
  });

  it("skips a repo with no commits, with a reason", async () => {
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({
        [ORG_URL]: [200, [repo("empty")]],
        ...repoRoutes("empty"),
        [`${API}/repos/lc-elearn/empty/commits?sha=main&per_page=1`]: [200, []],
      }),
    });
    expect(result.skipped).toEqual([
      { repo: "empty", reason: "no commits on main" },
    ]);
  });
});

describe("collect: listing, branches and templates", () => {
  it("reads a second page when the first is full", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) =>
      repo(`r${i}`, { has_pages: false }),
    );
    const page2 = [repo("lc-base-template", { is_template: true })];
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({
        [ORG_URL]: [200, page1],
        [ORG_URL.replace("&page=1", "&page=2")]: [200, page2],
        [`${API}/repos/lc-elearn/lc-base-template/commits?sha=main&per_page=1`]:
          [200, [{ commit: { committer: { date: "2026-11-12T10:00:00Z" } } }]],
      }),
    });
    expect(result.template?.repo).toBe("lc-base-template");
  });

  it("rejects when the organisation listing is not JSON", async () => {
    await expect(
      collect({
        ...OPTIONS,
        fetch: fakeFetch({ [ORG_URL]: [200, "not json"] }),
      }),
    ).rejects.toThrow();
  });

  it("counts only lesson folders, never the example, files or odd names", async () => {
    const routes = {
      [ORG_URL]: [200, [repo("lc-new")]],
      ...repoRoutes("lc-new"),
      [`${API}/repos/lc-elearn/lc-new/contents/lo-config?ref=main`]: [
        200,
        [
          { name: "lo-00-example", type: "dir" },
          { name: "lo-01-a", type: "dir" },
          { name: "lo-02-b", type: "file" },
          { name: "notes", type: "dir" },
          { name: "lo-x", type: "dir" },
        ],
      ],
    } as Record<string, [number, unknown]>;
    const result = await collect({ ...OPTIONS, fetch: fakeFetch(routes) });
    expect(result.courses[0]?.lessons).toBe(1);
  });

  it("encodes the branch name in URLs", async () => {
    const seen: string[] = [];
    const fetch = async (url: string): Promise<Response> => {
      seen.push(url);
      if (url === ORG_URL)
        return new Response(
          JSON.stringify([repo("lc-x", { default_branch: "feat/a b" })]),
        );
      return new Response("[]", { status: 200 });
    };
    await collect({ ...OPTIONS, fetch });
    expect(seen).toContain(
      `${API}/repos/lc-elearn/lc-x/commits?sha=feat%2Fa%20b&per_page=1`,
    );
  });

  it("skips a second template repo", async () => {
    const commits = [
      200,
      [{ commit: { committer: { date: "2026-11-12T10:00:00Z" } } }],
    ];
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({
        [ORG_URL]: [
          200,
          [
            repo("t1", { is_template: true }),
            repo("t2", { is_template: true }),
          ],
        ],
        [`${API}/repos/lc-elearn/t1/commits?sha=main&per_page=1`]: commits as [
          number,
          unknown,
        ],
        [`${API}/repos/lc-elearn/t2/commits?sha=main&per_page=1`]: commits as [
          number,
          unknown,
        ],
      }),
    });
    expect(result.template?.repo).toBe("t1");
    expect(result.skipped).toEqual([
      { repo: "t2", reason: "a second template repo" },
    ]);
  });
});
