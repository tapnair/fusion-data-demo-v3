import { useLazyQuery } from '@apollo/client/react'
import { useEffect, useMemo, useRef, useCallback } from 'react'
import { SEARCH_BY_HUB } from '../graphql/queries/search'
import { useSearch } from '../context/SearchContext'
import { useActiveHub } from '../context/NavContext'
import type { SearchRow, SearchResultMatch } from '../types/search.types'

function mapResultsToRows(data: any): SearchRow[] {
  const results: any[] = data?.searchByHub?.results ?? []
  return results.filter((result: any) => result?.searchResultObject != null).map((result: any, index: number) => {
    const obj = result.searchResultObject
    const typename: string = obj?.__typename ?? ''

    const base: SearchRow = {
      id: obj?.id ?? `result-${index}`,
      componentId: '',
      componentState: null,
      name: result.name ?? '',
      partNumber: '',
      description: '',
      materialName: '',
      resultType: 'FILE',
      objectTypeName: typename,
      relevancyScore: result.score ?? null,
      thumbnailUrl: result.thumbnail?.signedUrl ?? null,
      matches: (result.matches ?? []) as SearchResultMatch[],
      mimeType: null,
      fileSize: null,
      folderPath: null,
      objectCount: null,
      timestamp: null,
      parentItemId: null,
      parentItemHubId: null,
      parentItemFolderId: null,
      parentFolderName: null,
      parentProjectId: null,
      parentProjectName: null,
    }

    if (typename === 'Component') {
      return {
        ...base,
        resultType: 'COMPONENT' as const,
        objectTypeName: 'Component',
        componentId: obj.id,
        componentState: obj.componentState ?? null,
        name: obj.nameProp?.value ?? result.name ?? '',
        partNumber: obj.partNumber?.value ?? '',
        description: obj.description?.value ?? '',
        materialName: obj.materialNameProp?.value ?? '',
        parentItemId: obj.primaryModel?.designItem?.id ?? null,
        parentItemHubId: obj.primaryModel?.designItem?.hub?.id ?? null,
        parentItemFolderId: obj.primaryModel?.designItem?.parentFolder?.id ?? null,
        parentFolderName: obj.primaryModel?.designItem?.parentFolder?.name ?? null,
        parentProjectId: obj.primaryModel?.designItem?.project?.id ?? null,
        parentProjectName: obj.primaryModel?.designItem?.project?.name ?? null,
      }
    }

    if (typename === 'Folder') {
      return {
        ...base,
        id: obj.id,
        resultType: 'FOLDER' as const,
        objectTypeName: 'Folder',
        name: obj.name ?? result.name ?? '',
        objectCount: obj.objectCount ?? null,
        folderPath: obj.path ?? null,
        parentItemHubId: obj.hub?.id ?? null,
        parentItemFolderId: obj.parentFolder?.id ?? null,
        parentFolderName: obj.parentFolder?.name ?? null,
        parentProjectId: obj.project?.id ?? null,
        parentProjectName: obj.project?.name ?? null,
      }
    }

    if (typename === 'Model') {
      return {
        ...base,
        id: obj.id,
        resultType: 'MODEL' as const,
        objectTypeName: 'Model',
        name: obj.modelName?.value ?? result.name ?? '',
        materialName: obj.modelMaterialName?.value ?? '',
        timestamp: obj.timestamp ?? null,
        parentItemId: obj.designItem?.id ?? null,
        parentItemHubId: obj.designItem?.hub?.id ?? null,
        parentItemFolderId: obj.designItem?.parentFolder?.id ?? null,
        parentFolderName: obj.designItem?.parentFolder?.name ?? null,
        parentProjectId: obj.designItem?.project?.id ?? null,
        parentProjectName: obj.designItem?.project?.name ?? null,
      }
    }

    // FILE types: DesignItem, DrawingItem, BasicItem, ConfiguredDesignItem
    const objectTypeNames: Record<string, string> = {
      DesignItem: 'Design',
      DrawingItem: 'Drawing',
      BasicItem: 'File',
      ConfiguredDesignItem: 'Configured Design',
    }
    return {
      ...base,
      id: obj?.id ?? `result-${index}`,
      resultType: 'FILE' as const,
      objectTypeName: objectTypeNames[typename] ?? typename,
      name: obj?.name ?? result.name ?? '',
      mimeType: obj?.mimeType ?? null,
      fileSize: obj?.size ?? null,
      folderPath: obj?.parentFolder?.id ?? null,
      parentItemHubId: obj?.hub?.id ?? null,
      parentItemFolderId: obj?.parentFolder?.id ?? null,
      parentFolderName: obj?.parentFolder?.name ?? null,
      parentProjectId: obj?.project?.id ?? null,
      parentProjectName: obj?.project?.name ?? null,
    }
  })
}

export function useComponentSearch() {
  const {
    isOpen,
    query,
    mode,
    selectedPropertyId,
    propertyQueryValues,
    activeTypeFilters,
  } = useSearch()
  const { activeHubId } = useActiveHub()
  const [executeSearch, { data, loading, error, fetchMore }] = useLazyQuery(SEARCH_BY_HUB, { errorPolicy: 'all' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isOpen || !activeHubId) return

    const hasQuery =
      mode === 'freetext'
        ? query.trim().length > 0
        : selectedPropertyId !== null && propertyQueryValues.trim().length > 0

    if (!hasQuery) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const desiredTypes = activeTypeFilters.length > 0 ? activeTypeFilters : undefined
      const criteria =
        mode === 'freetext'
          ? { query: query.trim(), desiredSearchResultTypes: desiredTypes }
          : {
              searchFields: [
                {
                  searchableProperty: selectedPropertyId!,
                  PropertyQuery: [propertyQueryValues.trim()],
                },
              ],
              desiredSearchResultTypes: desiredTypes,
            }
      executeSearch({
        variables: {
          hubId: activeHubId,
          searchCriteria: criteria,
          pagination: { limit: 20 },
        },
      })
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [
    isOpen,
    activeHubId,
    query,
    mode,
    selectedPropertyId,
    propertyQueryValues,
    activeTypeFilters,
    executeSearch,
  ])

  const rows = useMemo(() => mapResultsToRows(data), [data])

  const loadMore = useCallback(() => {
    const cursor = (data as any)?.searchByHub?.pagination?.cursor
    if (!cursor || !activeHubId) return
    const desiredTypes = activeTypeFilters.length > 0 ? activeTypeFilters : undefined
    const criteria =
      mode === 'freetext'
        ? { query: query.trim(), desiredSearchResultTypes: desiredTypes }
        : {
            searchFields: [
              {
                searchableProperty: selectedPropertyId!,
                PropertyQuery: [propertyQueryValues.trim()],
              },
            ],
            desiredSearchResultTypes: desiredTypes,
          }
    fetchMore({
      variables: {
        hubId: activeHubId,
        searchCriteria: criteria,
        pagination: { cursor, limit: 20 },
      },
    })
  }, [
    data,
    activeHubId,
    activeTypeFilters,
    mode,
    query,
    selectedPropertyId,
    propertyQueryValues,
    fetchMore,
  ])

  const hasMore = Boolean((data as any)?.searchByHub?.pagination?.cursor)

  return { rows, loading, error, loadMore, hasMore, totalCount: rows.length }
}
