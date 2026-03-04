import type { FieldPolicy } from '@apollo/client/core'

/**
 * Field policy for any Manufacturing Data Model v3 list field.
 *
 * All list fields return { results: T[], pagination: { cursor, pageSize } }.
 * Results are stored internally as a ref-keyed object to ensure idempotent
 * merging — re-fetching the same page never produces duplicates.
 * The read() function converts back to the array shape consumers expect.
 *
 * Workaround for Apollo issue #9315: items are keyed by __ref rather than
 * readField('id', item) since readField is unavailable in some merge contexts.
 *
 * @param keyArgs - Args that partition cache entries by parent entity.
 *                  Pagination args (cursor, limit) must NOT be included.
 */
export function pagedField(keyArgs: string[] | false = false): FieldPolicy {
  return {
    keyArgs,
    merge(existing, incoming) {
      const mergedResults = existing ? { ...existing.results } : {}
      incoming?.results?.forEach((item: any) => {
        mergedResults[item.__ref] = item
      })
      return {
        __typename: incoming?.__typename,
        pagination: incoming?.pagination,
        results: mergedResults,
      }
    },
    read(existing) {
      if (existing) {
        return {
          __typename: existing.__typename,
          pagination: existing.pagination ?? null,
          results: Object.values(existing.results),
        }
      }
    },
  }
}
