import { renderHook, act } from '@testing-library/react'
import { QueryLogProvider, useQueryLog } from './QueryLogContext'
import type { QueryLogEntry } from './QueryLogContext'

function makeEntry(overrides: Partial<QueryLogEntry> = {}): QueryLogEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    operationName: 'TestQuery',
    operationType: 'query',
    isIntrospection: false,
    query: '{ __typename }',
    variables: {},
    response: null,
    errors: null,
    durationMs: 10,
    ...overrides,
  }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryLogProvider>{children}</QueryLogProvider>
)

describe('QueryLogProvider + useQueryLog', () => {
  it('initial state: entries is an empty array', () => {
    const { result } = renderHook(() => useQueryLog(), { wrapper })
    expect(result.current.entries).toEqual([])
  })

  it('addEntry adds an entry and it appears as the first element', () => {
    const { result } = renderHook(() => useQueryLog(), { wrapper })
    const entry = makeEntry({ operationName: 'MyQuery' })

    act(() => {
      result.current.addEntry(entry)
    })

    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0]).toEqual(entry)
  })

  it('addEntry called multiple times: entries are in newest-first order', () => {
    const { result } = renderHook(() => useQueryLog(), { wrapper })
    const first = makeEntry({ operationName: 'FirstQuery' })
    const second = makeEntry({ operationName: 'SecondQuery' })
    const third = makeEntry({ operationName: 'ThirdQuery' })

    act(() => {
      result.current.addEntry(first)
    })
    act(() => {
      result.current.addEntry(second)
    })
    act(() => {
      result.current.addEntry(third)
    })

    expect(result.current.entries).toHaveLength(3)
    expect(result.current.entries[0].operationName).toBe('ThirdQuery')
    expect(result.current.entries[1].operationName).toBe('SecondQuery')
    expect(result.current.entries[2].operationName).toBe('FirstQuery')
  })

  it('cap at 200: adding 201 entries results in exactly 200 entries (oldest dropped)', () => {
    const { result } = renderHook(() => useQueryLog(), { wrapper })

    act(() => {
      for (let i = 0; i < 201; i++) {
        result.current.addEntry(makeEntry({ operationName: `Query${i}` }))
      }
    })

    expect(result.current.entries).toHaveLength(200)
    // The oldest entry (Query0) should have been dropped; newest (Query200) is first
    expect(result.current.entries[0].operationName).toBe('Query200')
    expect(result.current.entries[199].operationName).toBe('Query1')
  })

  it('clearLog empties the entries array', () => {
    const { result } = renderHook(() => useQueryLog(), { wrapper })

    act(() => {
      result.current.addEntry(makeEntry())
      result.current.addEntry(makeEntry())
    })
    expect(result.current.entries).toHaveLength(2)

    act(() => {
      result.current.clearLog()
    })

    expect(result.current.entries).toEqual([])
  })

  it('addEntry after clearLog works correctly', () => {
    const { result } = renderHook(() => useQueryLog(), { wrapper })
    const beforeClear = makeEntry({ operationName: 'BeforeClear' })
    const afterClear = makeEntry({ operationName: 'AfterClear' })

    act(() => {
      result.current.addEntry(beforeClear)
    })
    act(() => {
      result.current.clearLog()
    })
    act(() => {
      result.current.addEntry(afterClear)
    })

    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].operationName).toBe('AfterClear')
  })
})
