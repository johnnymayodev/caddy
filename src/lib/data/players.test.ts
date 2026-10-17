import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { ValidationError } from '@/lib/data/errors'
import { createPlayer, listPlayers, renamePlayer, validatePlayerName } from '@/lib/data/players'

beforeEach(async () => {
  await Promise.all([
    db.courses.clear(),
    db.players.clear(),
    db.rounds.clear(),
    db.scores.clear(),
    db.settings.clear(),
  ])
})

/** Runs `run` and returns the ValidationError it throws (fails the test otherwise). */
async function captureValidationError(run: () => unknown): Promise<ValidationError> {
  try {
    await run()
  } catch (error) {
    if (error instanceof ValidationError) return error
    throw error
  }
  throw new Error('expected a ValidationError to be thrown')
}

describe('validatePlayerName', () => {
  it('trims and accepts names between 1 and 40 characters', () => {
    expect(validatePlayerName('  Alice  ')).toBe('Alice')
    expect(validatePlayerName('a')).toBe('a')
    expect(validatePlayerName('x'.repeat(40))).toBe('x'.repeat(40))
  })

  it('rejects blank and overlong names with field info', async () => {
    const empty = await captureValidationError(() => validatePlayerName('   '))
    expect(empty.field).toBe('name')

    const long = await captureValidationError(() => validatePlayerName('x'.repeat(41)))
    expect(long.field).toBe('name')
    expect(long.message).toContain('40')
  })
})

describe('createPlayer', () => {
  it('creates a trimmed player with a normalized name', async () => {
    const player = await createPlayer('  Alice ')

    expect(player.name).toBe('Alice')
    expect(player.nameNormalized).toBe('alice')
    expect(typeof player.id).toBe('string')
    expect(await db.players.get(player.id)).toEqual(player)
  })

  it('dedupes on case and whitespace, returning the existing player', async () => {
    const first = await createPlayer('Alice')
    const second = await createPlayer('  ALICE  ')
    const third = await createPlayer('alice')

    expect(second).toEqual(first)
    expect(third).toEqual(first)
    expect(await db.players.count()).toBe(1)
  })

  it('rejects invalid names', async () => {
    const error = await captureValidationError(() => createPlayer(''))
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.field).toBe('name')
  })
})

describe('renamePlayer', () => {
  it('updates the name and normalized name', async () => {
    const player = await createPlayer('Alice')

    const renamed = await renamePlayer(player.id, '  Alicia ')

    expect(renamed.id).toBe(player.id)
    expect(renamed.name).toBe('Alicia')
    expect(renamed.nameNormalized).toBe('alicia')
    expect(await db.players.get(player.id)).toEqual(renamed)
  })

  it('allows renaming a player to the same name with different casing', async () => {
    const player = await createPlayer('Alice')

    const renamed = await renamePlayer(player.id, 'ALICE')

    expect(renamed.name).toBe('ALICE')
    expect(renamed.nameNormalized).toBe('alice')
  })

  it('throws a ValidationError when another player uses that normalized name', async () => {
    const alice = await createPlayer('Alice')
    await createPlayer('Bob')

    const error = await captureValidationError(() => renamePlayer(alice.id, '  BOB '))

    expect(error.field).toBe('name')
    expect(await db.players.get(alice.id)).toEqual(alice)
  })
})

describe('listPlayers', () => {
  it('lists players alphabetically by normalized name', async () => {
    await createPlayer('Zoe')
    await createPlayer('alice')
    await createPlayer('Bob')

    const players = await listPlayers()

    expect(players.map((player) => player.name)).toEqual(['alice', 'Bob', 'Zoe'])
  })
})
