import Dexie, { type Table } from 'dexie'
import type { Course, Player, Round, Score, Setting, UUID } from './types'

/** Primary key of the `scores` table: [roundId, playerId, holeNumber]. */
export type ScoreKey = [UUID, UUID, number]

/** Typed Dexie database for Caddy. */
export class CaddyDatabase extends Dexie {
  declare courses: Table<Course, UUID>
  declare players: Table<Player, UUID>
  declare rounds: Table<Round, UUID>
  declare scores: Table<Score, ScoreKey>
  declare settings: Table<Setting, string>

  constructor(name = 'caddy') {
    super(name)

    // Schema versions are append-only: never renumber or rewrite a shipped
    // version, because existing browser databases already ran it. Future
    // changes go in a new `version(n + 1).stores(...).upgrade(...)`.
    this.version(1).stores({
      courses: 'id, nameNormalized',
      players: 'id, &nameNormalized',
      rounds: 'id, courseId, datePlayed, status',
      scores: '[roundId+playerId+holeNumber], roundId',
      settings: 'key',
    })
  }
}

/** Shared database instance used by the app. */
export const db = new CaddyDatabase()
