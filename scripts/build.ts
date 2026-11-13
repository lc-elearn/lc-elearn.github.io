/**
 * Collects the courses and writes site/index.html. Run by publish.yml every hour;
 * locally: GITHUB_TOKEN=$(gh auth token) bun run build. A skipped repo is reported
 * (and in the Actions job summary) but does not fail the build; a failed org listing
 * does, so the last good page stays up (spec §6).
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { collect } from "../src/collect";
import { shouldPublish } from "../src/guard";
import { renderPage } from "../src/render";

const result = await collect({
  org: "lc-elearn",
  selfRepo: "lc-elearn.github.io",
  token: process.env.GITHUB_TOKEN,
});
const decision = shouldPublish(result);
if (!decision.ok) {
  console.error(decision.reason);
  process.exit(1);
}
writeFileSync(
  "site/index.html",
  renderPage({ ...result, refreshed: new Date() }),
);

const lines = [
  `Courses: ${result.courses.map((c) => c.repo).join(", ") || "none"}`,
  `Template: ${result.template?.repo ?? "none"}`,
  ...result.skipped.map((s) => `Skipped: ${s.repo}: ${s.reason}`),
];
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Landing page\n\n${lines.map((l) => `- ${l}`).join("\n")}\n`,
  );
}
