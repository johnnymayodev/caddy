import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { createCourse, updateCourse } from '@/lib/data/courses'
import { ValidationError } from '@/lib/data/errors'
import { createPlayer } from '@/lib/data/players'
import {
  abandonRound,
  clampStrokes,
  clearScore,
  completeRound,
  createRound,
  deleteRound,
  getRound,
  listRounds,
  reopenRound,
  setScore,
  updateRound,
  validateDatePlayed,
  validatePlayerIds,
} from '@/lib/data/rounds'

beforeEach(async () => {
  await Promise.all([
    db.courses.clear(),
    db.players.clear(),
    db.rounds.clear(),
    db.scores.clear(),
    db.settings.clear(),
  ])
})

afterEach(() => {
  vi.useRealTimers()
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

/** Creates a course plus the two players used by most tests. */
async function setupCourseAndPlayers() {
  const course = await createCourse({
    name: 'Windmill Gardens',
    holeCount: 3,
    pars: [2, 3, 2],
    maxStrokes: 5,
  })
  const alice = await createPlayer('Alice')
  const bob = await createPlayer('Bob')
  return { course, alice, bob }
}

describe('pure round validators', () => {
  it('accepts YYYY-MM-DD dates and rejects malformed or impossible ones', async () => {
    expect(validateDatePlayed('2026-10-17')).toBe('2026-10-17')

    for (const invalid of ['17-10-2026', '2026/10/17', '2026-10', ' 2026-10-17']) {
      expect((await captureValidationError(() => validateDatePlayed(invalid))).field).toBe(
        'datePlayed',
      )
    }

    const impossible = await captureValidationError(() => validateDatePlayed('2026-02-30'))
    expect(impossible.field).toBe('datePlayed')
    expect(impossible.message).toContain('2026-02-30')
  })

  it('requires 1 to 8 unique player ids', async () => {
    expect(validatePlayerIds(['a'])).toEqual(['a'])
    expect(validatePlayerIds(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])).toHaveLength(8)

    expect((await captureValidationError(() => validatePlayerIds([]))).field).toBe('playerIds')
    expect(
      (
        await captureValidationError(() =>
          validatePlayerIds(Array.from({ length: 9 }, () => 'a')),
        )
      ).field,
    ).toBe('playerIds')
    expect((await captureValidationError(() => validatePlayerIds(['a', 'a']))).field).toBe(
      'playerIds',
    )
  })
})

describe('createRound', () => {
  it('creates an in-progress local round that freezes the course rules', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_000)
    const { course, alice, bob } = await setupCourseAndPlayers()

    vi.setSystemTime(2_000)
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id, bob.id],
      datePlayed: '2026-10-17',
      notes: 'sunny',
    })

    expect(round.courseSnapshot).toEqual({
      name: 'Windmill Gardens',
      holeCount: 3,
      pars: [2, 3, 2],
      maxStrokes: 5,
    })
    expect(round.playerIds).toEqual([alice.id, bob.id])
    expect(round.status).toBe('in-progress')
    expect(round.source).toBe('local')
    expect(round.datePlayed).toBe('2026-10-17')
    expect(round.notes).toBe('sunny')
    expect(round.createdAt).toBe(2_000)
    expect(round.updatedAt).toBe(2_000)
    expect(round.completedAt).toBeUndefined()
    expect(await db.rounds.get(round.id)).toEqual(round)
  })

  it('keeps the snapshot unchanged when the course is edited later', async () => {
    const { course, alice } = await setupCourseAndPlayers()
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
    })

    await updateCourse(course.id, {
      name: 'Renamed Course',
      holeCount: 5,
      pars: [3, 3, 3, 3, 3],
      maxStrokes: 9,
    })

    const loaded = await getRound(round.id)
    expect(loaded?.round.courseSnapshot).toEqual({
      name: 'Windmill Gardens',
      holeCount: 3,
      pars: [2, 3, 2],
      maxStrokes: 5,
    })

    // Score validation follows the frozen snapshot, not the edited course.
    const holeError = await captureValidationError(() =>
      setScore({ roundId: round.id, playerId: alice.id, holeNumber: 4, strokes: 2 }),
    )
    expect(holeError.field).toBe('holeNumber')
    expect(clampStrokes(loaded!.round, 8)).toBe(5)
  })

  it('omits maxStrokes from the snapshot when the course has none', async () => {
    const course = await createCourse({ name: 'Open Field', holeCount: 2 })
    const alice = await createPlayer('Alice')

    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
    })

    expect('maxStrokes' in round.courseSnapshot).toBe(false)
  })

  it('rejects unknown courses, players and invalid dates', async () => {
    const { course, alice, bob } = await setupCourseAndPlayers()

    const badCourse = await captureValidationError(() =>
      createRound({
        courseId: crypto.randomUUID(),
        playerIds: [alice.id],
        datePlayed: '2026-10-17',
      }),
    )
    expect(badCourse.field).toBe('courseId')

    const noPlayers = await captureValidationError(() =>
      createRound({ courseId: course.id, playerIds: [], datePlayed: '2026-10-17' }),
    )
    expect(noPlayers.field).toBe('playerIds')

    const tooMany = await captureValidationError(() =>
      createRound({
        courseId: course.id,
        playerIds: Array.from({ length: 9 }, () => crypto.randomUUID()),
        datePlayed: '2026-10-17',
      }),
    )
    expect(tooMany.field).toBe('playerIds')

    const duplicates = await captureValidationError(() =>
      createRound({
        courseId: course.id,
        playerIds: [alice.id, alice.id],
        datePlayed: '2026-10-17',
      }),
    )
    expect(duplicates.field).toBe('playerIds')

    const unknownPlayer = await captureValidationError(() =>
      createRound({
        courseId: course.id,
        playerIds: [alice.id, crypto.randomUUID()],
        datePlayed: '2026-10-17',
      }),
    )
    expect(unknownPlayer.field).toBe('playerIds')

    const badDate = await captureValidationError(() =>
      createRound({ courseId: course.id, playerIds: [bob.id], datePlayed: '2026-02-30' }),
    )
    expect(badDate.field).toBe('datePlayed')

    expect(await db.rounds.count()).toBe(0)
  })
})

