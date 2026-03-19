/**
 * Coerces a raw string input to the correct PropertyValue type based on
 * the property's specification. Returns the coerced value on success or
 * an error message string on failure.
 */
export function coercePropertyValue(
  rawValue: string,
  specification: string | null
): { value: string | number | boolean; error: null } | { value: null; error: string } {
  const trimmed = rawValue.trim()

  switch (specification) {
    case 'INTEGER': {
      if (!/^-?\d+$/.test(trimmed)) {
        return { value: null, error: 'Must be a whole number' }
      }
      const n = parseInt(trimmed, 10)
      if (isNaN(n)) return { value: null, error: 'Must be a whole number' }
      return { value: n, error: null }
    }

    case 'FLOAT':
    case 'DISTANCE':
    case 'DENSITY':
    case 'MASS':
    case 'VOLUME':
    case 'AREA': {
      const n = parseFloat(trimmed)
      if (isNaN(n)) return { value: null, error: 'Must be a number' }
      return { value: n, error: null }
    }

    case 'BOOLEAN': {
      if (trimmed === 'true' || trimmed === '1') return { value: true, error: null }
      if (trimmed === 'false' || trimmed === '0') return { value: false, error: null }
      return { value: null, error: 'Must be true or false' }
    }

    case 'STRING':
    default:
      return { value: trimmed, error: null }
  }
}
