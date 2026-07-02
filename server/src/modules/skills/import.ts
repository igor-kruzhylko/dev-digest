import { unzipSync } from 'fflate';
import type { ImportSkillInput, SkillImportPreview, SkillType } from '@devdigest/shared';
import { AppError } from '../../platform/errors.js';
import {
  MAX_IMPORT_REQUEST_BASE64_BYTES,
  MAX_MARKDOWN_BODY_BYTES,
  MAX_ZIP_ENTRIES,
  MAX_ZIP_INFLATED_BYTES,
} from './constants.js';

/**
 * Skill import — Markdown (`.md`/`.markdown`) and zip (`.zip`) previews. PURE:
 * no DB, no execution beyond in-memory unzip (`fflate`). `previewImport` is the
 * only entry point the service calls; everything else here is an
 * implementation detail exposed for unit testing (`parseSkillMarkdown`).
 */

const SKILL_TYPES: readonly SkillType[] = ['rubric', 'convention', 'security', 'custom'];

function isSkillType(value: string): value is SkillType {
  return (SKILL_TYPES as readonly string[]).includes(value);
}

interface ParsedSkillMarkdown {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

/**
 * Parse a single Markdown file's text into skill fields. Optional `---`-fenced
 * frontmatter (hand-rolled `key: value` reader — no YAML dep) supplies
 * name/description/type; anything missing falls back to heuristics over the
 * body. Exported standalone so it's independently unit-testable.
 */
export function parseSkillMarkdown(filename: string, text: string): ParsedSkillMarkdown {
  const { frontmatter, body: rawBody } = extractFrontmatter(text);

  const bodyAfterFence = rawBody.trim();

  const headingMatch = bodyAfterFence.match(/^#{1,6}[ \t]+(.+)$/m);
  const firstHeading = headingMatch?.[1]?.trim();

  const firstParagraph = findFirstParagraph(bodyAfterFence);

  const nameFallback = firstHeading ?? stripExtension(filename);
  const name = frontmatter.name?.trim() || nameFallback;
  const descriptionFallback = firstParagraph
    ? truncate(firstParagraph, 500)
    : truncate(name, 500);
  const description = frontmatter.description?.trim() || descriptionFallback;
  const type =
    frontmatter.type && isSkillType(frontmatter.type) ? (frontmatter.type as SkillType) : 'custom';

  return { name, description, type, body: bodyAfterFence };
}

function stripExtension(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  return base.replace(/\.(md|markdown)$/i, '');
}

/** First non-blank line in `body` that isn't a heading, truncated by the caller. */
function findFirstParagraph(body: string): string | undefined {
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,6}[ \t]/.test(trimmed)) continue;
    return trimmed;
  }
  return undefined;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

/**
 * Split optional `---`-fenced frontmatter from the body. Recognizes only a
 * frontmatter block that starts at the very first line. Malformed/missing
 * frontmatter (no closing fence) is treated as "no frontmatter" — the whole
 * text becomes the body.
 */
function extractFrontmatter(text: string): {
  frontmatter: Partial<Record<'name' | 'description' | 'type', string>>;
  body: string;
} {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { frontmatter: {}, body: text };
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      closingIndex = i;
      break;
    }
  }
  if (closingIndex === -1) {
    // No closing fence — not real frontmatter; treat as plain body.
    return { frontmatter: {}, body: text };
  }

  const frontmatter: Partial<Record<'name' | 'description' | 'type', string>> = {};
  for (const line of lines.slice(1, closingIndex)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (key === 'name' || key === 'description' || key === 'type') {
      frontmatter[key] = value;
    }
  }

  const body = lines.slice(closingIndex + 1).join('\n');
  return { frontmatter, body };
}

function parseMarkdownEntry(filename: string, buf: Buffer): SkillImportPreview {
  if (buf.byteLength > MAX_MARKDOWN_BODY_BYTES) {
    throw new AppError('import_too_large', 'Skill body is too large', 400);
  }
  const text = buf.toString('utf-8');
  const parsed = parseSkillMarkdown(filename, text);
  if (!parsed.body.trim()) {
    throw new AppError('import_invalid', 'No content found in file', 400);
  }
  return {
    name: parsed.name,
    description: parsed.description,
    type: parsed.type,
    body: parsed.body.trim(),
    source: 'extracted',
    warnings: [],
    ignored_files: [],
  };
}

function isMarkdownFilename(name: string): boolean {
  return /\.(md|markdown)$/i.test(name);
}

/** Depth of a zip entry path (number of `/` separators) — used to prefer the
 *  shallowest markdown entry when no root-level SKILL.md exists. */
function pathDepth(path: string): number {
  return path.split('/').filter(Boolean).length - 1;
}

function parseZipEntry(buf: Buffer): SkillImportPreview {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(buf));
  } catch {
    throw new AppError('import_invalid', 'Could not read archive', 400);
  }

  const paths = Object.keys(entries);
  if (paths.length > MAX_ZIP_ENTRIES) {
    throw new AppError('import_too_large', 'Too many files in archive', 400);
  }

  let totalBytes = 0;
  for (const path of paths) {
    totalBytes += entries[path]!.byteLength;
  }
  if (totalBytes > MAX_ZIP_INFLATED_BYTES) {
    throw new AppError('import_too_large', 'Archive contents too large', 400);
  }

  // Directory entries end with '/' and have no content; skip them entirely.
  const fileEntries = paths.filter((p) => !p.endsWith('/'));

  // Prefer a root-level SKILL.md; otherwise the shallowest *.md/*.markdown entry.
  const rootSkillMd = fileEntries.find(
    (p) => p.replace(/^\.?\//, '') === 'SKILL.md' && pathDepth(p) === 0,
  );
  const markdownCandidates = fileEntries
    .filter(isMarkdownFilename)
    .sort((a, b) => pathDepth(a) - pathDepth(b));
  const chosen = rootSkillMd ?? markdownCandidates[0];

  if (!chosen) {
    throw new AppError('import_invalid', 'No SKILL.md or markdown file found in archive', 400);
  }

  const buf2 = Buffer.from(entries[chosen]!);
  const preview = parseMarkdownEntry(chosen, buf2);

  const ignoredFiles = fileEntries.filter((p) => p !== chosen);
  return { ...preview, ignored_files: ignoredFiles };
}

/**
 * Preview an import — decode, detect type by filename extension, parse, and
 * return a `SkillImportPreview`. NO DB write, NO execution beyond fflate's
 * in-memory inflate; non-Markdown zip entries are listed in `ignored_files`
 * and their contents are never read/parsed.
 */
export function previewImport(input: ImportSkillInput): SkillImportPreview {
  if (input.content_base64.length > MAX_IMPORT_REQUEST_BASE64_BYTES) {
    throw new AppError('import_too_large', 'Import file is too large', 400);
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(input.content_base64, 'base64');
  } catch {
    throw new AppError('import_invalid', 'Could not decode import file', 400);
  }

  const lower = input.filename.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return parseMarkdownEntry(input.filename, buf);
  }
  if (lower.endsWith('.zip')) {
    return parseZipEntry(buf);
  }
  throw new AppError('import_invalid', 'Unsupported file type', 400);
}