describe('setScore', () => {
  it('inserts and then upserts one row per round/player/hole', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { course, alice } = await setupCourseAndPlayers()
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
    })

    vi.setSystemTime(2_000)
    const first = await setScore({
      roundId: round.id,
      playerId: alice.id,
      holeNumber: 2,
      strokes: 4,
    })
    expect(first).toEqual({
      roundId: round.id,
      playerId: alice.id,
      holeNumber: 2,
      strokes: 4,
      updatedAt: 2_000,
    })
    expect((await db.rounds.get(round.id))?.updatedAt).toBe(2_000)

    vi.setSystemTime(3_000)
    const updated = await setScore({
      roundId: round.id,
      playerId: alice.id,
      holeNumber: 2,
      strokes: 3,
      pickedUp: true,
    })

    expect(updated.strokes).toBe(3)
    expect(updated.pickedUp).toBe(true)
    expect(updated.updatedAt).toBe(3_000)
    expect(await db.scores.count()).toBe(1)
    expect(await db.scores.get([round.id, alice.id, 2])).toEqual(updated)
    expect((await db.rounds.get(round.id))?.updatedAt).toBe(3_000)
  })

  it('replaces the row when pickedUp is dropped on a later upsert', async () => {
    const { course, alice } = await setupCourseAndPlayers()
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
    })

    await setScore({ roundId: round.id, playerId: alice.id, holeNumber: 1, strokes: 5, pickedUp: true })
    const rewritten = await setScore({
      roundId: round.id,
      playerId: alice.id,
      holeNumber: 1,
      strokes: 2,
    })

    expect('pickedUp' in rewritten).toBe(false)
    expect(await db.scores.get([round.id, alice.id, 1])).toEqual(rewritten)
  })

  it('clamps strokes down to maxStrokes but keeps 1 intact', async () => {
    const { course, alice } = await setupCourseAndPlayers()
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
    })

    const clamped = await setScore({
      roundId: round.id,
      playerId: alice.id,
      holeNumber: 1,
      strokes: 9,
      pickedUp: true,
    })
    expect(clamped.strokes).toBe(5)
    expect(clamped.pickedUp).toBe(true)

    const minimum = await setScore({
      roundId: round.id,
      playerId: alice.id,
      holeNumber: 2,
      strokes: 1,
    })
    expect(minimum.strokes).toBe(1)
  })

  it('allows 99 strokes on a course without a cap', async () => {
    const course = await createCourse({ name: 'Open Field', holeCount: 2 })
    const alice = await createPlayer('Alice')
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
    })

    const score = await setScore({
      roundId: round.id,
      playerId: alice.id,
      holeNumber: 1,
      strokes: 99,
    })

    expect(score.strokes).toBe(99)
  })

  it('rejects out-of-range strokes and holes, and players outside the round', async () => {
    const { course, alice } = await setupCourseAndPlayers()
    const outsider = await createPlayer('Carol')
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
    })

    const zero = await captureValidationError(() =>
      setScore({ roundId: round.id, playerId: alice.id, holeNumber: 1, strokes: 0 }),
    )
    expect(zero.field).toBe('strokes')

    const tooHigh = await captureValidationError(() =>
      setScore({ roundId: round.id, playerId: alice.id, holeNumber: 1, strokes: 100 }),
    )
    expect(tooHigh.field).toBe('strokes')

    const fractional = await captureValidationError(() =>
      setScore({ roundId: round.id, playerId: alice.id, holeNumber: 1, strokes: 2.5 }),
    )
    expect(fractional.field).toBe('strokes')

    const holeZero = await captureValidationError(() =>
      setScore({ roundId: round.id, playerId: alice.id, holeNumber: 0, strokes: 2 }),
    )
    expect(holeZero.field).toBe('holeNumber')

    const holeTooHigh = await captureValidationError(() =>
      setScore({ roundId: round.id, playerId: alice.id, holeNumber: 4, strokes: 2 }),
    )
    expect(holeTooHigh.field).toBe('holeNumber')

    const notPlaying = await captureValidationError(() =>
      setScore({ roundId: round.id, playerId: outsider.id, holeNumber: 1, strokes: 2 }),
    )
    expect(notPlaying.field).toBe('playerId')

    expect(await db.scores.count()).toBe(0)
  })
})

