import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { getSetting, listSettings, setSetting } from '@/lib/data/settings'

beforeEach(async () => {
  await Promise.all([
    db.courses.clear(),
    db.players.clear(),
    db.rounds.clear(),
    db.scores.clear(),
    db.settings.clear(),
  ])
})

describe('settings round-trip', () => {
  it('stores, reads and overwrites a value of any shape', async () => {
    expect(await getSetting('theme')).toBeUndefined()

    const stored = await setSetting('theme', 'dark')
    expect(stored).toEqual({ key: 'theme', value: 'dark' })
    expect(await getSetting('theme')).toEqual({ key: 'theme', value: 'dark' })

    await setSetting('theme', { mode: 'light', contrast: 2 })
    expect(await getSetting('theme')).toEqual({
      key: 'theme',
      value: { mode: 'light', contrast: 2 },
    })

    await setSetting('theme', 42)
    expect((await getSetting('theme'))?.value).toBe(42)
  })

  it('lists every setting row', async () => {
    await setSetting('units', 'metres')
    await setSetting('defaultCourse', 'windmill')

    const settings = await listSettings()

    expect(settings.map((setting) => setting.key).sort()).toEqual(['defaultCourse', 'units'])
    expect(settings).toHaveLength(2)
  })
})
