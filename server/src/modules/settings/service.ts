import type { Container } from '../../platform/container.js';
import type {
  ConnTestRequest,
  ConnTestResult,
  SecretsStatus,
  Settings,
  SettingsUpdate,
} from '@devdigest/shared';
import { SettingsRepository } from './repository.js';
import { rowsToSettings } from './helpers.js';
import { GITHUB_PROVIDER, SECRET_KEY_BY_PROVIDER } from './constants.js';

/**
 * F1 — settings service. Non-secret prefs (get/update) + provider connection
 * test. Persistence goes through SettingsRepository; secrets and provider
 * clients are reached only through `container` (SecretsProvider / ports).
 */
export class SettingsService {
  private repo: SettingsRepository;

  constructor(private container: Container) {
    this.repo = new SettingsRepository(container.db);
  }

  async get(workspaceId: string): Promise<Settings> {
    return rowsToSettings(await this.repo.listByWorkspace(workspaceId));
  }

  async update(workspaceId: string, userId: string, body: SettingsUpdate): Promise<Settings> {
    for (const [key, value] of Object.entries(body)) {
      await this.repo.upsert(workspaceId, userId, key, value);
    }
    return this.get(workspaceId);
  }

  /** Which provider keys are configured (booleans only — values never exposed). */
  async secretsStatus(): Promise<SecretsStatus> {
    const entries = await Promise.all(
      (Object.entries(SECRET_KEY_BY_PROVIDER) as [keyof SecretsStatus, string][]).map(
        async ([provider, key]) =>
          [provider, Boolean(await this.container.secrets.get(key))] as const,
      ),
    );
    return Object.fromEntries(entries) as SecretsStatus;
  }

  /**
   * Test a provider key. If a key is supplied (BYO from the UI), persist it
   * first so the test reflects — and the rest of the app can use — the new value.
   */
  async testConnection(req: ConnTestRequest): Promise<ConnTestResult> {
    const { provider, key } = req;
    try {
      if (key) {
        if (!this.container.secrets.set) {
          return { provider, ok: false, message: 'Secrets backend is read-only' };
        }
        await this.container.secrets.set(SECRET_KEY_BY_PROVIDER[provider], key);
        this.container.invalidateSecretCaches();
      }
      if (provider === GITHUB_PROVIDER) {
        const gh = await this.container.github();
        const login = await gh.currentLogin();
        return { provider, ok: true, message: `Connected as @${login}` };
      }
      const llm = await this.container.llm(provider);
      const models = await llm.listModels();
      return { provider, ok: true, message: `OK — ${models.length} models available` };
    } catch (err) {
      return { provider, ok: false, message: (err as Error).message };
    }
  }
}
