import { describe, test, expect } from 'vitest'
import { UNIT_ABBREVIATIONS, formatDisplayValue } from './componentColumns'

// ---------------------------------------------------------------------------
// UNIT_ABBREVIATIONS
// ---------------------------------------------------------------------------

describe('UNIT_ABBREVIATIONS', () => {
  describe('mass units', () => {
    test('kilograms → kg', () => {
      expect(UNIT_ABBREVIATIONS['kilograms']).toBe('kg')
    })
    test('grams → g', () => {
      expect(UNIT_ABBREVIATIONS['grams']).toBe('g')
    })
    test('pounds → lb', () => {
      expect(UNIT_ABBREVIATIONS['pounds']).toBe('lb')
    })
    test('ounces → oz', () => {
      expect(UNIT_ABBREVIATIONS['ounces']).toBe('oz')
    })
  })

  describe('length units', () => {
    test('centimeters → cm', () => {
      expect(UNIT_ABBREVIATIONS['centimeters']).toBe('cm')
    })
    test('millimeters → mm', () => {
      expect(UNIT_ABBREVIATIONS['millimeters']).toBe('mm')
    })
    test('meters → m', () => {
      expect(UNIT_ABBREVIATIONS['meters']).toBe('m')
    })
    test('inches → in', () => {
      expect(UNIT_ABBREVIATIONS['inches']).toBe('in')
    })
    test('feet → ft', () => {
      expect(UNIT_ABBREVIATIONS['feet']).toBe('ft')
    })
  })

  describe('volume units', () => {
    test('cubic centimeters → cm³', () => {
      expect(UNIT_ABBREVIATIONS['cubic centimeters']).toBe('cm³')
    })
    test('cubic millimeters → mm³', () => {
      expect(UNIT_ABBREVIATIONS['cubic millimeters']).toBe('mm³')
    })
    test('cubic meters → m³', () => {
      expect(UNIT_ABBREVIATIONS['cubic meters']).toBe('m³')
    })
    test('cubic inches → in³', () => {
      expect(UNIT_ABBREVIATIONS['cubic inches']).toBe('in³')
    })
    test('cubic feet → ft³', () => {
      expect(UNIT_ABBREVIATIONS['cubic feet']).toBe('ft³')
    })
    test('liters → L', () => {
      expect(UNIT_ABBREVIATIONS['liters']).toBe('L')
    })
  })

  describe('area units', () => {
    test('square centimeters → cm²', () => {
      expect(UNIT_ABBREVIATIONS['square centimeters']).toBe('cm²')
    })
    test('square millimeters → mm²', () => {
      expect(UNIT_ABBREVIATIONS['square millimeters']).toBe('mm²')
    })
    test('square meters → m²', () => {
      expect(UNIT_ABBREVIATIONS['square meters']).toBe('m²')
    })
    test('square inches → in²', () => {
      expect(UNIT_ABBREVIATIONS['square inches']).toBe('in²')
    })
    test('square feet → ft²', () => {
      expect(UNIT_ABBREVIATIONS['square feet']).toBe('ft²')
    })
  })

  describe('density units', () => {
    test('kilograms per cubic centimeter → kg/cm³', () => {
      expect(UNIT_ABBREVIATIONS['kilograms per cubic centimeter']).toBe('kg/cm³')
    })
    test('grams per cubic centimeter → g/cm³', () => {
      expect(UNIT_ABBREVIATIONS['grams per cubic centimeter']).toBe('g/cm³')
    })
    test('kilograms per cubic meter → kg/m³', () => {
      expect(UNIT_ABBREVIATIONS['kilograms per cubic meter']).toBe('kg/m³')
    })
    test('grams per cubic meter → g/m³', () => {
      expect(UNIT_ABBREVIATIONS['grams per cubic meter']).toBe('g/m³')
    })
    test('pounds per cubic inch → lb/in³', () => {
      expect(UNIT_ABBREVIATIONS['pounds per cubic inch']).toBe('lb/in³')
    })
  })

  test('does not contain an entry for an unknown unit like "parsecs"', () => {
    expect('parsecs' in UNIT_ABBREVIATIONS).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// formatDisplayValue
// ---------------------------------------------------------------------------

describe('formatDisplayValue', () => {
  test('null displayValue returns null', () => {
    expect(formatDisplayValue(null, 'kilograms', 2)).toBeNull()
  })

  test('empty string displayValue returns null', () => {
    expect(formatDisplayValue('', 'kilograms', 2)).toBeNull()
  })

  test('displayValue with no numeric prefix returns the raw string unchanged', () => {
    expect(formatDisplayValue('N/A', 'kilograms', 2)).toBe('N/A')
  })

  test('displayValue with no numeric prefix and no unit returns the raw string unchanged', () => {
    expect(formatDisplayValue('unknown', null, 2)).toBe('unknown')
  })

  test('numeric displayValue with unitName=null returns formatted number only', () => {
    expect(formatDisplayValue('3.14159', null, 2)).toBe('3.14')
  })

  test('decimalPlaces=0 produces integer formatting', () => {
    expect(formatDisplayValue('7.89', null, 0)).toBe('8')
  })

  test('decimalPlaces=2 produces two decimal places', () => {
    expect(formatDisplayValue('1.5', null, 2)).toBe('1.50')
  })

  test('decimalPlaces=4 produces four decimal places', () => {
    expect(formatDisplayValue('2.7', null, 4)).toBe('2.7000')
  })

  test('known unit is abbreviated: kilograms → kg', () => {
    expect(formatDisplayValue('10.0', 'kilograms', 1)).toBe('10.0 kg')
  })

  test('known unit is abbreviated: cubic centimeters → cm³', () => {
    expect(formatDisplayValue('500', 'cubic centimeters', 0)).toBe('500 cm³')
  })

  test('unit lookup is case-insensitive: KILOGRAMS → kg', () => {
    expect(formatDisplayValue('5.0', 'KILOGRAMS', 1)).toBe('5.0 kg')
  })

  test('unit lookup is case-insensitive: Millimeters → mm', () => {
    expect(formatDisplayValue('12', 'Millimeters', 0)).toBe('12 mm')
  })

  test('unknown unit falls back to the raw unitName string', () => {
    expect(formatDisplayValue('9.81', 'parsecs', 2)).toBe('9.81 parsecs')
  })

  test('negative numbers work correctly with a known unit', () => {
    expect(formatDisplayValue('-3.5', 'grams', 1)).toBe('-3.5 g')
  })

  test('negative numbers work correctly with unitName=null', () => {
    expect(formatDisplayValue('-42.123', null, 2)).toBe('-42.12')
  })

  test('displayValue with trailing text: numeric prefix is parsed, trailing part is ignored', () => {
    // '12.5 cm' — the regex captures '12.5', trailing ' cm' is dropped
    expect(formatDisplayValue('12.5 cm', 'millimeters', 1)).toBe('12.5 mm')
  })

  test('displayValue with trailing text and no unit: returns formatted number only', () => {
    expect(formatDisplayValue('12.5 cm', null, 0)).toBe('13')
  })

  test('integer displayValue works with decimalPlaces=2', () => {
    expect(formatDisplayValue('42', 'pounds', 2)).toBe('42.00 lb')
  })

  test('integer displayValue works with decimalPlaces=0', () => {
    expect(formatDisplayValue('42', null, 0)).toBe('42')
  })

  test('zero value is formatted and returned (not treated as falsy)', () => {
    expect(formatDisplayValue('0', 'meters', 2)).toBe('0.00 m')
  })

  test('large number is formatted with correct decimal places', () => {
    expect(formatDisplayValue('123456.789', 'square meters', 1)).toBe('123456.8 m²')
  })
})