describe('clearScore', () => {
  it('deletes the row and bumps the round updatedAt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { course, alice } = await setupCourseAndPlayers()
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
    })
    await setScore({ roundId: round.id, playerId: alice.id, holeNumber: 1, strokes: 2 })

    vi.setSystemTime(5_000)
    await clearScore(round.id, alice.id, 1)

    expect(await db.scores.get([round.id, alice.id, 1])).toBeUndefined()
    expect((await db.rounds.get(round.id))?.updatedAt).toBe(5_000)

    // Clearing an already-empty hole is forgiving.
    vi.setSystemTime(6_000)
    await clearScore(round.id, alice.id, 1)
    expect((await db.rounds.get(round.id))?.updatedAt).toBe(6_000)
  })
})

describe('getRound', () => {
  it('returns undefined for an unknown round', async () => {
    expect(await getRound(crypto.randomUUID())).toBeUndefined()
  })

  it('returns the round with scores sorted by hole then player', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_000)
    const { course, alice, bob } = await setupCourseAndPlayers()
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id, bob.id],
      datePlayed: '2026-10-17',
    })

    vi.setSystemTime(2_000)
    await setScore({ roundId: round.id, playerId: bob.id, holeNumber: 1, strokes: 3 })
    await setScore({ roundId: round.id, playerId: alice.id, holeNumber: 2, strokes: 4 })
    await setScore({ roundId: round.id, playerId: alice.id, holeNumber: 1, strokes: 2 })

    const loaded = await getRound(round.id)
    const [firstId, secondId] = [alice.id, bob.id].sort((a, b) => a.localeCompare(b))

    expect(loaded?.round).toEqual({ ...round, updatedAt: 2_000 })
    expect(loaded?.scores.map((score) => [score.holeNumber, score.playerId])).toEqual([
      [1, firstId],
      [1, secondId],
      [2, alice.id],
    ])
  })
})

describe('listRounds', () => {
  it('lists newest first and filters by course and status', async () => {
    const { course, alice } = await setupCourseAndPlayers()
    const other = await createCourse({ name: 'Other Course', holeCount: 2 })

    const early = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-09-30',
    })
    const middle = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-01',
    })
    const newest = await createRound({
      courseId: other.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
    })

    const all = await listRounds()
    expect(all.map((round) => round.id)).toEqual([newest.id, middle.id, early.id])

    const byCourse = await listRounds({ courseId: course.id })
    expect(byCourse.map((round) => round.id)).toEqual([middle.id, early.id])

    await completeRound(early.id, { force: true })
    const completed = await listRounds({ status: 'completed' })
    expect(completed.map((round) => round.id)).toEqual([early.id])

    const abandoned = await listRounds({ status: 'abandoned' })
    expect(abandoned).toEqual([])
  })
})

