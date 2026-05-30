import React from 'react'
import { describe, test, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing/react'
import { useViewerComponent } from './useViewerComponent'
import { GET_VIEWER_COMPONENT } from '../graphql/queries/viewerComponent'

interface MockedResponse {
  request: {
    query: typeof GET_VIEWER_COMPONENT
    variables: Record<string, string>
  }
  result?: {
    data: {
      model: {
        id: string
        component: {
          id: string
          name: { displayValue: string | null } | null
          partNumber: { displayValue: string | null } | null
          description: { displayValue: string | null } | null
          materialName: { displayValue: string | null } | null
        } | null
      } | null
    }
  }
  error?: Error
}

function makeWrapper(mocks: MockedResponse[]) {
  return function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MockedProvider mocks={mocks} addTypename={false}>
        {children}
      </MockedProvider>
    )
  }
}

describe('useViewerComponent', () => {
  test('returns the mapped row when the query succeeds', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_VIEWER_COMPONENT,
          variables: { modelId: 'model-1' },
        },
        result: {
          data: {
            model: {
              id: 'model-1',
              component: {
                id: 'comp-1',
                name: { displayValue: 'Widget' },
                partNumber: { displayValue: 'P-001' },
                description: { displayValue: 'A widget' },
                materialName: { displayValue: 'Steel' },
              },
            },
          },
        },
      },
    ]

    const { result } = renderHook(
      () => useViewerComponent('model-1'),
      { wrapper: makeWrapper(mocks) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.row).toEqual({
      id: 'comp-1',
      componentId: 'comp-1',
      componentState: null,
      name: 'Widget',
      partNumber: 'P-001',
      description: 'A widget',
      materialName: 'Steel',
    })
  })

  test('returns row: null when modelId is null and skips the query', async () => {
    // No mocks provided — if the hook tried to fire the query, Apollo would
    // produce a "no more mocked responses" error which would surface as
    // result.current.error. We assert the hook stays in a clean idle state.
    const { result } = renderHook(
      () => useViewerComponent(null),
      { wrapper: makeWrapper([]) },
    )

    expect(result.current.loading).toBe(false)
    expect(result.current.row).toBeNull()
    expect(result.current.error).toBeNull()

    // Give Apollo a tick — confirm the state hasn't changed (no query fired).
    await new Promise((r) => setTimeout(r, 10))
    expect(result.current.loading).toBe(false)
    expect(result.current.row).toBeNull()
    expect(result.current.error).toBeNull()
  })

  test('returns error string when the query errors', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_VIEWER_COMPONENT,
          variables: { modelId: 'model-err' },
        },
        error: new Error('Network broke'),
      },
    ]

    const { result } = renderHook(
      () => useViewerComponent('model-err'),
      { wrapper: makeWrapper(mocks) },
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.error).toBe('Network broke')
    expect(result.current.row).toBeNull()
  })
})
