import { db } from '@/lib/db'
import type { Setting } from '@/lib/types'

/** Returns the raw setting row, or `undefined` when the key was never set. */
export function getSetting(key: string): Promise<Setting | undefined> {
  return db.settings.get(key)
}

/** Upserts a setting; values are schemaless so new keys never need a migration. */
export async function setSetting(key: string, value: unknown): Promise<Setting> {
  const setting: Setting = { key, value }
  await db.settings.put(setting)
  return setting
}

/** Lists every setting row. */
export function listSettings(): Promise<Setting[]> {
  return db.settings.toArray()
}
