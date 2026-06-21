import { pathToFileURL } from 'node:url';

/**
 * True when `moduleUrl`'s file is the process entrypoint (tsx/node script), not
 * an import. Pass `import.meta.url` from the CLI module — not from this helper.
 */
export function isDirectRun(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return moduleUrl === pathToFileURL(entry).href;
}
