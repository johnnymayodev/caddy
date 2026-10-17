import { db } from '@/lib/db'
import type { Player, UUID } from '@/lib/types'
import { ValidationError } from './errors'

/** Trims a player name and enforces the 1 to 40 character limit. */
export function validatePlayerName(name: string): string {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (trimmed.length === 0 || trimmed.length > 40) {
    throw new ValidationError('name', 'name must be 1 to 40 characters')
  }
  return trimmed
}

/**
 * Creates a player unless one with the same normalized name already exists,
 * in which case the existing player is returned (case/whitespace dedupe).
 */
export async function createPlayer(name: string): Promise<Player> {
  const trimmed = validatePlayerName(name)
  const nameNormalized = trimmed.toLowerCase()

  const existing = await db.players.where('nameNormalized').equals(nameNormalized).first()
  if (existing) return existing

  const player: Player = {
    id: crypto.randomUUID(),
    name: trimmed,
    nameNormalized,
    createdAt: Date.now(),
  }
  await db.players.add(player)
  return player
}

/** Renames a player, refusing a name that another player already uses. */
export async function renamePlayer(id: UUID, name: string): Promise<Player> {
  const trimmed = validatePlayerName(name)
  const nameNormalized = trimmed.toLowerCase()

  const player = await db.players.get(id)
  if (!player) throw new Error(`Player ${id} not found`)

  const clash = await db.players.where('nameNormalized').equals(nameNormalized).first()
  if (clash && clash.id !== id) {
    throw new ValidationError('name', `Player ${clash.name} already uses that name`)
  }

  const updated: Player = { ...player, name: trimmed, nameNormalized }
  await db.players.put(updated)
  return updated
}

/** Lists players alphabetically. */
export async function listPlayers(): Promise<Player[]> {
  const players = await db.players.toArray()
  return players.sort((a, b) => a.nameNormalized.localeCompare(b.nameNormalized))
}
