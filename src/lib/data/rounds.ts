import { db } from '@/lib/db'
import type { CourseSnapshot, Round, RoundStatus, Score, UUID } from '@/lib/types'
import { ValidationError } from './errors'

/** Fields accepted when creating a round. */
export interface NewRound {
  courseId: UUID
  playerIds: UUID[]
  datePlayed: string
  notes?: string
}

/** Editable round metadata; omitted properties keep their current value. */
export interface RoundPatch {
  datePlayed?: string
  /** Pass `undefined` explicitly to clear the notes. */
  notes?: string | undefined
}

export interface RoundFilter {
  courseId?: UUID
  status?: RoundStatus
}

export interface RoundWithScores {
  round: Round
  scores: Score[]
}

/** Fields accepted when setting a score. */
export interface ScoreInput {
  roundId: UUID
  playerId: UUID
  holeNumber: number
  strokes: number
  pickedUp?: boolean
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Enforces the `YYYY-MM-DD` local calendar date used by `datePlayed`. */
export function validateDatePlayed(datePlayed: string): string {
  if (typeof datePlayed !== 'string' || !DATE_PATTERN.test(datePlayed)) {
    throw new ValidationError('datePlayed', 'datePlayed must use the YYYY-MM-DD format')
  }
  const [year, month, day] = datePlayed.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ValidationError('datePlayed', `datePlayed ${datePlayed} is not a real calendar date`)
  }
  return datePlayed
}

/** Enforces between 1 and 8 unique player ids. */
export function validatePlayerIds(playerIds: UUID[]): UUID[] {
  if (!Array.isArray(playerIds) || playerIds.length < 1 || playerIds.length > 8) {
    throw new ValidationError('playerIds', 'playerIds must contain between 1 and 8 players')
  }
  if (new Set(playerIds).size !== playerIds.length) {
    throw new ValidationError('playerIds', 'playerIds must not contain duplicates')
  }
  return [...playerIds]
}

/** Enforces a hole number inside the snapshot's hole count. */
export function validateHoleNumber(holeNumber: number, holeCount: number): number {
  if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > holeCount) {
    throw new ValidationError('holeNumber', `holeNumber must be an integer between 1 and ${holeCount}`)
  }
  return holeNumber
}

/** Enforces the raw strokes range (integer 1 to 99) before any maxStrokes clamp. */
export function validateStrokes(strokes: number): number {
  if (!Number.isInteger(strokes) || strokes < 1 || strokes > 99) {
    throw new ValidationError('strokes', 'strokes must be an integer between 1 and 99')
  }
  return strokes
}

/** Caps a stroke count at the round's frozen maxStrokes, when the course set one. */
export function clampStrokes(round: Round, strokes: number): number {
  const maxStrokes = round.courseSnapshot.maxStrokes
  return maxStrokes === undefined ? strokes : Math.min(strokes, maxStrokes)
}

/** Creates an in-progress local round, freezing the course rules into a snapshot. */
export async function createRound(input: NewRound): Promise<Round> {
  const course = await db.courses.get(input.courseId)
  if (!course) throw new ValidationError('courseId', `Course ${input.courseId} not found`)

  const playerIds = validatePlayerIds(input.playerIds)
  const players = await db.players.bulkGet(playerIds)
  const missing = playerIds.filter((_, index) => players[index] === undefined)
  if (missing.length > 0) {
    throw new ValidationError('playerIds', `Unknown player(s): ${missing.join(', ')}`)
  }

  const datePlayed = validateDatePlayed(input.datePlayed)
  const courseSnapshot: CourseSnapshot = {
    name: course.name,
    holeCount: course.holeCount,
    pars: [...course.pars],
  }
  if (course.maxStrokes !== undefined) courseSnapshot.maxStrokes = course.maxStrokes

  const now = Date.now()
  const round: Round = {
    id: crypto.randomUUID(),
    courseId: course.id,
    courseSnapshot,
    playerIds,
    datePlayed,
    status: 'in-progress',
    source: 'local',
    createdAt: now,
    updatedAt: now,
  }
  if (input.notes !== undefined) round.notes = input.notes

  await db.rounds.add(round)
  return round
}

