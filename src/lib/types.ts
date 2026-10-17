/** Domain types for the Caddy data model (plan §5). */

/** UUID v4 string, generated with `crypto.randomUUID()`. */
export type UUID = string

export interface Course {
  id: UUID
  name: string
  nameNormalized: string
  holeCount: number
  pars: number[]
  maxStrokes?: number
  notes?: string
  /** Set instead of deleting a course that has rounds. */
  archivedAt?: number
  createdAt: number
  updatedAt: number
}

export interface Player {
  id: UUID
  name: string
  nameNormalized: string
  createdAt: number
}

/** Frozen copy of course rules, stored on a round so later course edits never rewrite history. */
export interface CourseSnapshot {
  name: string
  holeCount: number
  pars: number[]
  maxStrokes?: number
}

export type RoundStatus = 'in-progress' | 'completed' | 'abandoned'

export type RoundSource = 'local' | 'imported'

export interface Round {
  id: UUID
  courseId: UUID
  courseSnapshot: CourseSnapshot
  playerIds: UUID[]
  /** Local calendar date, `YYYY-MM-DD` — deliberately not an instant, to avoid timezone drift. */
  datePlayed: string
  status: RoundStatus
  notes?: string
  source: RoundSource
  createdAt: number
  updatedAt: number
  completedAt?: number
}

export interface Score {
  roundId: UUID
  playerId: UUID
  holeNumber: number
  strokes: number
  /** Present when the player stopped at the course's maxStrokes without holing out. */
  pickedUp?: true
  updatedAt: number
}

/** Schemaless settings row; new keys never need a database migration. */
export interface Setting {
  key: string
  value: unknown
}
