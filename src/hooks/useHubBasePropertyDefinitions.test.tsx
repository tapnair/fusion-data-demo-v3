import React from 'react'
import { describe, test, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing/react'
import { GraphQLError } from 'graphql'
import { useHubBasePropertyDefinitions } from './useHubBasePropertyDefinitions'
import { GET_HUB_BASE_PROPERTY_DEFINITIONS } from '../graphql/queries/baseProperties'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWrapper(mocks: any[]) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MockedProvider mocks={mocks} addTypename={false}>
        {children}
      </MockedProvider>
    )
  }
}

/**
 * Build a raw definition object matching the GraphQL response shape.
 * Uses `'key' in overrides` to distinguish an explicit null from "not provided".
 */
function makeDef(overrides: {
  id?: string
  name?: string
  specification?: string | null
  units?: { id: string; name: string } | null
  isHidden?: boolean
  isArchived?: boolean
  isReadOnly?: boolean
  propertyBehavior?: string | null
} = {}) {
  return {
    id: overrides.id ?? 'def1',
    name: overrides.name ?? 'Weight',
    specification: 'specification' in overrides ? overrides.specification : 'FLOAT',
    units: 'units' in overrides ? overrides.units : { id: 'u1', name: 'kilograms' },
    isHidden: overrides.isHidden ?? false,
    isArchived: overrides.isArchived ?? false,
    isReadOnly: overrides.isReadOnly ?? false,
    propertyBehavior: 'propertyBehavior' in overrides ? overrides.propertyBehavior : null,
  }
}

/** Build a collection object matching the GraphQL response shape (requires id & name). */
function makeCollection(id: string, defs: ReturnType<typeof makeDef>[]) {
  return {
    id,
    name: `Collection ${id}`,
    definitions: { results: defs },
  }
}

