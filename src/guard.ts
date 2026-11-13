import type { Collected } from "./types";

export type PublishDecision = { ok: true } | { ok: false; reason: string };

/** Never replace a good page with an empty one because every repo was skipped (spec §6). */
export function shouldPublish({
  courses,
  skipped,
}: Collected): PublishDecision {
  if (courses.length > 0 || skipped.length === 0) return { ok: true };
  const list = skipped.map((s) => `  ${s.repo}: ${s.reason}`).join("\n");
  return {
    ok: false,
    reason: `No courses could be read; every repo was skipped:\n${list}`,
  };
}
