/** F1 — workspace pure transforms. */

/** The repo fields the workspace overview renders (structural — no cross-module type import). */
export interface RepoSummaryInput {
  id: string;
  fullName: string;
  clonePath: string | null;
  lastPolledAt: Date | null;
}

export interface RepoSummary {
  id: string;
  full_name: string;
  clone_path: string | null;
  last_polled_at: string | null;
  cloned: boolean;
}

/** Map a repo row to the workspace-overview summary DTO. */
export function toRepoSummary(r: RepoSummaryInput): RepoSummary {
  return {
    id: r.id,
    full_name: r.fullName,
    clone_path: r.clonePath,
    last_polled_at: r.lastPolledAt?.toISOString() ?? null,
    cloned: Boolean(r.clonePath),
  };
}