describe('completeRound / reopenRound / abandonRound', () => {
  it('refuses to complete while scores are missing unless forced', async () => {
    const { course, alice, bob } = await setupCourseAndPlayers()
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id, bob.id],
      datePlayed: '2026-10-17',
    })
    for (const holeNumber of [1, 2, 3]) {
      await setScore({ roundId: round.id, playerId: alice.id, holeNumber, strokes: 2 })
      await setScore({ roundId: round.id, playerId: bob.id, holeNumber, strokes: 2 })
    }
    await clearScore(round.id, bob.id, 3)

    await expect(completeRound(round.id)).rejects.toThrow(/missing 1 of 6/)
    expect((await db.rounds.get(round.id))?.status).toBe('in-progress')

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(9_000)
    const forced = await completeRound(round.id, { force: true })

    expect(forced.status).toBe('completed')
    expect(forced.completedAt).toBe(9_000)
    expect(forced.updatedAt).toBe(9_000)
  })

  it('completes without force once every score is in', async () => {
    const { course, alice } = await setupCourseAndPlayers()
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
    })
    for (const holeNumber of [1, 2, 3]) {
      await setScore({ roundId: round.id, playerId: alice.id, holeNumber, strokes: 2 })
    }

    const completed = await completeRound(round.id)

    expect(completed.status).toBe('completed')
    expect(completed.completedAt).toBeTypeOf('number')
  })

  it('reopens a completed round and clears completedAt', async () => {
    const { course, alice } = await setupCourseAndPlayers()
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
    })
    await completeRound(round.id, { force: true })

    const reopened = await reopenRound(round.id)

    expect(reopened.status).toBe('in-progress')
    expect('completedAt' in reopened).toBe(false)
    expect(await db.rounds.get(round.id)).toEqual(reopened)
  })

  it('abandons a round without deleting its scores', async () => {
    const { course, alice } = await setupCourseAndPlayers()
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
    })
    await setScore({ roundId: round.id, playerId: alice.id, holeNumber: 1, strokes: 4 })

    const abandoned = await abandonRound(round.id)

    expect(abandoned.status).toBe('abandoned')
    expect('completedAt' in abandoned).toBe(false)
    expect(await db.scores.count()).toBe(1)
  })
})

describe('updateRound', () => {
  it('updates notes and the play date with re-validation', async () => {
    const { course, alice } = await setupCourseAndPlayers()
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
      notes: 'first',
    })

    const updated = await updateRound(round.id, { datePlayed: '2026-10-18', notes: 'second' })
    expect(updated.datePlayed).toBe('2026-10-18')
    expect(updated.notes).toBe('second')

    const invalid = await captureValidationError(() =>
      updateRound(round.id, { datePlayed: '2026-13-01' }),
    )
    expect(invalid.field).toBe('datePlayed')
    expect((await db.rounds.get(round.id))?.datePlayed).toBe('2026-10-18')
  })

  it('clears notes when passed explicitly as undefined', async () => {
    const { course, alice } = await setupCourseAndPlayers()
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-17',
      notes: 'first',
    })

    const cleared = await updateRound(round.id, { notes: undefined })

    expect('notes' in cleared).toBe(false)
    expect(await db.rounds.get(round.id)).toEqual(cleared)
  })
})

describe('deleteRound', () => {
  it('deletes the round and cascades to all of its scores', async () => {
    const { course, alice, bob } = await setupCourseAndPlayers()
    const round = await createRound({
      courseId: course.id,
      playerIds: [alice.id, bob.id],
      datePlayed: '2026-10-17',
    })
    const other = await createRound({
      courseId: course.id,
      playerIds: [alice.id],
      datePlayed: '2026-10-16',
    })
    await setScore({ roundId: round.id, playerId: alice.id, holeNumber: 1, strokes: 2 })
    await setScore({ roundId: round.id, playerId: bob.id, holeNumber: 1, strokes: 3 })
    await setScore({ roundId: other.id, playerId: alice.id, holeNumber: 1, strokes: 4 })

    await deleteRound(round.id)

    expect(await db.rounds.get(round.id)).toBeUndefined()
    expect(await db.scores.where('roundId').equals(round.id).count()).toBe(0)
    expect(await db.scores.where('roundId').equals(other.id).count()).toBe(1)
    expect(await db.rounds.get(other.id)).toBeDefined()
  })
})
