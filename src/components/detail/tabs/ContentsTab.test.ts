import { describe, test, expect } from 'vitest'
import { formatExtensionType, formatBytes } from './ContentsTab'

// ── formatExtensionType ───────────────────────────────────────────────────────

describe('formatExtensionType', () => {
  test('null input returns em-dash', () => {
    expect(formatExtensionType(null)).toBe('—')
  })

  test('empty string returns em-dash', () => {
    expect(formatExtensionType('')).toBe('—')
  })

  // Known EXTENSION_TYPE_LABELS entries
  test('autodesk.fusion360:Design returns "Fusion Design"', () => {
    expect(formatExtensionType('autodesk.fusion360:Design')).toBe('Fusion Design')
  })

  test('autodesk.fusion360:Drawing returns "Fusion Drawing"', () => {
    expect(formatExtensionType('autodesk.fusion360:Drawing')).toBe('Fusion Drawing')
  })

  test('autodesk.fusion360:Library returns "Fusion Library"', () => {
    expect(formatExtensionType('autodesk.fusion360:Library')).toBe('Fusion Library')
  })

  test('autodesk.fusion:Nest returns "Fusion Nest"', () => {
    expect(formatExtensionType('autodesk.fusion:Nest')).toBe('Fusion Nest')
  })

  test('autodesk.cam:Operation returns "CAM Operation"', () => {
    expect(formatExtensionType('autodesk.cam:Operation')).toBe('CAM Operation')
  })

  test('autodesk.bim360:Document returns "BIM360 Document"', () => {
    expect(formatExtensionType('autodesk.bim360:Document')).toBe('BIM360 Document')
  })

  // Unknown types with a colon — segment after last colon, PascalCase split
  test('unknown type with colon: PascalCase segment is space-separated', () => {
    expect(formatExtensionType('autodesk.foo:MyCustomType')).toBe('My Custom Type')
  })

  test('unknown type with colon: single-word segment after colon is trimmed', () => {
    expect(formatExtensionType('something:SimpleWord')).toBe('Simple Word')
  })

  // Unknown types without a colon — whole string, PascalCase split
  test('unknown type without colon: whole string PascalCase split', () => {
    expect(formatExtensionType('SomePascalType')).toBe('Some Pascal Type')
  })
})

// ── formatBytes ───────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  test('null returns em-dash', () => {
    expect(formatBytes(null)).toBe('—')
  })

  test('empty string returns em-dash', () => {
    expect(formatBytes('')).toBe('—')
  })

  test('non-numeric string "abc" returns em-dash', () => {
    expect(formatBytes('abc')).toBe('—')
  })

  test('0 returns "0 B"', () => {
    expect(formatBytes('0')).toBe('0 B')
  })

  test('1 returns "1.0 B" (value < 10 → one decimal)', () => {
    expect(formatBytes('1')).toBe('1.0 B')
  })

  test('9 returns "9.0 B"', () => {
    expect(formatBytes('9')).toBe('9.0 B')
  })

  test('10 returns "10 B" (value >= 10 → rounded integer)', () => {
    expect(formatBytes('10')).toBe('10 B')
  })

  test('1023 returns "1023 B"', () => {
    expect(formatBytes('1023')).toBe('1023 B')
  })

  test('1024 returns "1.0 KB"', () => {
    expect(formatBytes('1024')).toBe('1.0 KB')
  })

  test('1025 returns "1.0 KB"', () => {
    expect(formatBytes('1025')).toBe('1.0 KB')
  })

  test('10240 returns "10 KB"', () => {
    expect(formatBytes('10240')).toBe('10 KB')
  })

  test('1048575 returns "1024 KB" (just under 1 MB)', () => {
    // Math.floor(log(1048575)/log(1024)) = 1 → KB
    // value = 1048575 / 1024 = 1023.999... ≥ 10 → Math.round → 1024
    expect(formatBytes('1048575')).toBe('1024 KB')
  })

  test('1048576 returns "1.0 MB" (exactly 1 MB)', () => {
    expect(formatBytes('1048576')).toBe('1.0 MB')
  })

  test('10485760 returns "10 MB"', () => {
    expect(formatBytes('10485760')).toBe('10 MB')
  })

  test('1073741824 returns "1.0 GB"', () => {
    expect(formatBytes('1073741824')).toBe('1.0 GB')
  })

  test('1099511627776 returns "1.0 TB"', () => {
    expect(formatBytes('1099511627776')).toBe('1.0 TB')
  })

  test('5368709120 (5 GB) returns "5.0 GB"', () => {
    // 5368709120 / 1024^3 = 5.0 → value < 10 → toFixed(1)
    expect(formatBytes('5368709120')).toBe('5.0 GB')
  })
})
