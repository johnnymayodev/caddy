import { db } from '@/lib/db'
import type { Course, UUID } from '@/lib/types'
import { ValidationError } from './errors'

/** Fields accepted when creating a course. */
export interface NewCourse {
  name: string
  holeCount: number
  /** Per-hole pars; every hole defaults to par 2 when omitted. */
  pars?: number[]
  maxStrokes?: number
  notes?: string
}

/** Editable fields; omitted properties keep their current value. */
export interface CoursePatch {
  name?: string
  holeCount?: number
  pars?: number[]
  /** Pass `undefined` explicitly to clear the limit. */
  maxStrokes?: number | undefined
  /** Pass `undefined` explicitly to clear the notes. */
  notes?: string | undefined
}

/** Trims a course name and enforces the 1 to 80 character limit. */
export function validateCourseName(name: string): string {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (trimmed.length === 0 || trimmed.length > 80) {
    throw new ValidationError('name', 'name must be 1 to 80 characters')
  }
  return trimmed
}

/** Enforces an integer hole count between 1 and 36. */
export function validateHoleCount(holeCount: number): number {
  if (!Number.isInteger(holeCount) || holeCount < 1 || holeCount > 36) {
    throw new ValidationError('holeCount', 'holeCount must be an integer between 1 and 36')
  }
  return holeCount
}

/** Enforces one integer par (1 to 6) per hole, defaulting every hole to par 2. */
export function validatePars(pars: number[] | undefined, holeCount: number): number[] {
  if (pars === undefined) return Array.from({ length: holeCount }, () => 2)
  if (!Array.isArray(pars) || pars.length !== holeCount) {
    throw new ValidationError('pars', `pars must list one par for each of the ${holeCount} holes`)
  }
  for (const [index, par] of pars.entries()) {
    if (!Number.isInteger(par) || par < 1 || par > 6) {
      throw new ValidationError(`pars[${index}]`, `pars[${index}] must be an integer between 1 and 6`)
    }
  }
  return [...pars]
}

/** Enforces the optional per-hole stroke cap (integer 1 to 99). */
export function validateMaxStrokes(maxStrokes: number | undefined): number | undefined {
  if (maxStrokes === undefined) return undefined
  if (!Number.isInteger(maxStrokes) || maxStrokes < 1 || maxStrokes > 99) {
    throw new ValidationError('maxStrokes', 'maxStrokes must be an integer between 1 and 99')
  }
  return maxStrokes
}

/** Creates a course with defaults (par 2 on every hole) and normalized name. */
export async function createCourse(input: NewCourse): Promise<Course> {
  const name = validateCourseName(input.name)
  const holeCount = validateHoleCount(input.holeCount)
  const pars = validatePars(input.pars, holeCount)
  const maxStrokes = validateMaxStrokes(input.maxStrokes)

  const now = Date.now()
  const course: Course = {
    id: crypto.randomUUID(),
    name,
    nameNormalized: name.toLowerCase(),
    holeCount,
    pars,
    createdAt: now,
    updatedAt: now,
  }
  if (maxStrokes !== undefined) course.maxStrokes = maxStrokes
  if (input.notes !== undefined) course.notes = input.notes

  await db.courses.add(course)
  return course
}

/** Updates a course, re-validating the merged result. */
export async function updateCourse(id: UUID, patch: CoursePatch): Promise<Course> {
  const course = await db.courses.get(id)
  if (!course) throw new Error(`Course ${id} not found`)

  const name = patch.name === undefined ? course.name : validateCourseName(patch.name)
  const holeCount =
    patch.holeCount === undefined ? course.holeCount : validateHoleCount(patch.holeCount)
  const pars = validatePars(patch.pars === undefined ? course.pars : patch.pars, holeCount)
  const maxStrokes = 'maxStrokes' in patch ? validateMaxStrokes(patch.maxStrokes) : course.maxStrokes

  const updated: Course = {
    ...course,
    name,
    nameNormalized: name.toLowerCase(),
    holeCount,
    pars,
    updatedAt: Date.now(),
  }
  if (maxStrokes === undefined) delete updated.maxStrokes
  else updated.maxStrokes = maxStrokes
  if ('notes' in patch) {
    if (patch.notes === undefined) delete updated.notes
    else updated.notes = patch.notes
  }

  await db.courses.put(updated)
  return updated
}

/** Archives a course (or restores it with `archived = false`) without touching its rounds. */
export async function archiveCourse(id: UUID, archived: boolean): Promise<Course> {
  const course = await db.courses.get(id)
  if (!course) throw new Error(`Course ${id} not found`)

  const updated: Course = { ...course, updatedAt: Date.now() }
  if (archived) updated.archivedAt = updated.updatedAt
  else delete updated.archivedAt

  await db.courses.put(updated)
  return updated
}

/** Deletes a course that has no rounds; courses with history must be archived instead. */
export async function deleteCourse(id: UUID): Promise<void> {
  const roundCount = await db.rounds.where('courseId').equals(id).count()
  if (roundCount > 0) {
    throw new Error(`Course ${id} has ${roundCount} round(s); archive it instead of deleting`)
  }
  await db.courses.delete(id)
}

/** Lists courses alphabetically, hiding archived ones unless asked for. */
export async function listCourses(options: { includeArchived?: boolean } = {}): Promise<Course[]> {
  const courses = await db.courses.toArray()
  return courses
    .filter((course) => options.includeArchived === true || course.archivedAt === undefined)
    .sort((a, b) => a.nameNormalized.localeCompare(b.nameNormalized))
}
