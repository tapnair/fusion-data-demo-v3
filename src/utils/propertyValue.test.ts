import { coercePropertyValue } from './propertyValue'

describe('coercePropertyValue', () => {
  // ─── STRING ────────────────────────────────────────────────────────────────

  describe('STRING specification', () => {
    it('returns the trimmed input value', () => {
      const result = coercePropertyValue('  hello world  ', 'STRING')
      expect(result).toEqual({ value: 'hello world', error: null })
    })

    it('returns an empty string when input is only whitespace', () => {
      const result = coercePropertyValue('   ', 'STRING')
      expect(result).toEqual({ value: '', error: null })
    })

    it('returns the value unchanged when there is nothing to trim', () => {
      const result = coercePropertyValue('exact', 'STRING')
      expect(result).toEqual({ value: 'exact', error: null })
    })
  })

  // ─── INTEGER ───────────────────────────────────────────────────────────────

  describe('INTEGER specification', () => {
    it('parses a positive integer', () => {
      const result = coercePropertyValue('42', 'INTEGER')
      expect(result).toEqual({ value: 42, error: null })
    })

    it('parses zero', () => {
      const result = coercePropertyValue('0', 'INTEGER')
      expect(result).toEqual({ value: 0, error: null })
    })

    it('parses a negative integer', () => {
      const result = coercePropertyValue('-7', 'INTEGER')
      expect(result).toEqual({ value: -7, error: null })
    })

    it('trims surrounding whitespace before parsing', () => {
      const result = coercePropertyValue('  42  ', 'INTEGER')
      expect(result).toEqual({ value: 42, error: null })
    })

    it('returns an error for a non-integer float', () => {
      const result = coercePropertyValue('3.14', 'INTEGER')
      expect(result).toEqual({ value: null, error: 'Must be a whole number' })
    })

    it('returns an error for a non-numeric string', () => {
      const result = coercePropertyValue('abc', 'INTEGER')
      expect(result).toEqual({ value: null, error: 'Must be a whole number' })
    })

    it('returns an error for a whitespace-only string', () => {
      const result = coercePropertyValue('   ', 'INTEGER')
      expect(result).toEqual({ value: null, error: 'Must be a whole number' })
    })

    it('returns an error for an empty string', () => {
      const result = coercePropertyValue('', 'INTEGER')
      expect(result).toEqual({ value: null, error: 'Must be a whole number' })
    })
  })

  // ─── FLOAT and numeric-unit specs ─────────────────────────────────────────

  const floatLikeSpecs = ['FLOAT', 'DISTANCE', 'DENSITY', 'MASS', 'VOLUME', 'AREA'] as const

  for (const spec of floatLikeSpecs) {
    describe(`${spec} specification`, () => {
      it('parses a decimal float', () => {
        const result = coercePropertyValue('3.14', spec)
        expect(result).toEqual({ value: 3.14, error: null })
      })

      it('parses an integer-valued string (valid float)', () => {
        const result = coercePropertyValue('10', spec)
        expect(result).toEqual({ value: 10, error: null })
      })

      it('parses a negative float', () => {
        const result = coercePropertyValue('-0.5', spec)
        expect(result).toEqual({ value: -0.5, error: null })
      })

      it('returns an error for a non-numeric string', () => {
        const result = coercePropertyValue('NaN', spec)
        expect(result).toEqual({ value: null, error: 'Must be a number' })
      })

      it('returns an error for a plain alphabetic string', () => {
        const result = coercePropertyValue('abc', spec)
        expect(result).toEqual({ value: null, error: 'Must be a number' })
      })

      it('returns an error for an empty string', () => {
        const result = coercePropertyValue('', spec)
        expect(result).toEqual({ value: null, error: 'Must be a number' })
      })
    })
  }

  // ─── BOOLEAN ───────────────────────────────────────────────────────────────

  describe('BOOLEAN specification', () => {
    it("parses 'true' → true", () => {
      const result = coercePropertyValue('true', 'BOOLEAN')
      expect(result).toEqual({ value: true, error: null })
    })

    it("parses 'false' → false", () => {
      const result = coercePropertyValue('false', 'BOOLEAN')
      expect(result).toEqual({ value: false, error: null })
    })

    it("parses '1' → true", () => {
      const result = coercePropertyValue('1', 'BOOLEAN')
      expect(result).toEqual({ value: true, error: null })
    })

    it("parses '0' → false", () => {
      const result = coercePropertyValue('0', 'BOOLEAN')
      expect(result).toEqual({ value: false, error: null })
    })

    it("returns an error for 'yes' (not a supported truthy token)", () => {
      const result = coercePropertyValue('yes', 'BOOLEAN')
      expect(result).toEqual({ value: null, error: 'Must be true or false' })
    })

    it("returns an error for 'TRUE' (uppercase — case-sensitive match)", () => {
      // The implementation does a strict equality check ('true' === trimmed),
      // so uppercase is NOT accepted.
      const result = coercePropertyValue('TRUE', 'BOOLEAN')
      expect(result).toEqual({ value: null, error: 'Must be true or false' })
    })

    it("returns an error for 'no'", () => {
      const result = coercePropertyValue('no', 'BOOLEAN')
      expect(result).toEqual({ value: null, error: 'Must be true or false' })
    })

    it('returns an error for an empty string', () => {
      const result = coercePropertyValue('', 'BOOLEAN')
      expect(result).toEqual({ value: null, error: 'Must be true or false' })
    })
  })

  // ─── null / undefined specification (fall-through to STRING default) ───────

  describe('null or undefined specification', () => {
    it('falls through to STRING behaviour when specification is null', () => {
      const result = coercePropertyValue('  hello  ', null)
      expect(result).toEqual({ value: 'hello', error: null })
    })

    it('falls through to STRING behaviour when specification is undefined', () => {
      // TypeScript signature accepts string | null, but casting covers the
      // runtime path where callers pass undefined.
      const result = coercePropertyValue('world', undefined as unknown as null)
      expect(result).toEqual({ value: 'world', error: null })
    })
  })

  // ─── Whitespace trimming integration ──────────────────────────────────────

  describe('whitespace trimming', () => {
    it('trims before INTEGER validation so "  42  " is accepted', () => {
      const result = coercePropertyValue('  42  ', 'INTEGER')
      expect(result).toEqual({ value: 42, error: null })
    })

    it('trims before FLOAT validation so "  1.5  " is accepted', () => {
      const result = coercePropertyValue('  1.5  ', 'FLOAT')
      expect(result).toEqual({ value: 1.5, error: null })
    })

    it('trims before BOOLEAN validation so "  true  " is accepted', () => {
      const result = coercePropertyValue('  true  ', 'BOOLEAN')
      expect(result).toEqual({ value: true, error: null })
    })
  })
})
