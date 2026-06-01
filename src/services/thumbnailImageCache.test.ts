// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getThumbnailBlob,
  setThumbnailBlob,
  evictStaleEntries,
  clearThumbnailCache,
} from './thumbnailImageCache'

// The dbPromise singleton is created at module load time and reuses the same
// IndexedDB connection for the entire test run. Clearing the object store in
// beforeEach is sufficient to isolate each test.
beforeEach(async () => {
  await clearThumbnailCache()
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Pads to >=200 bytes so the blob passes getThumbnailBlob's size validation.
// The first chars carry the test-distinguishing content; the rest is filler.
function makeBlob(distinctContent = 'test image data'): Blob {
  const padding = 'x'.repeat(Math.max(0, 250 - distinctContent.length))
  return new Blob([distinctContent + padding], { type: 'image/png' })
}

/**
 * fake-indexeddb v6 serializes stored values (structured clone), so the Blob
 * returned by getThumbnailBlob is a new object. We compare by reading the text
 * content rather than by reference equality.
 */
async function blobText(blob: Blob): Promise<string> {
  return blob.text()
}

// Only fake Date.now() / new Date() — do NOT fake setTimeout/Promise scheduling
// because fake-indexeddb's async internals depend on real microtask/timer queues.
function useFakeDate(ms: number) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(ms)
}

// ---------------------------------------------------------------------------
// getThumbnailBlob
// ---------------------------------------------------------------------------

describe('getThumbnailBlob', () => {
  it('returns null when no entry exists for the given componentId', async () => {
    const result = await getThumbnailBlob('nonexistent-id')
    expect(result).toBeNull()
  })

  it('returns the blob after setThumbnailBlob has stored it', async () => {
    const blob = makeBlob()
    await setThumbnailBlob('comp-1', blob)

    const result = await getThumbnailBlob('comp-1')
    expect(result).not.toBeNull()
    expect(result).toBeInstanceOf(Blob)
    expect(await blobText(result!)).toBe(await blobText(blob))
  })

  it('rejects (and deletes) a tiny blob from a previously-cached bad response', async () => {
    const tinyBlob = new Blob(['oops'], { type: 'image/png' })
    await setThumbnailBlob('comp-bad', tinyBlob)
    const result = await getThumbnailBlob('comp-bad')
    expect(result).toBeNull()
    // confirm the bad entry was evicted (a second get should still return null)
    const result2 = await getThumbnailBlob('comp-bad')
    expect(result2).toBeNull()
  })

  it('rejects (and deletes) a blob whose MIME type is not image/*', async () => {
    const htmlBlob = new Blob(['x'.repeat(500)], { type: 'text/html' })
    await setThumbnailBlob('comp-html', htmlBlob)
    const result = await getThumbnailBlob('comp-html')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// setThumbnailBlob
// ---------------------------------------------------------------------------

describe('setThumbnailBlob', () => {
  it('stores a blob retrievable by getThumbnailBlob', async () => {
    const blob = makeBlob()
    await setThumbnailBlob('comp-store', blob)

    const result = await getThumbnailBlob('comp-store')
    expect(result).toBeInstanceOf(Blob)
    expect(await blobText(result!)).toBe(await blobText(blob))
  })

  it('overwrites an existing entry for the same componentId', async () => {
    const firstBlob = makeBlob('first')
    const secondBlob = makeBlob('second')

    await setThumbnailBlob('comp-overwrite', firstBlob)
    await setThumbnailBlob('comp-overwrite', secondBlob)

    const result = await getThumbnailBlob('comp-overwrite')
    expect(result).toBeInstanceOf(Blob)
    expect(await blobText(result!)).toBe(await blobText(secondBlob))
    expect(await blobText(result!)).not.toBe(await blobText(firstBlob))
  })
})

// ---------------------------------------------------------------------------
// evictStaleEntries
// ---------------------------------------------------------------------------

describe('evictStaleEntries', () => {
  it('does not remove entries newer than the TTL', async () => {
    // Store at t=0, then evict at t=1h with a 2h TTL → entry is fresh
    useFakeDate(0)
    const blob = makeBlob()
    await setThumbnailBlob('comp-fresh', blob)

    vi.setSystemTime(1 * 60 * 60 * 1000)
    await evictStaleEntries(2 * 60 * 60 * 1000)
    vi.useRealTimers()

    const result = await getThumbnailBlob('comp-fresh')
    expect(result).toBeInstanceOf(Blob)
    expect(await blobText(result!)).toBe(await blobText(blob))
  })

  it('removes entries older than the TTL', async () => {
    // Store at t=0, then evict at t=2h with a 1h TTL → entry is stale
    useFakeDate(0)
    const blob = makeBlob()
    await setThumbnailBlob('comp-stale', blob)

    vi.setSystemTime(2 * 60 * 60 * 1000)
    await evictStaleEntries(1 * 60 * 60 * 1000)
    vi.useRealTimers()

    const result = await getThumbnailBlob('comp-stale')
    expect(result).toBeNull()
  })

  it('does not remove an entry exactly at the TTL boundary', async () => {
    // Entry stored at storedAt. Evict at storedAt + maxAgeMs with maxAgeMs.
    // cutoff = now - maxAgeMs = storedAt exactly.
    // The source uses strict `<`, so cachedAt === cutoff survives.
    const storedAt = 1_000_000
    const maxAgeMs = 500

    useFakeDate(storedAt)
    const blob = makeBlob()
    await setThumbnailBlob('comp-boundary', blob)

    vi.setSystemTime(storedAt + maxAgeMs)
    await evictStaleEntries(maxAgeMs)
    vi.useRealTimers()

    const result = await getThumbnailBlob('comp-boundary')
    expect(result).toBeInstanceOf(Blob)
    expect(await blobText(result!)).toBe(await blobText(blob))
  })

  it('leaves non-stale entries intact when some entries are stale', async () => {
    // At t=0: store stale entry
    // At t=90min: store fresh entry
    // At t=2h: evict with 1h TTL → cutoff=1h → stale gone, fresh kept
    useFakeDate(0)
    const staleBlob = makeBlob('stale')
    await setThumbnailBlob('comp-will-be-stale', staleBlob)

    vi.setSystemTime(90 * 60 * 1000)
    const freshBlob = makeBlob('fresh')
    await setThumbnailBlob('comp-will-be-fresh', freshBlob)

    vi.setSystemTime(2 * 60 * 60 * 1000)
    await evictStaleEntries(1 * 60 * 60 * 1000)
    vi.useRealTimers()

    expect(await getThumbnailBlob('comp-will-be-stale')).toBeNull()

    const freshResult = await getThumbnailBlob('comp-will-be-fresh')
    expect(freshResult).toBeInstanceOf(Blob)
    expect(await blobText(freshResult!)).toBe(await blobText(freshBlob))
  })
})

// ---------------------------------------------------------------------------
// clearThumbnailCache
// ---------------------------------------------------------------------------

describe('clearThumbnailCache', () => {
  it('causes getThumbnailBlob to return null for previously stored blobs', async () => {
    await setThumbnailBlob('comp-a', makeBlob('one'))
    await setThumbnailBlob('comp-b', makeBlob('two'))

    await clearThumbnailCache()

    expect(await getThumbnailBlob('comp-a')).toBeNull()
    expect(await getThumbnailBlob('comp-b')).toBeNull()
  })
})