/** Build a full MockedProvider mock for GET_HUB_BASE_PROPERTY_DEFINITIONS. */
function makeMock(hubId: string, collections: ReturnType<typeof makeCollection>[]) {
  return {
    request: {
      query: GET_HUB_BASE_PROPERTY_DEFINITIONS,
      variables: { hubId },
    },
    result: {
      data: {
        hub: {
          id: hubId,
          basePropertyDefinitionCollections: {
            results: collections,
          },
        },
      },
    },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useHubBasePropertyDefinitions', () => {
  // 1. Skips query when hubId is null
  test('skips query when hubId is null', () => {
    const { result } = renderHook(
      () => useHubBasePropertyDefinitions(null),
      { wrapper: makeWrapper([]) },
    )

    expect(result.current.loading).toBe(false)
    expect(result.current.definitions).toEqual([])
    expect(result.current.error).toBeUndefined()
  })

  // 2. Skips query when hubId is undefined
  test('skips query when hubId is undefined', () => {
    const { result } = renderHook(
      () => useHubBasePropertyDefinitions(undefined),
      { wrapper: makeWrapper([]) },
    )

    expect(result.current.loading).toBe(false)
    expect(result.current.definitions).toEqual([])
    expect(result.current.error).toBeUndefined()
  })

  // 3. Returns loading=true initially when hubId is provided
  test('returns loading=true initially when hubId is provided', () => {
    const mock = makeMock('hub1', [
      makeCollection('col1', [makeDef()]),
    ])

    const { result } = renderHook(
      () => useHubBasePropertyDefinitions('hub1'),
      { wrapper: makeWrapper([mock]) },
    )

    // On the very first render, before the mock resolves, loading should be true
    expect(result.current.loading).toBe(true)
  })

  // 4. Flattens definitions across multiple collections
  test('flattens definitions across multiple collections', async () => {
    const mock = makeMock('hub1', [
      makeCollection('col1', [makeDef({ id: 'def1', name: 'Alpha' })]),
      makeCollection('col2', [makeDef({ id: 'def2', name: 'Beta' })]),
    ])

    const { result } = renderHook(
      () => useHubBasePropertyDefinitions('hub1'),
      { wrapper: makeWrapper([mock]) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.definitions).toHaveLength(2)
    const ids = result.current.definitions.map((d) => d.id)
    expect(ids).toContain('def1')
    expect(ids).toContain('def2')
  })

  // 5. Filters out isHidden definitions
  test('filters out isHidden definitions', async () => {
    const mock = makeMock('hub1', [
      makeCollection('col1', [
        makeDef({ id: 'visible', name: 'Visible', isHidden: false }),
        makeDef({ id: 'hidden', name: 'Hidden', isHidden: true }),
      ]),
    ])

    const { result } = renderHook(
      () => useHubBasePropertyDefinitions('hub1'),
      { wrapper: makeWrapper([mock]) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    const ids = result.current.definitions.map((d) => d.id)
    expect(ids).toContain('visible')
    expect(ids).not.toContain('hidden')
  })

  // 6. Filters out isArchived definitions
  test('filters out isArchived definitions', async () => {
    const mock = makeMock('hub1', [
      makeCollection('col1', [
        makeDef({ id: 'active', name: 'Active', isArchived: false }),
        makeDef({ id: 'archived', name: 'Archived', isArchived: true }),
      ]),
    ])

    const { result } = renderHook(
      () => useHubBasePropertyDefinitions('hub1'),
      { wrapper: makeWrapper([mock]) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    const ids = result.current.definitions.map((d) => d.id)
    expect(ids).toContain('active')
    expect(ids).not.toContain('archived')
  })

  // 7. Keeps definitions where both isHidden and isArchived are false
  test('keeps definitions where both isHidden and isArchived are false', async () => {
    const mock = makeMock('hub1', [
      makeCollection('col1', [
        makeDef({ id: 'kept', name: 'Normal', isHidden: false, isArchived: false }),
      ]),
    ])

    const { result } = renderHook(
      () => useHubBasePropertyDefinitions('hub1'),
      { wrapper: makeWrapper([mock]) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.definitions).toHaveLength(1)
    expect(result.current.definitions[0].id).toBe('kept')
  })

  // 8a. Maps fields correctly when units are present
  test('maps all fields correctly when units are present', async () => {
    const mock = makeMock('hub1', [
      makeCollection('col1', [
        makeDef({
          id: 'def-full',
          name: 'Density',
          specification: 'FLOAT',
          units: { id: 'u99', name: 'g/cm³' },
          isReadOnly: true,
        }),
      ]),
    ])

    const { result } = renderHook(
      () => useHubBasePropertyDefinitions('hub1'),
      { wrapper: makeWrapper([mock]) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    const def = result.current.definitions[0]
    expect(def.id).toBe('def-full')
    expect(def.name).toBe('Density')
    expect(def.specification).toBe('FLOAT')
    expect(def.units).toEqual({ id: 'u99', name: 'g/cm³' })
    expect(def.isReadOnly).toBe(true)
  })

  // 8b. Maps units to null when raw units field is null
  test('maps units to null when raw units field is null', async () => {
    const mock = makeMock('hub1', [
      makeCollection('col1', [
        makeDef({
          id: 'def-no-units',
          name: 'Flag',
          specification: null,
          units: null,
          isReadOnly: false,
        }),
      ]),
    ])

    const { result } = renderHook(
      () => useHubBasePropertyDefinitions('hub1'),
      { wrapper: makeWrapper([mock]) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    const def = result.current.definitions[0]
    expect(def.units).toBeNull()
    expect(def.specification).toBeNull()
  })

  // 9. Sorts alphabetically by name (case-insensitive)
  test('sorts definitions alphabetically by name (case-insensitive)', async () => {
    const mock = makeMock('hub1', [
      makeCollection('col1', [
        makeDef({ id: 'z', name: 'Zebra' }),
        makeDef({ id: 'a', name: 'apple' }),
        makeDef({ id: 'm', name: 'Mango' }),
      ]),
    ])

    const { result } = renderHook(
      () => useHubBasePropertyDefinitions('hub1'),
      { wrapper: makeWrapper([mock]) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    const names = result.current.definitions.map((d) => d.name)
    expect(names).toEqual(['apple', 'Mango', 'Zebra'])
  })

  // 10. Returns empty array on query error
  test('returns empty definitions array when the query errors', async () => {
    const errorMock = {
      request: {
        query: GET_HUB_BASE_PROPERTY_DEFINITIONS,
        variables: { hubId: 'hub-error' },
      },
      result: {
        errors: [new GraphQLError('Something went wrong')],
      },
    }

    const { result } = renderHook(
      () => useHubBasePropertyDefinitions('hub-error'),
      { wrapper: makeWrapper([errorMock]) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.definitions).toEqual([])
    expect(result.current.error).toBeDefined()
  })
})
