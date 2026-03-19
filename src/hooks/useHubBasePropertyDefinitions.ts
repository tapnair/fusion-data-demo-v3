import { useQuery } from '@apollo/client/react'
import { useMemo } from 'react'
import { GET_HUB_BASE_PROPERTY_DEFINITIONS } from '../graphql/queries/baseProperties'

export interface PropertyDefinition {
  id: string
  name: string
  specification: string | null
  units: { id: string; name: string } | null
  isReadOnly: boolean | null
}

export function useHubBasePropertyDefinitions(hubId: string | null | undefined): {
  definitions: PropertyDefinition[]
  loading: boolean
  error: ReturnType<typeof useQuery>['error']
} {
  const { loading, error, data } = useQuery(GET_HUB_BASE_PROPERTY_DEFINITIONS, {
    variables: { hubId },
    skip: !hubId,
    fetchPolicy: 'cache-first',
  })

  const definitions = useMemo((): PropertyDefinition[] => {
    if (!data || error) return []
    const collections: any[] = (data as any)?.hub?.basePropertyDefinitionCollections?.results ?? []
    const all: PropertyDefinition[] = collections.flatMap((col: any) =>
      (col.definitions?.results ?? [])
        .filter((d: any) => !d.isHidden && !d.isArchived)
        .map((d: any): PropertyDefinition => ({
          id: d.id,
          name: d.name,
          specification: d.specification ?? null,
          units: d.units ? { id: d.units.id, name: d.units.name } : null,
          isReadOnly: d.isReadOnly ?? null,
        }))
    )
    return all.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [data, error])

  return { definitions, loading, error }
}
