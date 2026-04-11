import { openDB } from 'idb'

const DB_NAME = 'fusion-demo-thumbnails'
const STORE_NAME = 'blobs'
const DB_VERSION = 1

export const THUMBNAIL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface ThumbnailCacheEntry {
  componentId: string
  blob: Blob
  cachedAt: number
}

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    db.createObjectStore(STORE_NAME, { keyPath: 'componentId' })
  },
})

export async function getThumbnailBlob(componentId: string): Promise<Blob | null> {
  const db = await dbPromise
  const entry = await db.get(STORE_NAME, componentId) as ThumbnailCacheEntry | undefined
  return entry?.blob ?? null
}

export async function setThumbnailBlob(componentId: string, blob: Blob): Promise<void> {
  const db = await dbPromise
  await db.put(STORE_NAME, { componentId, blob, cachedAt: Date.now() } satisfies ThumbnailCacheEntry)
}

export async function evictStaleEntries(maxAgeMs: number): Promise<void> {
  const db = await dbPromise
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const cutoff = Date.now() - maxAgeMs
  let cursor = await tx.store.openCursor()
  while (cursor) {
    if ((cursor.value as ThumbnailCacheEntry).cachedAt < cutoff) {
      await cursor.delete()
    }
    cursor = await cursor.continue()
  }
  await tx.done
}

export async function clearThumbnailCache(): Promise<void> {
  const db = await dbPromise
  await db.clear(STORE_NAME)
}
