/* Run Cost Badge formatters (L01). Display-only; the server is the source of
   truth for cost. See client/specs/run-cost-badge.md. */

const EMPTY = "—";

/**
 * Billed USD for one run.
 *  - null / undefined / non-finite → "—" (NEVER "$0.00" — unknown is not free).
 *  - >= $1 → 2 decimals ($1.23).
 *  - sub-$1 → at least 3 significant figures, minimum 3 decimal places, with
 *    excess trailing zeros trimmed down to that 3-decimal floor.
 * Examples: 0.0134→$0.0134, 0.012→$0.012, 0.0013→$0.0013, 0.00012→$0.00012.
 */
export function formatUsd(cost: number | null | undefined): string {
  if (cost == null || !Number.isFinite(cost)) return EMPTY;
  const abs = Math.abs(cost);
  if (abs === 0) return "$0.000";
  if (abs >= 1) return `$${cost.toFixed(2)}`;

  // leading zeros after the decimal point before the first significant digit.
  const leadingZeros = Math.max(0, Math.floor(-Math.log10(abs)));
  const decimals = Math.max(3, leadingZeros + 3);
  let str = cost.toFixed(decimals);
  if (str.includes(".")) {
    const [intPart, frac] = str.split(".");
    let f = frac!;
    while (f.length > 3 && f.endsWith("0")) f = f.slice(0, -1);
    str = `${intPart}.${f}`;
  }
  return `$${str}`;
}

/** Compact token count, e.g. 8200 → "8.2K"; raw below 1000. */
function compactTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** Token in→out flow for the detailed badge, e.g. "8.2K→1.3K". */
export function formatTokenFlow(
  tokensIn: number | null | undefined,
  tokensOut: number | null | undefined,
): string {
  return `${compactTokens(tokensIn ?? 0)}→${compactTokens(tokensOut ?? 0)}`;
}
