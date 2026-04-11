import { pagedField } from './pagedField'

// Helpers to build the shape that Apollo stores internally.
// In the cache, each item is a reference object: { __ref: 'TypeName:id' }.
function ref(id: string) {
  return { __ref: id }
}

function makePage(
  refs: Array<{ __ref: string }>,
  opts?: { typename?: string; cursor?: string | null }
) {
  return {
    __typename: opts?.typename ?? 'HubsConnection',
    pagination: { cursor: opts?.cursor ?? null, pageSize: refs.length },
    results: refs,
  }
}

describe('pagedField()', () => {
  // Grab the merge and read functions from a default factory instance.
  const policy = pagedField()
  const { merge, read } = policy as Required<typeof policy>

  // ─── merge() ────────────────────────────────────────────────────────────────

  describe('merge()', () => {
    it('stores all results keyed by __ref when there is no existing data (first page)', () => {
      const incoming = makePage([ref('Hub:1'), ref('Hub:2')])
      const result = merge(undefined, incoming, {} as never)

      expect(result.results).toEqual({
        'Hub:1': ref('Hub:1'),
        'Hub:2': ref('Hub:2'),
      })
    })

    it('appends new items from a second page without duplicating existing items', () => {
      const firstPage = makePage([ref('Hub:1'), ref('Hub:2')])
      const existing = merge(undefined, firstPage, {} as never)

      const secondPage = makePage([ref('Hub:3'), ref('Hub:4')])
      const result = merge(existing, secondPage, {} as never)

      expect(result.results).toEqual({
        'Hub:1': ref('Hub:1'),
        'Hub:2': ref('Hub:2'),
        'Hub:3': ref('Hub:3'),
        'Hub:4': ref('Hub:4'),
      })
    })

    it('does not duplicate items when the same page is fetched twice (idempotent merge)', () => {
      const page = makePage([ref('Hub:1'), ref('Hub:2')])
      const afterFirst = merge(undefined, page, {} as never)
      const afterSecond = merge(afterFirst, page, {} as never)

      expect(Object.keys(afterSecond.results)).toHaveLength(2)
      expect(afterSecond.results).toEqual({
        'Hub:1': ref('Hub:1'),
        'Hub:2': ref('Hub:2'),
      })
    })

    it('replaces the existing pagination object with the incoming one', () => {
      const firstPage = makePage([ref('Hub:1')], { cursor: 'cursor-a' })
      const existing = merge(undefined, firstPage, {} as never)

      const secondPage = makePage([ref('Hub:2')], { cursor: 'cursor-b' })
      const result = merge(existing, secondPage, {} as never)

      expect(result.pagination).toEqual({ cursor: 'cursor-b', pageSize: 1 })
    })

    it('preserves __typename from the incoming object', () => {
      const incoming = makePage([ref('Hub:1')], { typename: 'HubsConnection' })
      const result = merge(undefined, incoming, {} as never)

      expect(result.__typename).toBe('HubsConnection')
    })

    it('updates __typename if a subsequent page carries a different __typename', () => {
      const first = makePage([ref('Hub:1')], { typename: 'HubsConnection' })
      const existing = merge(undefined, first, {} as never)

      const second = makePage([ref('Hub:2')], { typename: 'HubsConnectionV2' })
      const result = merge(existing, second, {} as never)

      expect(result.__typename).toBe('HubsConnectionV2')
    })

    it('handles an empty results array gracefully', () => {
      const incoming = makePage([])
      const result = merge(undefined, incoming, {} as never)

      expect(result.results).toEqual({})
      expect(result.pagination).toEqual({ cursor: null, pageSize: 0 })
    })
  })

  // ─── read() ─────────────────────────────────────────────────────────────────

  describe('read()', () => {
    it('returns undefined when existing is undefined (field not yet in cache)', () => {
      expect(read(undefined, {} as never)).toBeUndefined()
    })

    it('returns undefined when existing is null (Apollo convention)', () => {
      expect(read(null, {} as never)).toBeUndefined()
    })

    it('converts the stored ref-keyed object back to an array of refs', () => {
      const incoming = makePage([ref('Hub:1'), ref('Hub:2')])
      const stored = merge(undefined, incoming, {} as never)

      const result = read(stored, {} as never)

      expect(result).toBeDefined()
      expect(result!.results).toEqual(
        expect.arrayContaining([ref('Hub:1'), ref('Hub:2')])
      )
      expect(result!.results).toHaveLength(2)
    })

    it('preserves __typename in the read result', () => {
      const incoming = makePage([ref('Hub:1')], { typename: 'HubsConnection' })
      const stored = merge(undefined, incoming, {} as never)

      const result = read(stored, {} as never)
      expect(result!.__typename).toBe('HubsConnection')
    })

    it('returns pagination from the stored data', () => {
      const incoming = makePage([ref('Hub:1')], { cursor: 'abc' })
      const stored = merge(undefined, incoming, {} as never)

      const result = read(stored, {} as never)
      expect(result!.pagination).toEqual({ cursor: 'abc', pageSize: 1 })
    })

    it('returns null for pagination when stored pagination is undefined', () => {
      // Manually construct a stored object with no pagination to exercise
      // the `?? null` fallback in read().
      const stored = { __typename: 'HubsConnection', pagination: undefined, results: {} }
      const result = read(stored, {} as never)
      expect(result!.pagination).toBeNull()
    })

    it('reflects all merged pages in the array returned by read()', () => {
      const firstPage = makePage([ref('Hub:1'), ref('Hub:2')])
      let stored = merge(undefined, firstPage, {} as never)

      const secondPage = makePage([ref('Hub:3')])
      stored = merge(stored, secondPage, {} as never)

      const result = read(stored, {} as never)
      expect(result!.results).toHaveLength(3)
      expect(result!.results).toEqual(
        expect.arrayContaining([ref('Hub:1'), ref('Hub:2'), ref('Hub:3')])
      )
    })
  })

  // ─── pagedField() factory options ────────────────────────────────────────────

  describe('pagedField() factory', () => {
    it('defaults keyArgs to false', () => {
      const p = pagedField()
      expect(p.keyArgs).toBe(false)
    })

    it('accepts a custom keyArgs array', () => {
      const p = pagedField(['hubId'])
      expect(p.keyArgs).toEqual(['hubId'])
    })
  })
})