/** Upserts one hole score and refreshes the round's `updatedAt`. */
export async function setScore(input: ScoreInput): Promise<Score> {
  const round = await db.rounds.get(input.roundId)
  if (!round) throw new Error(`Round ${input.roundId} not found`)
  if (!round.playerIds.includes(input.playerId)) {
    throw new ValidationError('playerId', `Player ${input.playerId} is not in round ${input.roundId}`)
  }
  validateHoleNumber(input.holeNumber, round.courseSnapshot.holeCount)
  const strokes = clampStrokes(round, validateStrokes(input.strokes))

  const now = Date.now()
  const score: Score = {
    roundId: round.id,
    playerId: input.playerId,
    holeNumber: input.holeNumber,
    strokes,
    updatedAt: now,
  }
  if (input.pickedUp === true) score.pickedUp = true

  await db.transaction('rw', db.scores, db.rounds, async () => {
    await db.scores.put(score)
    await db.rounds.update(round.id, { updatedAt: now })
  })
  return score
}

/** Removes a score row; forgiving when nothing was entered for that hole. */
export async function clearScore(roundId: UUID, playerId: UUID, holeNumber: number): Promise<void> {
  await db.transaction('rw', db.scores, db.rounds, async () => {
    await db.scores.delete([roundId, playerId, holeNumber])
    await db.rounds.update(roundId, { updatedAt: Date.now() })
  })
}

/** Loads a round with its scores sorted by hole, then player. */
export async function getRound(id: UUID): Promise<RoundWithScores | undefined> {
  const round = await db.rounds.get(id)
  if (!round) return undefined

  const scores = await db.scores.where('roundId').equals(id).toArray()
  scores.sort((a, b) => a.holeNumber - b.holeNumber || a.playerId.localeCompare(b.playerId))
  return { round, scores }
}

/** Lists rounds newest first by local play date. */
export async function listRounds(filter: RoundFilter = {}): Promise<Round[]> {
  const rounds = await db.rounds.toArray()
  return rounds
    .filter(
      (round) =>
        (filter.courseId === undefined || round.courseId === filter.courseId) &&
        (filter.status === undefined || round.status === filter.status),
    )
    .sort((a, b) => b.datePlayed.localeCompare(a.datePlayed))
}

/** Completes a round, refusing while scores are missing unless `force` is set. */
export async function completeRound(id: UUID, options: { force?: boolean } = {}): Promise<Round> {
  const round = await db.rounds.get(id)
  if (!round) throw new Error(`Round ${id} not found`)

  const expected = round.playerIds.length * round.courseSnapshot.holeCount
  const entered = await db.scores.where('roundId').equals(id).count()
  if (options.force !== true && entered < expected) {
    throw new Error(
      `Round ${id} is missing ${expected - entered} of ${expected} scores (pass force to complete anyway)`,
    )
  }

  const now = Date.now()
  const updated: Round = { ...round, status: 'completed', completedAt: now, updatedAt: now }
  await db.rounds.put(updated)
  return updated
}

/** Moves a round back to in-progress and clears its completion time. */
export async function reopenRound(id: UUID): Promise<Round> {
  const round = await db.rounds.get(id)
  if (!round) throw new Error(`Round ${id} not found`)

  const updated: Round = { ...round, status: 'in-progress', updatedAt: Date.now() }
  delete updated.completedAt
  await db.rounds.put(updated)
  return updated
}

/** Marks a round abandoned, keeping its scores for the record. */
export async function abandonRound(id: UUID): Promise<Round> {
  const round = await db.rounds.get(id)
  if (!round) throw new Error(`Round ${id} not found`)

  const updated: Round = { ...round, status: 'abandoned', updatedAt: Date.now() }
  delete updated.completedAt
  await db.rounds.put(updated)
  return updated
}

/** Updates editable round metadata (notes and local date) with re-validation. */
export async function updateRound(id: UUID, patch: RoundPatch): Promise<Round> {
  const round = await db.rounds.get(id)
  if (!round) throw new Error(`Round ${id} not found`)

  const updated: Round = { ...round, updatedAt: Date.now() }
  if (patch.datePlayed !== undefined) updated.datePlayed = validateDatePlayed(patch.datePlayed)
  if ('notes' in patch) {
    if (patch.notes === undefined) delete updated.notes
    else updated.notes = patch.notes
  }

  await db.rounds.put(updated)
  return updated
}

/** Deletes a round and every score recorded against it, in one transaction. */
export async function deleteRound(id: UUID): Promise<void> {
  await db.transaction('rw', db.rounds, db.scores, async () => {
    await db.scores.where('roundId').equals(id).delete()
    await db.rounds.delete(id)
  })
}
