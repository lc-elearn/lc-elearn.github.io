/** What a course's course.json gives the landing page (spec §4.2). */
export interface CourseInfo {
  courseTitle: string;
  languageCode: string;
  blurb: string;
}

/** One course card. */
export interface Course extends CourseInfo {
  repo: string;
  siteUrl: string;
  repoUrl: string;
  lessons: number;
  updated: Date;
}

/** The template's card: its course.json is example text, so it is not read (§4.3). */
export interface TemplateSite {
  repo: string;
  siteUrl: string;
  repoUrl: string;
  updated: Date;
}

/** A published repo left off the page, and why. */
export interface Skipped {
  repo: string;
  reason: string;
}

export interface Collected {
  courses: Course[];
  template: TemplateSite | null;
  skipped: Skipped[];
}
