import { languageName } from "./language";
import type { Course, TemplateSite } from "./types";

const TIME_ZONE = "Europe/London";
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
});

/** The template's debug pages its card links to (spec §4.3). */
const TEMPLATE_PAGES: readonly { file: string; label: string }[] = [
  { file: "", label: "Home page" },
  { file: "exercise-showcase.html", label: "Exercise showcase" },
  { file: "ui-showcase.html", label: "UI showcase" },
  { file: "debug-sandbox.html", label: "Sandbox" },
];

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

export function lessonLabel(count: number): string {
  if (count === 0) return "No lessons yet";
  return count === 1 ? "1 lesson" : `${count} lessons`;
}

export function formatDate(date: Date): string {
  return DATE.format(date);
}

function formatDateTime(date: Date): string {
  return `${DATE.format(date)}, ${TIME.format(date)}`;
}

/** A–Z by language name, then by title. Returns a new array. */
export function sortCourses(courses: readonly Course[]): Course[] {
  return [...courses].sort(
    (a, b) =>
      languageName(a.languageCode).localeCompare(
        languageName(b.languageCode),
        "en",
      ) || a.courseTitle.localeCompare(b.courseTitle, "en"),
  );
}

function courseCard(course: Course): string {
  const title = escapeHtml(course.courseTitle);
  return `
      <li>
        <article class="card">
          <p class="card-language">${escapeHtml(languageName(course.languageCode))}</p>
          <h2 class="card-title">${title}</h2>
          <p class="card-blurb">${escapeHtml(course.blurb)}</p>
          <p class="card-meta">${lessonLabel(course.lessons)} · Updated ${formatDate(course.updated)}</p>
          <p class="card-links">
            <a class="card-open" href="${escapeHtml(course.siteUrl)}">Open course<span class="visually-hidden">: ${title}</span></a>
            <a class="card-source" href="${escapeHtml(course.repoUrl)}">Source on GitHub</a>
          </p>
        </article>
      </li>`;
}

function templateCard(template: TemplateSite): string {
  const links = TEMPLATE_PAGES.map(
    ({ file, label }) =>
      `<li><a href="${escapeHtml(template.siteUrl + file)}">${label}</a></li>`,
  ).join("");
  return `
    <section class="template" aria-labelledby="template-heading">
      <h2 id="template-heading">Course template</h2>
      <p>The starting point every course is made from, with its example lesson and the pages for testing every exercise type.</p>
      <ul class="template-links">${links}</ul>
      <p class="card-meta">Updated ${formatDate(template.updated)} · <a href="${escapeHtml(template.repoUrl)}">Source on GitHub</a></p>
    </section>`;
}

export interface PageInput {
  courses: readonly Course[];
  template: TemplateSite | null;
  refreshed: Date;
}

/** The whole landing page. Every value from a course is escaped. */
export function renderPage({
  courses,
  template,
  refreshed,
}: PageInput): string {
  const cards = sortCourses(courses).map(courseCard).join("");
  const list =
    courses.length > 0
      ? `<ul class="cards">${cards}\n    </ul>`
      : "<p>No courses are published yet.</p>";
  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>LC eLearning course previews</title>
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <main>
      <header class="intro">
        <h1>Course previews</h1>
        <p>The Language Centre's courses as they stand on <code>main</code>, for the team and colleagues to try. These are previews, not the live courses.</p>
      </header>
    ${list}
    ${template ? templateCard(template) : ""}
    </main>
    <footer>Refreshed ${formatDateTime(refreshed)}</footer>
  </body>
</html>
`;
}
