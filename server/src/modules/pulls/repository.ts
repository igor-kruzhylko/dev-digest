import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { PullRow } from '../../db/rows.js';

/**
 * F1 — pull-request data-access. The ONLY layer that writes the PR import
 * tables: `pull_requests`, `pr_files`, `pr_commits`. Shared by the `pulls`
 * (read/detail) and `polling` (list sync) modules via `container.pullsRepo`,
 * so neither reaches into the other's folder.
 *
 * (Review-domain READS of `pull_requests` live in ReviewRepository's pull.repo;
 * this repo owns the IMPORT writes + the list/detail reads.)
 */

export type { PullRow };
export type PrFileRow = typeof t.prFiles.$inferSelect;
export type PrCommitRow = typeof t.prCommits.$inferSelect;

/** Values for the idempotent PR upsert (insert-or-update on repo_id+number). */
export interface UpsertPull {
  workspaceId: string;
  repoId: string;
  number: number;
  title: string;
  author: string;
  branch: string;
  base: string;
  headSha: string;
  additions: number;
  deletions: number;
  filesCount: number;
  status: string;
  openedAt?: Date | null;
  updatedAt?: Date | null;
}

export interface PrFileInsert {
  path: string;
  additions: number;
  deletions: number;
  patch: string | null;
}

export interface PrCommitInsert {
  sha: string;
  message: string;
  author: string;
  committedAt: Date | null;
}

export class PullsRepository {
  constructor(private db: Db) {}

  /** All PRs imported for a repo (list endpoint). */
  listByRepo(repoId: string): Promise<PullRow[]> {
    return this.db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repoId));
  }

  /** One PR by id, workspace-scoped (detail / comments). */
  async getByWorkspaceAndId(workspaceId: string, id: string): Promise<PullRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, id)));
    return row;
  }

  /**
   * Idempotent PR import. Insert, or on (repo_id, number) conflict update the
   * volatile fields. `openedAt` is set only on insert (omit to leave it as-is /
   * null), matching the original list-sync vs detail-import behaviour.
   */
  async upsert(v: UpsertPull): Promise<void> {
    await this.db
      .insert(t.pullRequests)
      .values({
        workspaceId: v.workspaceId,
        repoId: v.repoId,
        number: v.number,
        title: v.title,
        author: v.author,
        branch: v.branch,
        base: v.base,
        headSha: v.headSha,
        additions: v.additions,
        deletions: v.deletions,
        filesCount: v.filesCount,
        status: v.status,
        openedAt: v.openedAt ?? null,
        updatedAt: v.updatedAt ?? null,
      })
      .onConflictDoUpdate({
        target: [t.pullRequests.repoId, t.pullRequests.number],
        set: {
          title: v.title,
          headSha: v.headSha,
          status: v.status,
          updatedAt: v.updatedAt ?? null,
        },
      });
  }

  /** Backfill diff stats for a PR (list endpoint, from a detail fetch). */
  async updateStats(
    prId: string,
    stats: { additions: number; deletions: number; filesCount: number },
  ): Promise<void> {
    await this.db.update(t.pullRequests).set(stats).where(eq(t.pullRequests.id, prId));
  }

  /** Persist refreshed PR detail (body + diff stats) on the detail endpoint. */
  async updateDetail(
    prId: string,
    detail: { body: string | null; additions: number; deletions: number; filesCount: number },
  ): Promise<void> {
    await this.db.update(t.pullRequests).set(detail).where(eq(t.pullRequests.id, prId));
  }

  /** Replace the persisted files for a PR (delete-all then insert). */
  async replaceFiles(prId: string, files: PrFileInsert[]): Promise<void> {
    await this.db.delete(t.prFiles).where(eq(t.prFiles.prId, prId));
    if (files.length > 0) {
      await this.db.insert(t.prFiles).values(files.map((f) => ({ prId, ...f })));
    }
  }

  /** Replace the persisted commits for a PR (delete-all then insert). */
  async replaceCommits(prId: string, commits: PrCommitInsert[]): Promise<void> {
    await this.db.delete(t.prCommits).where(eq(t.prCommits.prId, prId));
    if (commits.length > 0) {
      await this.db.insert(t.prCommits).values(commits.map((c) => ({ prId, ...c })));
    }
  }

  listFiles(prId: string): Promise<PrFileRow[]> {
    return this.db.select().from(t.prFiles).where(eq(t.prFiles.prId, prId));
  }

  listCommits(prId: string): Promise<PrCommitRow[]> {
    return this.db.select().from(t.prCommits).where(eq(t.prCommits.prId, prId));
  }
}
