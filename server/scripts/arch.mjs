// Runs the dependency-cruiser architecture gate and strips ONE spurious line of
// noise: dependency-cruiser prints a yellow "you're running a globally installed
// dependency-cruiser" WARNING under pnpm's run-script environment, even though it
// is a proper local devDependency. The false positive comes from `is-installed-
// globally` mis-reading pnpm's symlinked store under the `pnpm run` env; the gate
// itself is unaffected. This wrapper passes stdout through untouched and removes
// only that warning block from stderr. Exit code mirrors dependency-cruiser, so a
// real violation still fails the build.
//
// Run via `pnpm run arch` (which puts node_modules/.bin on PATH).
import { spawn } from 'node:child_process';

// Single static command string (no args array) so Node doesn't raise DEP0190;
// `shell: true` resolves `depcruise` from node_modules/.bin on PATH, cross-platform.
const child = spawn('depcruise src --config .dependency-cruiser.cjs', {
  stdio: ['inherit', 'inherit', 'pipe'], // stdout (the report) passes straight through
  shell: true,
});

// Lines that make up dependency-cruiser's "globally installed" advisory.
const NOISE =
  /globally installed dependency-cruiser|We recommend to|install and run it as a local devDependency|your project instead|transpilers at its disposal|TypeScript, Vue or Svelte|^\s*WARNING:/;

let stderr = '';
child.stderr.on('data', (chunk) => {
  stderr += chunk;
});
child.on('close', (code) => {
  const cleaned = stderr
    .split('\n')
    .filter((line) => !NOISE.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n'); // collapse the blank gap the removed block leaves
  if (cleaned.trim()) process.stderr.write(cleaned.endsWith('\n') ? cleaned : `${cleaned}\n`);
  process.exit(code ?? 1);
});
child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
