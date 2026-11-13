# lc-elearn.github.io

The landing page for the Language Centre's course previews:
**https://lc-elearn.github.io/**. It lists every `lc-elearn` repo that publishes to
GitHub Pages, from that repo's own `course.json`, and is rebuilt every hour by
`.github/workflows/publish.yml`. Nothing here is edited by hand per course: a course
appears once it switches Pages on.

- `bun install`, then `bun run test`, then `GITHUB_TOKEN=$(gh auth token) bun run build`
  to write `site/index.html` locally.
- Design: `lc-base-template`, `docs/specs/2026-11-13-github-pages-previews-design.md`.

## Scheduled runs pause when the repo is quiet

GitHub pauses scheduled workflows in a repo with no commits for 60 days (it emails a
warning first). The page stays up, just stale. To resume, push any commit or press
"Run workflow" on the Publish workflow.
