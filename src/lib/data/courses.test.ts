import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import {
  archiveCourse,
  createCourse,
  deleteCourse,
  listCourses,
  updateCourse,
  validateCourseName,
  validateHoleCount,
  validateMaxStrokes,
  validatePars,
} from '@/lib/data/courses'
import { ValidationError } from '@/lib/data/errors'
import { createPlayer } from '@/lib/data/players'
import { createRound } from '@/lib/data/rounds'

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

describe('pure validators', () => {
  it('trims course names and enforces 1 to 80 characters', async () => {
    expect(validateCourseName('  Windmill Gardens ')).toBe('Windmill Gardens')
    expect(validateCourseName('x'.repeat(80))).toBe('x'.repeat(80))

    expect((await captureValidationError(() => validateCourseName('   '))).field).toBe('name')
    expect((await captureValidationError(() => validateCourseName('x'.repeat(81)))).field).toBe(
      'name',
    )
  })

  it('enforces an integer hole count between 1 and 36', async () => {
    expect(validateHoleCount(1)).toBe(1)
    expect(validateHoleCount(36)).toBe(36)

    for (const invalid of [0, 37, 2.5, NaN]) {
      expect((await captureValidationError(() => validateHoleCount(invalid))).field).toBe(
        'holeCount',
      )
    }
  })

  it('defaults omitted pars to par 2 on every hole', () => {
    expect(validatePars(undefined, 1)).toEqual([2])
    expect(validatePars(undefined, 4)).toEqual([2, 2, 2, 2])
  })

  it('requires one integer par (1 to 6) per hole', async () => {
    expect(validatePars([1, 6, 3], 3)).toEqual([1, 6, 3])

    expect((await captureValidationError(() => validatePars([2, 2], 3))).field).toBe('pars')
    expect((await captureValidationError(() => validatePars([2, 2, 2, 2], 3))).field).toBe('pars')
    expect((await captureValidationError(() => validatePars([2, 0, 2], 3))).field).toBe('pars[1]')
    expect((await captureValidationError(() => validatePars([2, 7, 2], 3))).field).toBe('pars[1]')
    expect((await captureValidationError(() => validatePars([2, 2.5, 2], 3))).field).toBe('pars[1]')
  })

  it('keeps maxStrokes optional but integer 1 to 99 when given', async () => {
    expect(validateMaxStrokes(undefined)).toBeUndefined()
    expect(validateMaxStrokes(1)).toBe(1)
    expect(validateMaxStrokes(99)).toBe(99)

    for (const invalid of [0, 100, 1.5]) {
      expect((await captureValidationError(() => validateMaxStrokes(invalid))).field).toBe(
        'maxStrokes',
      )
    }
  })
})

describe('createCourse', () => {
  it('creates a course with par-2 defaults, a normalized name and timestamps', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_000)

    const course = await createCourse({ name: '  Windmill Gardens  ', holeCount: 3 })

    expect(course.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(course).toEqual({
      id: course.id,
      name: 'Windmill Gardens',
      nameNormalized: 'windmill gardens',
      holeCount: 3,
      pars: [2, 2, 2],
      createdAt: 1_000,
      updatedAt: 1_000,
    })
    expect(await db.courses.get(course.id)).toEqual(course)
  })

  it('stores given pars, maxStrokes and notes', async () => {
    const course = await createCourse({
      name: 'Links',
      holeCount: 5,
      pars: [3, 4, 5, 2, 6],
      maxStrokes: 6,
      notes: 'Bring a putter',
    })

    expect(course.pars).toEqual([3, 4, 5, 2, 6])
    expect(course.maxStrokes).toBe(6)
    expect(course.notes).toBe('Bring a putter')
  })

  it('rejects invalid input through ValidationError', async () => {
    const error = await captureValidationError(() => createCourse({ name: '', holeCount: 3 }))
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.field).toBe('name')
  })
})

