/**
 * collect.ts — asks GitHub which lc-elearn repos publish a site, and reads each one's
 * course.json, lesson folders and last commit (spec §4.2). The only file that touches
 * the network; `fetch` is injectable so the tests never do.
 */
import { parseCourseJson } from "./course-json";
import type { Collected, Course, Skipped, TemplateSite } from "./types";

const API = "https://api.github.com";
const PAGE_SIZE = 100;
const LESSON_FOLDER = /^lo-\d+-/;
const EXAMPLE_LESSON = "lo-00-example";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface CollectOptions {
  org: string;
  /** This landing repo's own name, never listed. */
  selfRepo: string;
  token?: string;
  fetch?: Fetch;
}

interface RepoSummary {
  name: string;
  html_url: string;
  has_pages: boolean;
  archived: boolean;
  is_template: boolean;
  default_branch: string;
}

class NotFound extends Error {}

export async function collect(options: CollectOptions): Promise<Collected> {
  const get = makeGet(options);
  const repos = (await listRepos(get, options.org)).filter(
    (repo) =>
      repo.has_pages && !repo.archived && repo.name !== options.selfRepo,
  );
  const courses: Course[] = [];
  const skipped: Skipped[] = [];
  let template: TemplateSite | null = null;

  for (const repo of repos) {
    const base = `/repos/${options.org}/${repo.name}`;
    const siteUrl = `https://${options.org}.github.io/${repo.name}/`;
    try {
      const updated = await lastCommitDate(get, base, repo.default_branch);
      if (repo.is_template) {
        template = {
          repo: repo.name,
          siteUrl,
          repoUrl: repo.html_url,
          updated,
        };
        continue;
      }
      const text = await get(
        `${base}/contents/course.json?ref=${repo.default_branch}`,
        true,
      ).catch((error) => {
        if (error instanceof NotFound)
          throw new Error(`no course.json on ${repo.default_branch}`);
        throw error;
      });
      const parsed = parseCourseJson(text);
      if (!parsed.ok) {
        skipped.push({ repo: repo.name, reason: parsed.reason });
        continue;
      }
      const lessons = await countLessons(get, base, repo.default_branch);
      courses.push({
        repo: repo.name,
        siteUrl,
        repoUrl: repo.html_url,
        ...parsed.info,
        lessons,
        updated,
      });
    } catch (error) {
      skipped.push({
        repo: repo.name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { courses, template, skipped };
}

/** GET a GitHub API path: the body as text. A 404 throws NotFound; any other failure, an Error. */
function makeGet({ token, fetch = globalThis.fetch }: CollectOptions) {
  return async (path: string, raw = false): Promise<string> => {
    const headers: Record<string, string> = {
      accept: raw
        ? "application/vnd.github.raw+json"
        : "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    };
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(`${API}${path}`, { headers });
    if (response.status === 404) throw new NotFound(path);
    if (!response.ok)
      throw new Error(`GitHub API ${response.status} on ${path}`);
    return response.text();
  };
}

type Get = ReturnType<typeof makeGet>;

async function listRepos(get: Get, org: string): Promise<RepoSummary[]> {
  const all: RepoSummary[] = [];
  for (let page = 1; ; page += 1) {
    const batch = JSON.parse(
      await get(
        `/orgs/${org}/repos?type=public&per_page=${PAGE_SIZE}&page=${page}`,
      ),
    ) as RepoSummary[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) return all;
  }
}

async function lastCommitDate(
  get: Get,
  base: string,
  branch: string,
): Promise<Date> {
  const commits = JSON.parse(
    await get(`${base}/commits?sha=${branch}&per_page=1`),
  ) as {
    commit: { committer: { date: string } };
  }[];
  const date = commits[0]?.commit.committer.date;
  if (!date) throw new Error(`no commits on ${branch}`);
  return new Date(date);
}

async function countLessons(
  get: Get,
  base: string,
  branch: string,
): Promise<number> {
  try {
    const entries = JSON.parse(
      await get(`${base}/contents/lo-config?ref=${branch}`),
    ) as {
      name: string;
      type: string;
    }[];
    return entries.filter(
      (e) =>
        e.type === "dir" &&
        LESSON_FOLDER.test(e.name) &&
        e.name !== EXAMPLE_LESSON,
    ).length;
  } catch (error) {
    if (error instanceof NotFound) return 0;
    throw error;
  }
}
