/** Slugify a skill name for the filename chip (`${slug}.md`). Lowercase,
    non-alphanumerics -> dash, collapse/trim dashes. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Rough token estimate — ~4 chars/token, matches the spec's `ceil(chars/4)`. */
export function estimateTokens(body: string): number {
  return Math.ceil(body.length / 4);
}
