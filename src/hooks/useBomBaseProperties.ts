import { useQuery } from '@apollo/client/react'
import { useMemo } from 'react'
import {
  GET_ROOT_COMPONENT_BASE_PROPERTIES,
  GET_COMPONENT_BASE_PROPERTIES,
} from '../graphql/queries/baseProperties'

export function useBomBaseProperties(
  componentId: string,
  componentState: string | null
): {
  loading: boolean
  error: ReturnType<typeof useQuery>['error']
  valueMap: Record<string, string | null>
} {
  const isRoot = componentState === null

  const { loading, error, data } = useQuery(
    isRoot ? GET_ROOT_COMPONENT_BASE_PROPERTIES : GET_COMPONENT_BASE_PROPERTIES,
    {
      variables: isRoot
        ? { componentId }
        : { componentId, state: componentState },
      fetchPolicy: 'cache-first',
    }
  )

  const valueMap = useMemo((): Record<string, string | null> => {
    const results: any[] = (data as any)?.component?.baseProperties?.results ?? []
    const map: Record<string, string | null> = {}
    for (const prop of results) {
      const defId: string | undefined = prop.definition?.id
      if (!defId) continue
      let display: string | null = prop.displayValue ?? null
      if (display === null && prop.value !== null && prop.value !== undefined) {
        display = String(prop.value)
      }
      map[defId] = display
    }
    return map
  }, [data])

  return { loading, error, valueMap }
}
