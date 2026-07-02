// gates.mjs — runs the deterministic per-package gates for the packages a change
// set touches, sequentially. A failing gate becomes a CRITICAL finding. Mirrors
// the cross-platform spawn style of server/scripts/arch.mjs (shell: true, cwd per
// package). READ-ONLY toward the repo (never runs db:generate / db:migrate).
//
//   node gates.mjs           # detect touched packages, run their gates
//   node gates.mjs --list    # print what would run, don't run
//   node gates.mjs --only server,reviewer-core
import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeChangeSet } from './diff.mjs';

const norm = (p) => String(p).replace(/\\/g, '/');

// Package → ordered [gateId, command] list. cwd is the package dir.
const PKG_GATES = {
  client: [
    ['typecheck', 'pnpm typecheck'],
    ['test', 'pnpm test'],
  ],
  server: [
    ['typecheck', 'pnpm typecheck'],
    ['arch', 'pnpm run arch'],
    ['unit', 'pnpm exec vitest run --exclude "**/*.it.test.ts"'],
  ],
  'reviewer-core': [
    ['typecheck', 'npm run typecheck'],
    ['test', 'npm test'],
    ['arch', 'npm run arch'],
  ],
};

export function detectPackages(changed) {
  const pkgs = new Set();
  for (const e of changed) {
    const p = norm(e.path);
    if (p.startsWith('client/')) pkgs.add('client');
    else if (p.startsWith('server/')) pkgs.add('server');
    else if (p.startsWith('reviewer-core/')) pkgs.add('reviewer-core');
  }
  return [...pkgs].filter((p) => PKG_GATES[p]);
}

function runOne(pkg, gate, cmd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd: pkg, shell: true });
    let buf = '';
    const cap = (chunk) => {
      buf += chunk;
      if (buf.length > 200_000) buf = buf.slice(-200_000); // bound memory
    };
    child.stdout?.on('data', cap);
    child.stderr?.on('data', cap);
    child.on('close', (code) => {
      const tail = buf.split('\n').filter(Boolean).slice(-30).join('\n');
      resolve({ package: pkg, gate, cmd, ok: code === 0, code: code ?? 1, outputTail: tail });
    });
    child.on('error', (err) => {
      resolve({ package: pkg, gate, cmd, ok: false, code: 1, outputTail: String(err) });
    });
  });
}

export async function runGates(pkgs) {
  const results = [];
  for (const pkg of pkgs) {
    if (!existsSync(`${pkg}/node_modules`)) {
      results.push({
        package: pkg,
        gate: 'install',
        cmd: '(dependency check)',
        ok: false,
        code: 1,
        outputTail: `node_modules missing in ${pkg}/ — run the package's install (pnpm install / npm install) before reviewing.`,
      });
      continue;
    }
    for (const [gate, cmd] of PKG_GATES[pkg]) {
      results.push(await runOne(pkg, gate, cmd));
    }
  }
  return results;
}

function toFindings(results) {
  return results
    .filter((r) => !r.ok)
    .map((r) => ({
      severity: 'CRITICAL',
      source: `gate:${r.package}:${r.gate}`,
      file: `${r.package}/`,
      start_line: 1,
      end_line: 1,
      title: `Gate failed — ${r.package} ${r.gate}`,
      rationale: `\`${r.cmd}\` (in \`${r.package}/\`) exited ${r.code}.\n\n\`\`\`\n${r.outputTail}\n\`\`\``,
      suggestion: `Fix the failure, then re-run the gate: \`cd ${r.package} && ${r.cmd}\`.`,
      confidence: 1,
    }));
}

function isMainModule() {
  try {
    return Boolean(
      process.argv[1] &&
        realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)),
    );
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const onlyArg = process.argv.find((a) => a.startsWith('--only'));
  const only = onlyArg
    ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : process.argv[process.argv.indexOf(onlyArg) + 1])
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
  const pkgs = only ?? detectPackages(computeChangeSet().changedFiles);

  if (process.argv.includes('--list')) {
    const plan = Object.fromEntries(
      pkgs.map((p) => [p, existsSync(`${p}/node_modules`) ? PKG_GATES[p].map(([g]) => g) : ['install (node_modules missing)']]),
    );
    process.stdout.write(`${JSON.stringify({ packages: pkgs, plan }, null, 2)}\n`);
  } else {
    const results = await runGates(pkgs);
    process.stdout.write(`${JSON.stringify({ packages: pkgs, results, findings: toFindings(results) }, null, 2)}\n`);
  }
}
