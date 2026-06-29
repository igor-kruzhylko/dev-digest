import type { Container } from '../../platform/container.js';
import { toRepoSummary, type RepoSummary } from './helpers.js';

/**
 * F1 — workspace service. Read-only overview of where clones live + a summary
 * of the workspace's cloned repos. Reads repos through `container.repoRepo`
 * (no SQL here, no reaching into the repos module's folder).
 */
export interface WorkspaceOverview {
  workspaceId: string;
  cloneDir: string;
  repos: RepoSummary[];
}

export class WorkspaceService {
  constructor(private container: Container) {}

  async overview(workspaceId: string): Promise<WorkspaceOverview> {
    const repos = await this.container.repoRepo.list(workspaceId);
    return {
      workspaceId,
      cloneDir: this.container.config.cloneDir,
      repos: repos.map(toRepoSummary),
    };
  }
}
