import type { Pool } from 'pg';
import { createExecutor } from '.';
import type { PlatformProviderStateStore } from '../../platform-providers/types';

/**
 * Postgres-backed platform-provider state. The table is shared by every
 * feed-requests process, so a mapping created by one worker is visible to all
 * of them and survives restarts.
 */
export function createPlatformProviderStateStore(
  pool: Pool,
): PlatformProviderStateStore {
  const exec = createExecutor(pool);

  return {
    async get(key) {
      const rows = await exec(
        'SELECT value FROM platform_provider_state WHERE key = ?',
        [key],
      );

      return (rows[0]?.value as string | undefined) ?? null;
    },

    async set(key, value) {
      await exec(
        `INSERT INTO platform_provider_state (key, value)
         VALUES (?, ?)
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, value],
      );
    },

    async setIfAbsent(key, value) {
      const rows = await exec(
        `INSERT INTO platform_provider_state (key, value)
         VALUES (?, ?)
         ON CONFLICT (key) DO NOTHING
         RETURNING key`,
        [key, value],
      );

      return rows.length > 0;
    },

    async setIfValueIs(key, expectedValue, nextValue) {
      const rows = await exec(
        `UPDATE platform_provider_state
         SET value = ?, updated_at = now()
         WHERE key = ? AND value = ?
         RETURNING key`,
        [nextValue, key, expectedValue],
      );

      return rows.length > 0;
    },

    async delete(key) {
      await exec('DELETE FROM platform_provider_state WHERE key = ?', [key]);
    },

    async listKeys() {
      const rows = await exec('SELECT key FROM platform_provider_state', []);

      return rows.map((row) => row.key as string);
    },
  };
}
