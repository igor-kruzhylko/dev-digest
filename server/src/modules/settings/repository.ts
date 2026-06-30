import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

/**
 * F1 — settings data-access. The ONLY layer that touches the `settings` table
 * (non-secret per-workspace prefs as key/value rows). Shared by the settings
 * service and the feature-model resolver via `container`.
 */
export type SettingsRow = typeof t.settings.$inferSelect;

export class SettingsRepository {
  constructor(private db: Db) {}

  /** All setting rows for a workspace. */
  listByWorkspace(workspaceId: string): Promise<SettingsRow[]> {
    return this.db.select().from(t.settings).where(eq(t.settings.workspaceId, workspaceId));
  }

  /** Upsert one key/value pref for a (workspace, user). */
  async upsert(workspaceId: string, userId: string, key: string, value: unknown): Promise<void> {
    await this.db
      .insert(t.settings)
      .values({ workspaceId, userId, key, value })
      .onConflictDoUpdate({
        target: [t.settings.workspaceId, t.settings.userId, t.settings.key],
        set: { value },
      });
  }
}
