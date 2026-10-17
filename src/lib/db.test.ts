import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CaddyDatabase } from '@/lib/db'
import type { Course, Player, Round, Score } from '@/lib/types'

let db: CaddyDatabase

beforeEach(() => {
  db = new CaddyDatabase(`caddy-test-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

describe('schema v1', () => {
  it('creates the expected tables and indexes on a fresh open', async () => {
    await db.open()

    expect(db.verno).toBe(1)
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      'courses',
      'players',
      'rounds',
      'scores',
      'settings',
    ])

    expect(db.courses.schema.primKey.name).toBe('id')
    expect(db.courses.schema.indexes.map((index) => index.name)).toEqual(['nameNormalized'])

    expect(db.players.schema.primKey.name).toBe('id')
    const playerNameIndex = db.players.schema.indexes.find((index) => index.name === 'nameNormalized')
    expect(playerNameIndex?.unique).toBe(true)

    expect(db.rounds.schema.primKey.name).toBe('id')
    expect(db.rounds.schema.indexes.map((index) => index.name)).toEqual([
      'courseId',
      'datePlayed',
      'status',
    ])

    expect(db.scores.schema.primKey.name).toBe('[roundId+playerId+holeNumber]')
    expect(db.scores.schema.primKey.keyPath).toEqual(['roundId', 'playerId', 'holeNumber'])
    expect(db.scores.schema.indexes.map((index) => index.name)).toEqual(['roundId'])

    expect(db.settings.schema.primKey.name).toBe('key')
  })
})

function byHoleThenPlayer(a: Score, b: Score): number {
  return a.holeNumber - b.holeNumber || a.playerId.localeCompare(b.playerId)
}

describe('write/read round-trip', () => {
  it('persists a round with its course, players and scores', async () => {
    await db.open()

    const now = 1_760_000_000_000
    const course: Course = {
      id: crypto.randomUUID(),
      name: 'Windmill Gardens',
      nameNormalized: 'windmill gardens',
      holeCount: 3,
      pars: [2, 3, 2],
      maxStrokes: 5,
      createdAt: now,
      updatedAt: now,
    }
    const alice: Player = {
      id: crypto.randomUUID(),
      name: 'Alice',
      nameNormalized: 'alice',
      createdAt: now,
    }
    const bob: Player = {
      id: crypto.randomUUID(),
      name: 'Bob',
      nameNormalized: 'bob',
      createdAt: now,
    }
    const round: Round = {
      id: crypto.randomUUID(),
      courseId: course.id,
      courseSnapshot: {
        name: course.name,
        holeCount: course.holeCount,
        pars: course.pars,
        maxStrokes: course.maxStrokes,
      },
      playerIds: [alice.id, bob.id],
      datePlayed: '2026-10-17',
      status: 'completed',
      source: 'local',
      createdAt: now,
      updatedAt: now,
      completedAt: now + 60_000,
    }
    const scores: Score[] = [
      { roundId: round.id, playerId: alice.id, holeNumber: 1, strokes: 2, updatedAt: now },
      { roundId: round.id, playerId: alice.id, holeNumber: 2, strokes: 5, pickedUp: true, updatedAt: now },
      { roundId: round.id, playerId: alice.id, holeNumber: 3, strokes: 2, updatedAt: now },
      { roundId: round.id, playerId: bob.id, holeNumber: 1, strokes: 3, updatedAt: now },
      { roundId: round.id, playerId: bob.id, holeNumber: 2, strokes: 4, updatedAt: now },
      { roundId: round.id, playerId: bob.id, holeNumber: 3, strokes: 2, updatedAt: now },
    ]

    await db.transaction('rw', db.courses, db.players, db.rounds, db.scores, async () => {
      await db.courses.add(course)
      await db.players.bulkAdd([alice, bob])
      await db.rounds.add(round)
      await db.scores.bulkAdd(scores)
    })

    // Reopen the connection so reads come back from (fake) IndexedDB storage.
    db.close()
    await db.open()

    expect(await db.courses.get(course.id)).toEqual(course)
    expect(await db.players.where('nameNormalized').equals('alice').first()).toEqual(alice)
    expect(await db.rounds.get(round.id)).toEqual(round)
    expect(await db.scores.get([round.id, alice.id, 2])).toEqual(scores[1])

    const scoresByRound = await db.scores.where('roundId').equals(round.id).toArray()
    expect(scoresByRound).toHaveLength(scores.length)
    expect(scoresByRound.sort(byHoleThenPlayer)).toEqual([...scores].sort(byHoleThenPlayer))
  })
})
