import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type SearchMode = 'freetext' | 'property'

interface SearchContextValue {
  isOpen: boolean
  openSearch: () => void
  closeSearch: () => void
  mode: SearchMode
  setMode: (m: SearchMode) => void
  query: string
  setQuery: (q: string) => void
  selectedPropertyId: string | null
  setSelectedPropertyId: (id: string | null) => void
  propertyQueryValues: string
  setPropertyQueryValues: (v: string) => void
  /** Active type filters — empty means "all types" */
  activeTypeFilters: string[]
  setActiveTypeFilters: (types: string[]) => void
}

export const SearchContext = createContext<SearchContextValue | undefined>(undefined)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<SearchMode>('freetext')
  const [query, setQuery] = useState('')
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [propertyQueryValues, setPropertyQueryValues] = useState('')
  const [activeTypeFilters, setActiveTypeFilters] = useState<string[]>([])

  const openSearch = useCallback(() => setIsOpen(true), [])

  const closeSearch = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setSelectedPropertyId(null)
    setPropertyQueryValues('')
  }, [])

  return (
    <SearchContext.Provider
      value={{
        isOpen,
        openSearch,
        closeSearch,
        mode,
        setMode,
        query,
        setQuery,
        selectedPropertyId,
        setSelectedPropertyId,
        propertyQueryValues,
        setPropertyQueryValues,
        activeTypeFilters,
        setActiveTypeFilters,
      }}
    >
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useSearch must be used within SearchProvider')
  return ctx
}
