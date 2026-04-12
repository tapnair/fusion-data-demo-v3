/**
 * Minimal Apollo cache persistor — replaces apollo3-cache-persist.
 *
 * apollo3-cache-persist declared a peer dep on @apollo/client ^3, which
 * conflicts with our @apollo/client ^4 and required --legacy-peer-deps in CI.
 * This module provides the same restore / purge surface area with zero extra
 * dependencies.
 *
 * Persistence strategy: intercept InMemoryCache.broadcastWatches (the internal
 * method Apollo calls after every write) and debounce a localStorage write.
 * This is the same approach apollo3-cache-persist uses internally.
 */

import type { InMemoryCache, NormalizedCacheObject } from '@apollo/client/core'

const STORAGE_KEY = 'fusion-demo-apollo-cache'
const MAX_SIZE_BYTES = 5_242_880  // 5 MB — skip write if serialised cache exceeds this
const DEBOUNCE_MS = 1_000

export interface CachePersistorLike {
  restore(): Promise<void>
  purge(): Promise<void>
}

export function createCachePersistor(
  cache: InMemoryCache,
  persistenceMapper: (data: string) => Promise<string>,
): CachePersistorLike {
  let timer: ReturnType<typeof setTimeout> | null = null

  const persist = async () => {
    try {
      const raw = JSON.stringify(cache.extract())
      const mapped = await persistenceMapper(raw)
      if (mapped.length <= MAX_SIZE_BYTES) {
        localStorage.setItem(STORAGE_KEY, mapped)
      }
    } catch {
      // Storage quota exceeded or serialisation error — skip silently
    }
  }

  const schedulePersist = () => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(persist, DEBOUNCE_MS)
  }

  // Intercept broadcastWatches so we're notified after every cache write.
  const cacheAny = cache as any
  const originalBroadcast = cacheAny.broadcastWatches.bind(cache)
  cacheAny.broadcastWatches = function (...args: unknown[]) {
    originalBroadcast(...args)
    schedulePersist()
  }

  return {
    async restore() {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      try {
        cache.restore(JSON.parse(stored) as NormalizedCacheObject)
      } catch {
        // Corrupted data — purge so the next write starts clean
        localStorage.removeItem(STORAGE_KEY)
      }
    },
    async purge() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      localStorage.removeItem(STORAGE_KEY)
    },
  }
}