describe('updateCourse', () => {
  it('re-validates the merged result and keeps updatedAt fresh', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_000)
    const course = await createCourse({ name: 'Old Name', holeCount: 3 })

    vi.setSystemTime(2_000)
    const updated = await updateCourse(course.id, { name: 'New Name', pars: [3, 3, 3] })

    expect(updated.name).toBe('New Name')
    expect(updated.nameNormalized).toBe('new name')
    expect(updated.pars).toEqual([3, 3, 3])
    expect(updated.createdAt).toBe(1_000)
    expect(updated.updatedAt).toBe(2_000)

    vi.setSystemTime(3_000)
    const holeCountChanged = await updateCourse(course.id, {
      holeCount: 5,
      pars: [2, 2, 2, 2, 2],
    })
    expect(holeCountChanged.holeCount).toBe(5)
    expect(holeCountChanged.updatedAt).toBe(3_000)
  })

  it('rejects a merged result that no longer validates', async () => {
    const course = await createCourse({ name: 'Windmill', holeCount: 3, pars: [2, 2, 2] })

    const emptyName = await captureValidationError(() =>
      updateCourse(course.id, { name: '   ' }),
    )
    expect(emptyName.field).toBe('name')

    // Changing the hole count without new pars leaves a stale pars array.
    const stalePars = await captureValidationError(() => updateCourse(course.id, { holeCount: 5 }))
    expect(stalePars.field).toBe('pars')

    const badMax = await captureValidationError(() =>
      updateCourse(course.id, { maxStrokes: 100 }),
    )
    expect(badMax.field).toBe('maxStrokes')

    // Nothing was persisted by the failed updates.
    expect(await db.courses.get(course.id)).toEqual(course)
  })

  it('clears maxStrokes and notes when passed explicitly as undefined', async () => {
    const course = await createCourse({
      name: 'Links',
      holeCount: 2,
      maxStrokes: 5,
      notes: 'note',
    })

    const cleared = await updateCourse(course.id, { maxStrokes: undefined, notes: undefined })

    expect('maxStrokes' in cleared).toBe(false)
    expect('notes' in cleared).toBe(false)
    expect(await db.courses.get(course.id)).toEqual(cleared)
  })

  it('keeps maxStrokes and notes untouched when omitted', async () => {
    const course = await createCourse({
      name: 'Links',
      holeCount: 2,
      maxStrokes: 5,
      notes: 'note',
    })

    const updated = await updateCourse(course.id, { name: 'Links 2' })

    expect(updated.maxStrokes).toBe(5)
    expect(updated.notes).toBe('note')
  })
})

describe('archiveCourse', () => {
  it('sets and clears archivedAt without dropping other fields', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_000)
    const course = await createCourse({ name: 'Windmill', holeCount: 3 })

    vi.setSystemTime(2_000)
    const archived = await archiveCourse(course.id, true)
    expect(archived.archivedAt).toBe(2_000)
    expect(archived.updatedAt).toBe(2_000)
    expect(archived.pars).toEqual([2, 2, 2])

    vi.setSystemTime(3_000)
    const restored = await archiveCourse(course.id, false)
    expect('archivedAt' in restored).toBe(false)
    expect(await db.courses.get(course.id)).toEqual(restored)
  })
})

describe('listCourses', () => {
  it('sorts alphabetically by normalized name', async () => {
    await createCourse({ name: 'Windmill', holeCount: 2 })
    await createCourse({ name: 'alpine', holeCount: 2 })
    await createCourse({ name: 'Cove', holeCount: 2 })

    const names = (await listCourses()).map((course) => course.name)

    expect(names).toEqual(['alpine', 'Cove', 'Windmill'])
  })

  it('hides archived courses by default but includes them on request', async () => {
    await createCourse({ name: 'Active', holeCount: 2 })
    const hidden = await createCourse({ name: 'Hidden', holeCount: 2 })
    await archiveCourse(hidden.id, true)

    expect((await listCourses()).map((course) => course.name)).toEqual(['Active'])
    expect((await listCourses({ includeArchived: true })).map((course) => course.name)).toEqual([
      'Active',
      'Hidden',
    ])
  })
})

describe('deleteCourse', () => {
  it('deletes a course without rounds', async () => {
    const course = await createCourse({ name: 'Doomed', holeCount: 2 })

    await deleteCourse(course.id)

    expect(await db.courses.get(course.id)).toBeUndefined()
  })

  it('refuses to delete a course that has rounds and asks for archiving', async () => {
    const course = await createCourse({ name: 'Played', holeCount: 2 })
    const player = await createPlayer('Alice')
    await createRound({ courseId: course.id, playerIds: [player.id], datePlayed: '2026-10-17' })

    await expect(deleteCourse(course.id)).rejects.toThrow(/archive/)
    expect(await db.courses.get(course.id)).toBeDefined()
  })
})
