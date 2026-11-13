const NAMES = new Intl.DisplayNames(["en"], {
  type: "language",
  fallback: "code",
});

/** `ru` → "Russian". An unknown or malformed code comes back unchanged. */
export function languageName(code: string): string {
  try {
    return NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}
