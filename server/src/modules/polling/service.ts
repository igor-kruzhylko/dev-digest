import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';

/**
 * F1 — polling service. MANUAL refresh that ONLY syncs the PR list (new/updated
 * PRs appear, head_sha updates). It does NOT trigger any review — review is
 * manual (owned by A2). Repos via `container.repoRepo`, PR persistence via
 * `container.pullsRepo`, GitHub via the port. No HTTP, no SQL.
 */
export class PollingService {
  constructor(private container: Container) {}

  async poll(workspaceId: string, repoId: string): Promise<{ synced: number; reviewTriggered: boolean }> {
    const repo = await this.container.repoRepo.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    const gh = await this.container.github();
    const pulls = await gh.listPullRequests({ owner: repo.owner, name: repo.name });
    let synced = 0;
    for (const pr of pulls) {
      // List sync does NOT set openedAt (only the detail import does) — matches
      // the prior behaviour where a poll-first PR lands with opened_at = null.
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
        updatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
      });
      synced++;
    }
    await this.container.repoRepo.touchPolled(repo.id);

    // NOTE: no review is triggered here — manual trigger only.
    return { synced, reviewTriggered: false };
  }
}
