import { useQuery } from '@apollo/client/react'
import { useMemo } from 'react'
import { GET_SEARCHABLE_PROPERTIES } from '../graphql/queries/search'

export interface SearchableProperty {
  /** The property definition ID — use this as the searchableProperty ID in PropertyNameValuePair */
  id: string
  displayName: string
  propertyOrder: number
  propertyDefinition: {
    id: string
    name: string
    specification: string | null
    units: { name: string } | null
  }
}

export function useSearchableProperties(hubId: string | null) {
  const { data, loading, error } = useQuery(GET_SEARCHABLE_PROPERTIES, {
    variables: { hubId, pagination: { limit: 200 } },
    skip: !hubId,
    fetchPolicy: 'cache-first',
  })

  const properties = useMemo((): SearchableProperty[] => {
    const results: any[] = (data as any)?.searchablePropertiesByHub?.results ?? []
    return results
      .map((r: any): SearchableProperty => ({
        id: r.propertyDefinition.id,
        displayName: r.displayName,
        propertyOrder: r.propertyOrder,
        propertyDefinition: {
          id: r.propertyDefinition.id,
          name: r.propertyDefinition.name,
          specification: r.propertyDefinition.specification ?? null,
          units: r.propertyDefinition.units ? { name: r.propertyDefinition.units.name } : null,
        },
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [data])

  return { properties, loading, error }
}
