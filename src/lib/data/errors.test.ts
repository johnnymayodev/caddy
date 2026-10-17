import { describe, expect, it } from 'vitest'
import { createCourse, validateCourseName, validatePars } from '@/lib/data/courses'
import { ValidationError } from '@/lib/data/errors'

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

describe('ValidationError', () => {
  it('carries the offending field and reads as an Error', () => {
    const error = new ValidationError('name', 'name must be 1 to 80 characters')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.name).toBe('ValidationError')
    expect(error.field).toBe('name')
    expect(error.message).toBe('name must be 1 to 80 characters')
  })

  it('is thrown by pure validators with the failing field', async () => {
    const error = await captureValidationError(() => validateCourseName('   '))
    expect(error.field).toBe('name')
  })

  it('reports per-par failures with the array index', async () => {
    const error = await captureValidationError(() => validatePars([2, 7, 2], 3))
    expect(error.field).toBe('pars[1]')
    expect(error.message).toContain('pars[1]')
  })

  it('is thrown by async creators through the same class', async () => {
    const error = await captureValidationError(() => createCourse({ name: '', holeCount: 3 }))
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.field).toBe('name')
  })
})
