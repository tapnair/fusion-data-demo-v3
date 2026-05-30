import { useQuery } from '@apollo/client/react'
import { useMemo } from 'react'
import { GET_VIEWER_COMPONENT } from '../graphql/queries/viewerComponent'
import type { ComponentRow } from '../components/shared/componentColumns'

export interface ViewerComponentResult {
  loading: boolean
  error: string | null
  row: ComponentRow | null
}

export function useViewerComponent(modelId: string | null): ViewerComponentResult {
  const { loading, error, data } = useQuery(GET_VIEWER_COMPONENT, {
    variables: { modelId: modelId ?? '' },
    skip: !modelId,
    fetchPolicy: 'cache-first',
  })

  const row = useMemo<ComponentRow | null>(() => {
    const component = (data as any)?.model?.component
    if (!component) return null
    return {
      id: component.id,
      componentId: component.id,
      componentState: null,
      name: component.name?.displayValue ?? '',
      partNumber: component.partNumber?.displayValue ?? '',
      description: component.description?.displayValue ?? '',
      materialName: component.materialName?.displayValue ?? '',
    }
  }, [data])

  return {
    loading,
    error: error?.message ?? null,
    row,
  }
}
