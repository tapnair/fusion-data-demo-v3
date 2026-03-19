import { useMemo } from 'react'
import { useQuery } from '@apollo/client/react'
import { GET_FOLDERS_BY_PROJECT, GET_FOLDERS_BY_FOLDER } from '../graphql/queries/folders'
import { GET_ITEMS_BY_PROJECT, GET_ITEMS_BY_FOLDER } from '../graphql/queries/items'
import type { NavNode } from '../types/nav.types'
import type { ContentRow } from '../types/folderContents.types'

export function useFolderContents(node: NavNode) {
  const isProject = node.type === 'project'
  const isFolder  = node.type === 'folder'

  const projFoldersResult = useQuery(GET_FOLDERS_BY_PROJECT, {
    variables: { projectId: node.entityId },
    skip: !isProject,
    fetchPolicy: 'cache-first',
  })
  const projItemsResult = useQuery(GET_ITEMS_BY_PROJECT, {
    variables: { projectId: node.entityId },
    skip: !isProject,
    fetchPolicy: 'cache-first',
  })
  const folderFoldersResult = useQuery(GET_FOLDERS_BY_FOLDER, {
    variables: { projectId: node.projectId ?? '', folderId: node.entityId },
    skip: !isFolder || !node.projectId,
    fetchPolicy: 'cache-first',
  })
  const folderItemsResult = useQuery(GET_ITEMS_BY_FOLDER, {
    variables: { hubId: node.hubId ?? '', folderId: node.entityId },
    skip: !isFolder || !node.hubId,
    fetchPolicy: 'cache-first',
  })

  const loading =
    projFoldersResult.loading || projItemsResult.loading ||
    folderFoldersResult.loading || folderItemsResult.loading

  const error =
    projFoldersResult.error ?? projItemsResult.error ??
    folderFoldersResult.error ?? folderItemsResult.error ?? null

  const rows: ContentRow[] = useMemo(() => {
    const rawFolders: any[] = isProject
      ? ((projFoldersResult.data as any)?.foldersByProject?.results ?? [])
      : ((folderFoldersResult.data as any)?.foldersByFolder?.results ?? [])

    const rawItems: any[] = isProject
      ? ((projItemsResult.data as any)?.itemsByProject?.results ?? [])
      : ((folderItemsResult.data as any)?.itemsByFolder?.results ?? [])

    const folderRows: ContentRow[] = rawFolders
      .map((f): ContentRow => ({
        id: f.id,
        kind: 'folder',
        name: f.name ?? '',
        itemType: null,
        size: null,
        objectCount: f.objectCount ?? null,
        lastModifiedOn: f.lastModifiedOn ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    const itemRows: ContentRow[] = rawItems
      .map((i): ContentRow => ({
        id: i.id,
        kind: 'item',
        name: i.name ?? '',
        itemType: i.extensionType ?? null,
        size: i.size ?? null,
        objectCount: null,
        lastModifiedOn: i.lastModifiedOn ?? null,
        __typename: i.__typename,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    return [...folderRows, ...itemRows]
  }, [isProject,
      projFoldersResult.data, projItemsResult.data,
      folderFoldersResult.data, folderItemsResult.data])

  return { rows, loading, error }
}
