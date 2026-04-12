import React from 'react'
import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing/react'
import { useBomBaseProperties } from './useBomBaseProperties'
import {
  GET_ROOT_COMPONENT_BASE_PROPERTIES,
  GET_COMPONENT_BASE_PROPERTIES,
} from '../graphql/queries/baseProperties'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BasePropResult {
  definition: { id: string } | null
  displayValue: string | null
  value: unknown
}

interface MockedResponse {
  request: {
    query: typeof GET_ROOT_COMPONENT_BASE_PROPERTIES | typeof GET_COMPONENT_BASE_PROPERTIES
    variables: Record<string, string>
  }
  result: {
    data: {
      component: {
        id: string
        baseProperties: {
          results: BasePropResult[]
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper(mocks: MockedResponse[]) {
  return function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MockedProvider mocks={mocks} addTypename={false}>
        {children}
      </MockedProvider>
    )
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useBomBaseProperties', () => {
  test('loading state — while query is in-flight, loading is true and valueMap is {}', () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_ROOT_COMPONENT_BASE_PROPERTIES,
          variables: { componentId: 'comp1' },
        },
        result: {
          data: {
            component: {
              id: 'comp1',
              baseProperties: { results: [] },
            },
          },
        },
      },
    ]

    const { result } = renderHook(
      () => useBomBaseProperties('comp1', null),
      { wrapper: makeWrapper(mocks) },
    )

    // Before the mock resolves the hook is in the loading state.
    expect(result.current.loading).toBe(true)
    expect(result.current.valueMap).toEqual({})
  })

  test('root component (componentState=null) uses GET_ROOT_COMPONENT_BASE_PROPERTIES', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_ROOT_COMPONENT_BASE_PROPERTIES,
          variables: { componentId: 'comp1' },
        },
        result: {
          data: {
            component: {
              id: 'comp1',
              baseProperties: { results: [] },
            },
          },
        },
      },
    ]

    const { result } = renderHook(
      () => useBomBaseProperties('comp1', null),
      { wrapper: makeWrapper(mocks) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeUndefined()
    expect(result.current.valueMap).toEqual({})
  })

  test('child component (componentState="ACTIVE") uses GET_COMPONENT_BASE_PROPERTIES', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_COMPONENT_BASE_PROPERTIES,
          variables: { componentId: 'comp1', state: 'ACTIVE' },
        },
        result: {
          data: {
            component: {
              id: 'comp1',
              baseProperties: { results: [] },
            },
          },
        },
      },
    ]

    const { result } = renderHook(
      () => useBomBaseProperties('comp1', 'ACTIVE'),
      { wrapper: makeWrapper(mocks) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeUndefined()
    expect(result.current.valueMap).toEqual({})
  })

  test('valueMap is built from displayValue when present', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_ROOT_COMPONENT_BASE_PROPERTIES,
          variables: { componentId: 'comp1' },
        },
        result: {
          data: {
            component: {
              id: 'comp1',
              baseProperties: {
                results: [
                  { definition: { id: 'def1' }, displayValue: '42 mm', value: null },
                ],
              },
            },
          },
        },
      },
    ]

    const { result } = renderHook(
      () => useBomBaseProperties('comp1', null),
      { wrapper: makeWrapper(mocks) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.valueMap).toEqual({ def1: '42 mm' })
  })

  test('valueMap falls back to String(value) when displayValue is null', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_ROOT_COMPONENT_BASE_PROPERTIES,
          variables: { componentId: 'comp1' },
        },
        result: {
          data: {
            component: {
              id: 'comp1',
              baseProperties: {
                results: [
                  { definition: { id: 'def2' }, displayValue: null, value: 123 },
                ],
              },
            },
          },
        },
      },
    ]

    const { result } = renderHook(
      () => useBomBaseProperties('comp1', null),
      { wrapper: makeWrapper(mocks) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.valueMap).toEqual({ def2: '123' })
  })

  test('multiple props build the full map', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_ROOT_COMPONENT_BASE_PROPERTIES,
          variables: { componentId: 'comp1' },
        },
        result: {
          data: {
            component: {
              id: 'comp1',
              baseProperties: {
                results: [
                  { definition: { id: 'defA' }, displayValue: 'alpha', value: null },
                  { definition: { id: 'defB' }, displayValue: null, value: 99 },
                ],
              },
            },
          },
        },
      },
    ]

    const { result } = renderHook(
      () => useBomBaseProperties('comp1', null),
      { wrapper: makeWrapper(mocks) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.valueMap).toEqual({ defA: 'alpha', defB: '99' })
  })

  test('entries without definition.id are skipped', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_ROOT_COMPONENT_BASE_PROPERTIES,
          variables: { componentId: 'comp1' },
        },
        result: {
          data: {
            component: {
              id: 'comp1',
              baseProperties: {
                results: [
                  { definition: null, displayValue: 'x', value: null },
                  { definition: { id: 'def3' }, displayValue: 'y', value: null },
                ],
              },
            },
          },
        },
      },
    ]

    const { result } = renderHook(
      () => useBomBaseProperties('comp1', null),
      { wrapper: makeWrapper(mocks) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.valueMap).toEqual({ def3: 'y' })
  })

  test('empty results → empty valueMap', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_ROOT_COMPONENT_BASE_PROPERTIES,
          variables: { componentId: 'comp1' },
        },
        result: {
          data: {
            component: {
              id: 'comp1',
              baseProperties: { results: [] },
            },
          },
        },
      },
    ]

    const { result } = renderHook(
      () => useBomBaseProperties('comp1', null),
      { wrapper: makeWrapper(mocks) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.valueMap).toEqual({})
  })
})
