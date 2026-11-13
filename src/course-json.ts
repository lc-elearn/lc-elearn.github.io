import { z } from "zod";
import type { CourseInfo } from "./types";

/** Only the fields the landing page uses; a course.json may hold more. */
const COURSE_JSON = z.object({
  courseTitle: z.string().min(1),
  languageCode: z.string().min(2),
  landingCopy: z.object({ subheading: z.string().min(1) }),
});

export type CourseJsonResult =
  { ok: true; info: CourseInfo } | { ok: false; reason: string };

/** A course.json's text → the card's info, or why it cannot be used. */
export function parseCourseJson(text: string): CourseJsonResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: "course.json is not valid JSON" };
  }
  const parsed = COURSE_JSON.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    return { ok: false, reason: `course.json: ${issues.join("; ")}` };
  }
  const { courseTitle, languageCode, landingCopy } = parsed.data;
  return {
    ok: true,
    info: { courseTitle, languageCode, blurb: landingCopy.subheading },
  };
}
