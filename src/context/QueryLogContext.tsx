import { createContext, useCallback, useContext, useState } from 'react'

export interface QueryLogEntry {
  id: string
  timestamp: Date
  operationName: string
  operationType: string            // 'query' | 'mutation' | 'subscription'
  isIntrospection: boolean         // true when operationName === 'IntrospectionQuery'
  query: string                    // human-readable GQL string from print()
  variables: Record<string, unknown>
  response: unknown
  errors: unknown[] | null
  durationMs: number
}

interface QueryLogContextValue {
  entries: QueryLogEntry[]
  addEntry: (entry: QueryLogEntry) => void
  clearLog: () => void
}

const QueryLogContext = createContext<QueryLogContextValue>({
  entries: [],
  addEntry: () => {},
  clearLog: () => {},
})

export function QueryLogProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<QueryLogEntry[]>([])

  const addEntry = useCallback((entry: QueryLogEntry) => {
    setEntries(prev => [entry, ...prev].slice(0, 200))
  }, [])

  const clearLog = useCallback(() => setEntries([]), [])

  return (
    <QueryLogContext.Provider value={{ entries, addEntry, clearLog }}>
      {children}
    </QueryLogContext.Provider>
  )
}

export const useQueryLog = () => useContext(QueryLogContext)
