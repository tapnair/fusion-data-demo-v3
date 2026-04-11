import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useBomThumbnail, WORKING_STATES } from './useBomThumbnail'

vi.mock('@apollo/client/react', () => ({
  useQuery: vi.fn(),
}))

import { useQuery } from '@apollo/client/react'

const mockUseQuery = useQuery as ReturnType<typeof vi.fn>

// Helper to build a mock useQuery return value
function mockQueryReturn(overrides: Record<string, unknown> = {}) {
  return {
    loading: false,
    error: undefined,
    data: undefined,
    refetch: vi.fn(),
    ...overrides,
  }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)

beforeEach(() => {
  mockUseQuery.mockReset()
})

describe('useBomThumbnail', () => {
  describe('pollInterval state machine', () => {
    it('when data is null/undefined: pollInterval stays 0 (no polling started)', () => {
      mockUseQuery.mockReturnValue(mockQueryReturn({ data: undefined }))

      renderHook(() => useBomThumbnail('comp-1', 'active'), { wrapper })

      // The hook passes pollInterval as an option to useQuery.
      // With no data the effect never calls setPollInterval, so pollInterval
      // remains 0. We verify the last call to useQuery had pollInterval: 0.
      const lastCall = mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1]
      expect(lastCall[1]).toMatchObject({ pollInterval: 0 })
    })

    it.each(WORKING_STATES)(
      'when thumbnail status is "%s" (WORKING state): pollInterval is set to 10000–30000',
      async (status) => {
        const refetch = vi.fn()

        // First render: no data yet → pollInterval stays 0
        mockUseQuery.mockReturnValue(mockQueryReturn({ data: undefined, refetch }))
        const { rerender } = renderHook(
          () => useBomThumbnail('comp-1', 'active'),
          { wrapper },
        )

        // Second render: data arrives with a WORKING status
        mockUseQuery.mockReturnValue(
          mockQueryReturn({
            data: { component: { thumbnail: { status, signedUrl: null } } },
            refetch,
          }),
        )

        await act(async () => {
          rerender()
        })

        // After the effect fires, the hook calls useQuery again with the new
        // pollInterval. Grab the last invocation's options.
        const calls = mockUseQuery.mock.calls
        const lastOptions = calls[calls.length - 1][1] as { pollInterval: number }
        expect(lastOptions.pollInterval).toBeGreaterThanOrEqual(10_000)
        expect(lastOptions.pollInterval).toBeLessThanOrEqual(30_000)
      },
    )

    it.each(['SUCCESS', 'FAILED', 'ERROR'])(
      'when thumbnail status is "%s" (terminal state): pollInterval is 0',
      async (status) => {
        const refetch = vi.fn()

        mockUseQuery.mockReturnValue(mockQueryReturn({ data: undefined, refetch }))
        const { rerender } = renderHook(
          () => useBomThumbnail('comp-1', 'active'),
          { wrapper },
        )

        mockUseQuery.mockReturnValue(
          mockQueryReturn({
            data: { component: { thumbnail: { status, signedUrl: 'https://example.com/thumb.png' } } },
            refetch,
          }),
        )

        await act(async () => {
          rerender()
        })

        const calls = mockUseQuery.mock.calls
        const lastOptions = calls[calls.length - 1][1] as { pollInterval: number }
        expect(lastOptions.pollInterval).toBe(0)
      },
    )
  })

  describe('return values', () => {
    it('correctly extracts loading, error, status, and signedUrl from query data', () => {
      const mockError = new Error('network failure')
      mockUseQuery.mockReturnValue(
        mockQueryReturn({
          loading: true,
          error: mockError,
          data: {
            component: {
              thumbnail: { status: 'SUCCESS', signedUrl: 'https://example.com/thumb.png' },
            },
          },
        }),
      )

      const { result } = renderHook(
        () => useBomThumbnail('comp-1', 'active'),
        { wrapper },
      )

      expect(result.current.loading).toBe(true)
      expect(result.current.error).toBe(mockError)
      expect(result.current.status).toBe('SUCCESS')
      expect(result.current.signedUrl).toBe('https://example.com/thumb.png')
    })

    it('returns null status and signedUrl when thumbnail data is absent', () => {
      mockUseQuery.mockReturnValue(mockQueryReturn({ data: undefined }))

      const { result } = renderHook(
        () => useBomThumbnail('comp-1', 'active'),
        { wrapper },
      )

      expect(result.current.status).toBeNull()
      expect(result.current.signedUrl).toBeNull()
    })
  })

  describe('thumbnailGeneration refetch', () => {
    it('when thumbnailGeneration is bumped from 0 to 1, refetch is called', async () => {
      const refetch = vi.fn()
      mockUseQuery.mockReturnValue(
        mockQueryReturn({
          data: { component: { thumbnail: { status: 'SUCCESS', signedUrl: 'https://example.com/thumb.png' } } },
          refetch,
        }),
      )

      const { rerender } = renderHook(
        ({ gen }: { gen: number }) => useBomThumbnail('comp-1', 'active', gen),
        { wrapper, initialProps: { gen: 0 } },
      )

      expect(refetch).not.toHaveBeenCalled()

      await act(async () => {
        rerender({ gen: 1 })
      })

      expect(refetch).toHaveBeenCalledTimes(1)
    })

    it('when thumbnailGeneration stays 0, refetch is not called', async () => {
      const refetch = vi.fn()
      mockUseQuery.mockReturnValue(
        mockQueryReturn({
          data: { component: { thumbnail: { status: 'SUCCESS', signedUrl: 'https://example.com/thumb.png' } } },
          refetch,
        }),
      )

      const { rerender } = renderHook(
        ({ gen }: { gen: number }) => useBomThumbnail('comp-1', 'active', gen),
        { wrapper, initialProps: { gen: 0 } },
      )

      await act(async () => {
        rerender({ gen: 0 })
      })

      expect(refetch).not.toHaveBeenCalled()
    })
  })
})
