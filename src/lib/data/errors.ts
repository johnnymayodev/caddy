/**
 * Field-level validation failure raised by the pure `validate*` helpers in this
 * directory. Carries the offending `field` so forms can highlight the exact
 * input that needs fixing.
 */
export class ValidationError extends Error {
  /** Name of the offending field, e.g. `name` or `pars[2]`. */
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}
