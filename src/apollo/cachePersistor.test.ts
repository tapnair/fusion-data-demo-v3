import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { InMemoryCache } from '@apollo/client/core'
import { createCachePersistor } from './cachePersistor'

const STORAGE_KEY = 'fusion-demo-apollo-cache'
const identity = async (d: string) => d

// ---------------------------------------------------------------------------
// localStorage stub — avoids jsdom's quota-less Storage bleeding between tests
// ---------------------------------------------------------------------------
function makeLocalStorageMock() {
  const store: Record<string, string> = {}
  return {
    store,
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
  }
}

describe('createCachePersistor', () => {
  let cache: InMemoryCache
  let ls: ReturnType<typeof makeLocalStorageMock>

  beforeEach(() => {
    cache = new InMemoryCache()
    ls = makeLocalStorageMock()
    vi.stubGlobal('localStorage', ls)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // ── restore ───────────────────────────────────────────────────────────────

  test('restore() calls cache.restore() with parsed localStorage data', async () => {
    const data = { ROOT_QUERY: { __typename: 'Query', 'hubs({})': { __ref: 'HubConnection:{}' } } }
    ls.store[STORAGE_KEY] = JSON.stringify(data)

    const spy = vi.spyOn(cache, 'restore')
    const persistor = createCachePersistor(cache, identity)

    await persistor.restore()

    expect(spy).toHaveBeenCalledWith(data)
  })

  test('restore() is a no-op when localStorage has no entry', async () => {
    const spy = vi.spyOn(cache, 'restore')
    const persistor = createCachePersistor(cache, identity)

    await persistor.restore()

    expect(spy).not.toHaveBeenCalled()
  })

  test('restore() removes corrupted entry and does not throw', async () => {
    ls.store[STORAGE_KEY] = 'not valid json {'
    const persistor = createCachePersistor(cache, identity)

    await expect(persistor.restore()).resolves.toBeUndefined()
    expect(ls.store[STORAGE_KEY]).toBeUndefined()
  })

  // ── purge ─────────────────────────────────────────────────────────────────

  test('purge() removes the localStorage entry', async () => {
    ls.store[STORAGE_KEY] = '{"some":"data"}'
    const persistor = createCachePersistor(cache, identity)

    await persistor.purge()

    expect(ls.store[STORAGE_KEY]).toBeUndefined()
    expect(ls.removeItem).toHaveBeenCalledWith(STORAGE_KEY)
  })

  test('purge() cancels a pending debounced write', async () => {
    const persistor = createCachePersistor(cache, identity)
    ;(cache as any).broadcastWatches()   // schedule a write

    await persistor.purge()              // should cancel it
    await vi.runAllTimersAsync()         // let the timer fire if it wasn't cancelled

    // Only the purge's removeItem call, no setItem
    expect(ls.setItem).not.toHaveBeenCalled()
  })

  // ── broadcastWatches interception + debounce ───────────────────────────────

  test('broadcastWatches triggers a persist after the debounce delay', async () => {
    createCachePersistor(cache, identity)

    ;(cache as any).broadcastWatches()

    expect(ls.setItem).not.toHaveBeenCalled()          // not yet

    await vi.advanceTimersByTimeAsync(1_000)

    expect(ls.setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String))
  })

  test('multiple rapid broadcastWatches calls result in exactly one write', async () => {
    createCachePersistor(cache, identity)

    ;(cache as any).broadcastWatches()
    ;(cache as any).broadcastWatches()
    ;(cache as any).broadcastWatches()

    await vi.advanceTimersByTimeAsync(1_000)

    expect(ls.setItem).toHaveBeenCalledTimes(1)
  })

  test('original broadcastWatches is still called', () => {
    const orig = (cache as any).broadcastWatches
    const origSpy = vi.fn(orig.bind(cache))
    ;(cache as any).broadcastWatches = origSpy     // pre-spy before createCachePersistor wraps it

    // Re-create to wrap the spy
    const cache2 = new InMemoryCache()
    const spy2 = vi.fn()
    ;(cache2 as any).broadcastWatches = spy2

    createCachePersistor(cache2, identity)
    ;(cache2 as any).broadcastWatches()

    expect(spy2).toHaveBeenCalledTimes(1)   // original called once through the wrapper
  })

  // ── persistenceMapper ─────────────────────────────────────────────────────

  test('persistenceMapper is applied before writing to localStorage', async () => {
    // Mapper that uppercases everything (detectable transformation)
    const mapper = async (data: string) => data.toUpperCase()
    createCachePersistor(cache, mapper)

    ;(cache as any).broadcastWatches()
    await vi.advanceTimersByTimeAsync(1_000)

    const stored = ls.store[STORAGE_KEY]
    expect(stored).toBeDefined()
    expect(stored).toBe(stored!.toUpperCase())
  })

  test('Thumbnail keys are excluded when using the real app mapper', async () => {
    const appMapper = async (data: string) => {
      const parsed = JSON.parse(data)
      const filtered = Object.fromEntries(
        Object.entries(parsed).filter(([key]) => !key.startsWith('Thumbnail:'))
      )
      return JSON.stringify(filtered)
    }

    createCachePersistor(cache, appMapper)

    // Manually write a Thumbnail entry into the cache store to simulate real data
    ;(cache as any).data.data['Thumbnail:comp1'] = { __typename: 'Thumbnail', signedUrl: 'https://example.com/img' }
    ;(cache as any).data.data['Project:proj1'] = { __typename: 'Project', id: 'proj1' }

    ;(cache as any).broadcastWatches()
    await vi.advanceTimersByTimeAsync(1_000)

    const stored = JSON.parse(ls.store[STORAGE_KEY] ?? '{}')
    expect(Object.keys(stored)).not.toContain('Thumbnail:comp1')
    expect(Object.keys(stored)).toContain('Project:proj1')
  })

  // ── size cap ──────────────────────────────────────────────────────────────

  test('skips localStorage write when mapped data exceeds 5 MB', async () => {
    // Mapper that inflates output beyond the 5 MB cap
    const bigMapper = async () => 'x'.repeat(5_242_881)
    createCachePersistor(cache, bigMapper)

    ;(cache as any).broadcastWatches()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(ls.setItem).not.toHaveBeenCalled()
  })

  test('writes to localStorage when mapped data is exactly at the 5 MB limit', async () => {
    const atLimitMapper = async () => 'x'.repeat(5_242_880)
    createCachePersistor(cache, atLimitMapper)

    ;(cache as any).broadcastWatches()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(ls.setItem).toHaveBeenCalled()
  })
})
