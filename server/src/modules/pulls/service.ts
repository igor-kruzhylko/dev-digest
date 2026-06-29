import type {
  PrMeta,
  PrDetail,
  PrReviewComment,
  PrCommentInput,
  GitHubClient,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import { deriveReviewStatus } from './status.js';

/** Minimal logger surface (structural — satisfied by Fastify's `app.log`). */
export interface Logger {
  warn(obj: unknown, msg?: string): void;
}

/** Per-request cap on PR-detail backfills (each is a GitHub detail fetch). */
const BACKFILL_LIMIT = 10;

/**
 * F1 — pulls service. PR import + read (list / detail) and the inline-comment
 * proxy. Persistence goes through `container.pullsRepo`; repos via
 * `container.repoRepo`; list aggregates via `container.reviewRepo`; GitHub via
 * the `GitHubClient` port. No HTTP and no SQL here.
 *
 * Local-first: GitHub sync is best-effort — reads NEVER fail when a token is
 * missing/offline; persisted (seeded or previously imported) data is served.
 */
export class PullsService {
  constructor(private container: Container, private log: Logger) {}

  /** List PRs for a repo: sync from GitHub when possible, then serve persisted. */
  async listForRepo(workspaceId: string, repoId: string): Promise<PrMeta[]> {
    const repo = await this.container.repoRepo.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    let gh: GitHubClient | null = null;
    try {
      gh = await this.container.github();
    } catch (err) {
      this.log.warn({ err }, 'GitHub client unavailable (no token / offline); serving persisted PRs');
    }

    if (gh) {
      try {
        const pulls = await gh.listPullRequests({ owner: repo.owner, name: repo.name });
        for (const pr of pulls) {
          await this.container.pullsRepo.upsert({
            workspaceId,
            repoId: repo.id,
            number: pr.number,
            title: pr.title,
            author: pr.author,
            branch: pr.branch,
            base: pr.base,
            headSha: pr.head_sha,
            additions: pr.additions,
            deletions: pr.deletions,
            filesCount: pr.files_count,
            status: pr.status,
            openedAt: pr.opened_at ? new Date(pr.opened_at) : null,
            updatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
          });
        }
      } catch (err) {
        this.log.warn({ err }, 'GitHub PR sync skipped (no token / offline); serving persisted PRs');
      }
    }

    const rows = await this.container.pullsRepo.listByRepo(repo.id);

    // Diff stats aren't on GitHub's PR-list payload, so freshly-imported PRs land
    // with zeroed size/diff. Backfill them once from the detail endpoint (capped
    // per request); the periodic refetch chips away at any remainder.
    if (gh) {
      const needStats = rows
        .filter((r) => r.additions === 0 && r.deletions === 0 && r.filesCount === 0)
        .slice(0, BACKFILL_LIMIT);
      for (const r of needStats) {
        try {
          const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, r.number);
          await this.container.pullsRepo.updateStats(r.id, {
            additions: detail.additions,
            deletions: detail.deletions,
            filesCount: detail.files_count,
          });
          r.additions = detail.additions;
          r.deletions = detail.deletions;
          r.filesCount = detail.files_count;
        } catch (err) {
          this.log.warn({ err, number: r.number }, 'PR diff-stat backfill skipped');
        }
      }
    }

    // Latest-review score + total cost per PR (read-time aggregates).
    const prIds = rows.map((r) => r.id);
    const scoreByPr = await this.container.reviewRepo.latestReviewScoreByPrIds(prIds);
    const costByPr = await this.container.reviewRepo.totalRunCostByPrIds(prIds);

    const now = Date.now();
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      author: r.author,
      branch: r.branch,
      base: r.base,
      head_sha: r.headSha,
      additions: r.additions,
      deletions: r.deletions,
      files_count: r.filesCount,
      status: deriveReviewStatus({
        ghStatus: r.status,
        lastReviewedSha: r.lastReviewedSha,
        headSha: r.headSha,
        updatedAt: r.updatedAt,
        now,
      }),
      opened_at: r.openedAt?.toISOString() ?? null,
      updated_at: r.updatedAt?.toISOString() ?? null,
      score: scoreByPr.get(r.id) ?? null,
      cost_usd: costByPr.get(r.id) ?? null,
    }));
  }

  /** Full PR detail: refresh from GitHub when possible, else serve persisted. */
  async detail(workspaceId: string, id: string): Promise<PrDetail> {
    const pr = await this.container.pullsRepo.getByWorkspaceAndId(workspaceId, id);
    if (!pr) throw new NotFoundError('Pull request not found');
    const repo = await this.container.repoRepo.getById(workspaceId, pr.repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    try {
      const gh = await this.container.github();
      const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, pr.number);

      await this.container.pullsRepo.replaceFiles(
        pr.id,
        detail.files.map((f) => ({
          path: f.path,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch ?? null,
        })),
      );
      await this.container.pullsRepo.replaceCommits(
        pr.id,
        detail.commits.map((c) => ({
          sha: c.sha,
          message: c.message,
          author: c.author,
          committedAt: c.committed_at ? new Date(c.committed_at) : null,
        })),
      );
      await this.container.pullsRepo.updateDetail(pr.id, {
        body: detail.body ?? null,
        additions: detail.additions,
        deletions: detail.deletions,
        filesCount: detail.files_count,
      });

      return { ...detail, id: pr.id };
    } catch (err) {
      this.log.warn({ err }, 'GitHub PR detail refresh skipped (no token / offline); serving persisted detail');
      const files = await this.container.pullsRepo.listFiles(pr.id);
      const commits = await this.container.pullsRepo.listCommits(pr.id);
      return {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        author: pr.author,
        branch: pr.branch,
        base: pr.base,
        head_sha: pr.headSha,
        additions: pr.additions,
        deletions: pr.deletions,
        files_count: pr.filesCount,
        status: pr.status as PrDetail['status'],
        opened_at: pr.openedAt?.toISOString() ?? null,
        updated_at: pr.updatedAt?.toISOString() ?? null,
        body: pr.body ?? null,
        files: files.map((f) => ({
          path: f.path,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch ?? null,
        })),
        commits: commits.map((c) => ({
          sha: c.sha,
          message: c.message,
          author: c.author,
          committed_at: c.committedAt?.toISOString() ?? null,
        })),
      };
    }
  }

  // ---- Inline review comments (proxied live to GitHub, no local persistence) ----

  private async resolvePrAndRepo(workspaceId: string, id: string) {
    const pr = await this.container.pullsRepo.getByWorkspaceAndId(workspaceId, id);
    if (!pr) throw new NotFoundError('Pull request not found');
    const repo = await this.container.repoRepo.getById(workspaceId, pr.repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    return { pr, repo };
  }

  async listComments(workspaceId: string, id: string): Promise<PrReviewComment[]> {
    const { pr, repo } = await this.resolvePrAndRepo(workspaceId, id);
    let gh: GitHubClient;
    try {
      gh = await this.container.github();
    } catch (err) {
      this.log.warn({ err }, 'GitHub client unavailable; serving no PR comments');
      return [];
    }
    try {
      return await gh.listReviewComments({ owner: repo.owner, name: repo.name }, pr.number);
    } catch (err) {
      this.log.warn({ err }, 'GitHub review-comments fetch skipped (offline / error)');
      return [];
    }
  }

  async addComment(
    workspaceId: string,
    id: string,
    input: PrCommentInput,
  ): Promise<PrReviewComment> {
    const { pr, repo } = await this.resolvePrAndRepo(workspaceId, id);
    let gh: GitHubClient;
    try {
      gh = await this.container.github();
    } catch {
      throw new AppError('github_unavailable', 'Connect a GitHub token to post comments.', 400);
    }
    try {
      return await gh.createReviewComment({ owner: repo.owner, name: repo.name }, pr.number, {
        commitId: pr.headSha,
        path: input.path,
        line: input.line,
        ...(input.side ? { side: input.side } : {}),
        body: input.body,
        ...(input.in_reply_to != null ? { inReplyTo: input.in_reply_to } : {}),
      });
    } catch (err) {
      // GitHub rejects comments on lines outside the diff / on closed PRs (422).
      const msg = err instanceof Error ? err.message : 'Failed to post the comment to GitHub.';
      throw new AppError('github_comment_failed', msg, 400, { cause: String(err) });
    }
  }
}
