/** Minimal client-side line diff (no new dependency). Splits both bodies on
    "\n" and computes a longest-common-subsequence table to mark lines as
    added/removed/unchanged. O(n*m) — fine for typical skill-body line counts. */

export type DiffLineKind = "added" | "removed" | "unchanged";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export function diffLines(oldBody: string, newBody: string): DiffLine[] {
  const a = oldBody.split("\n");
  const b = newBody.split("\n");
  const n = a.length;
  const m = b.length;

  // LCS length table (n+1 x m+1, padded with a trailing zero row/col).
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    const lcsRowBelow = lcs[i + 1]!;
    const lcsRow = lcs[i]!;
    for (let j = m - 1; j >= 0; j--) {
      lcsRow[j] = a[i] === b[j] ? lcsRowBelow[j + 1]! + 1 : Math.max(lcsRowBelow[j]!, lcsRow[j + 1]!);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const lineA = a[i]!;
    const lineB = b[j]!;
    if (lineA === lineB) {
      result.push({ kind: "unchanged", text: lineA });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      result.push({ kind: "removed", text: lineA });
      i++;
    } else {
      result.push({ kind: "added", text: lineB });
      j++;
    }
  }
  while (i < n) {
    result.push({ kind: "removed", text: a[i]! });
    i++;
  }
  while (j < m) {
    result.push({ kind: "added", text: b[j]! });
    j++;
  }
  return result;
}
