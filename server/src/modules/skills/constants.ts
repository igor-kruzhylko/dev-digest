/** Constants for the skills module. */

/** Initial version recorded for a newly-created skill. */
export const INITIAL_SKILL_VERSION = 1;

// ---- Import limits (modules/skills/import.ts) ------------------------------
// Conservative defaults (spec §4 / §15.4) — tune only if real skill packages
// exceed them.

/** Max size of a skill's Markdown body once decoded (1 MiB). */
export const MAX_MARKDOWN_BODY_BYTES = 1_048_576;

/** Max size of the raw base64 payload on the import request (5 MiB), checked
 *  BEFORE decoding so an oversized request can't force a large allocation. */
export const MAX_IMPORT_REQUEST_BASE64_BYTES = 5 * 1024 * 1024;

/** Max total inflated byte size of a zip archive's entries (10 MiB). */
export const MAX_ZIP_INFLATED_BYTES = 10 * 1024 * 1024;

/** Max number of entries allowed in an imported zip archive. */
export const MAX_ZIP_ENTRIES = 100;
