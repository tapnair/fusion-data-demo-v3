import { useCallback } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { useNavContext } from '../context/NavContext'
import { GET_PROJECTS } from '../graphql/queries/projects'
import { GET_FOLDERS_BY_PROJECT, GET_FOLDERS_BY_FOLDER } from '../graphql/queries/folders'
import { GET_ITEMS_BY_PROJECT, GET_ITEMS_BY_FOLDER } from '../graphql/queries/items'
import type { NavNode, NavNodeType } from '../types/nav.types'

const sortByLabel = (a: NavNode, b: NavNode) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })

export function useNavLoader() {
  const client = useApolloClient()
  const {
    setNodeChildren,
    setNodeLoading,
    nodeChildrenCache,
  } = useNavContext()

  const loadChildren = useCallback(async (node: NavNode) => {
    if (node.type !== 'load-more' && nodeChildrenCache.has(node.id)) return

    setNodeLoading(node.id, true)
    try {
      if (node.type === 'hub') {
        const { data } = await client.query<any>({
          query: GET_PROJECTS,
          variables: { hubId: node.entityId },
        })
        const children: NavNode[] = (data?.projects?.results ?? []).map((p: any) => ({
          id: `project:${p.id}`,
          label: p.name ?? p.id,
          type: 'project' as NavNodeType,
          entityId: p.id,
          hubId: node.entityId,
          hasChildren: true,
          isLoaded: false,
        }))
        setNodeChildren(node.id, children.sort(sortByLabel))

      } else if (node.type === 'project') {
        const [foldersResult, itemsResult] = await Promise.allSettled([
          client.query<any>({
            query: GET_FOLDERS_BY_PROJECT,
            variables: { projectId: node.entityId },
          }),
          client.query<any>({
            query: GET_ITEMS_BY_PROJECT,
            variables: { projectId: node.entityId, pagination: { limit: 50 } },
          }),
        ])

        if (foldersResult.status === 'rejected') {
          console.error('Failed to load folders for project:', node.entityId, foldersResult.reason)
        }
        if (itemsResult.status === 'rejected') {
          console.error('Failed to load items for project:', node.entityId, itemsResult.reason)
        }

        const foldersData = foldersResult.status === 'fulfilled' ? foldersResult.value.data : null
        const itemsData = itemsResult.status === 'fulfilled' ? itemsResult.value.data : null

        const folders: NavNode[] = (foldersData?.foldersByProject?.results ?? []).map((f: any) => ({
          id: `folder:${f.id}`,
          label: f.name ?? f.id,
          type: 'folder' as NavNodeType,
          entityId: f.id,
          hubId: node.hubId,
          projectId: node.entityId,
          hasChildren: true,
          isLoaded: false,
        }))

        const paginationCursor = itemsData?.itemsByProject?.pagination?.cursor ?? null
        const hasMore = !!paginationCursor

        const items: NavNode[] = (itemsData?.itemsByProject?.results ?? []).map((i: any) => ({
          id: `item:${i.id}`,
          label: i.name ?? i.id,
          type: 'item' as NavNodeType,
          entityId: i.id,
          hubId: node.hubId,
          projectId: node.entityId,
          hasChildren: false,
          isLoaded: true,
        }))

        const loadMoreNode: NavNode[] = hasMore ? [{
          id: `load-more:${node.id}`,
          label: 'Load more...',
          type: 'load-more' as NavNodeType,
          entityId: node.entityId,
          hubId: node.hubId,
          projectId: node.entityId,
          parentNodeId: node.id,
          hasChildren: false,
          isLoaded: true,
        }] : []

        setNodeChildren(node.id, [...folders, ...items].sort(sortByLabel).concat(loadMoreNode))

      } else if (node.type === 'folder') {
        const [foldersResult, itemsResult] = await Promise.allSettled([
          client.query<any>({
            query: GET_FOLDERS_BY_FOLDER,
            variables: { projectId: node.projectId!, folderId: node.entityId },
          }),
          client.query<any>({
            query: GET_ITEMS_BY_FOLDER,
            variables: { hubId: node.hubId!, folderId: node.entityId, pagination: { limit: 50 } },
          }),
        ])

        if (foldersResult.status === 'rejected') {
          console.error('Failed to load sub-folders:', node.entityId, foldersResult.reason)
        }
        if (itemsResult.status === 'rejected') {
          console.error('Failed to load items for folder:', node.entityId, itemsResult.reason)
        }

        const foldersData = foldersResult.status === 'fulfilled' ? foldersResult.value.data : null
        const itemsData = itemsResult.status === 'fulfilled' ? itemsResult.value.data : null

        const subFolders: NavNode[] = (foldersData?.foldersByFolder?.results ?? []).map((f: any) => ({
          id: `folder:${f.id}`,
          label: f.name ?? f.id,
          type: 'folder' as NavNodeType,
          entityId: f.id,
          hubId: node.hubId,
          projectId: node.projectId,
          parentFolderId: node.entityId,
          hasChildren: true,
          isLoaded: false,
        }))

        const paginationCursor = itemsData?.itemsByFolder?.pagination?.cursor ?? null
        const hasMore = !!paginationCursor

        const items: NavNode[] = (itemsData?.itemsByFolder?.results ?? []).map((i: any) => ({
          id: `item:${i.id}`,
          label: i.name ?? i.id,
          type: 'item' as NavNodeType,
          entityId: i.id,
          hubId: node.hubId,
          projectId: node.projectId,
          parentFolderId: node.entityId,
          hasChildren: false,
          isLoaded: true,
        }))

        const loadMoreNode: NavNode[] = hasMore ? [{
          id: `load-more:${node.id}`,
          label: 'Load more...',
          type: 'load-more' as NavNodeType,
          entityId: node.entityId,
          hubId: node.hubId,
          projectId: node.projectId,
          parentFolderId: node.entityId,
          parentNodeId: node.id,
          hasChildren: false,
          isLoaded: true,
        }] : []

        setNodeChildren(node.id, [...subFolders, ...items].sort(sortByLabel).concat(loadMoreNode))

      } else if (node.type === 'load-more') {
        const parentNodeId = node.parentNodeId!
        const isProjectParent = parentNodeId.startsWith('project:')

        // Read the current cursor from the Apollo cache for this parent's query
        let cursor: string | null = null
        if (isProjectParent) {
          const cached = client.readQuery({
            query: GET_ITEMS_BY_PROJECT,
            variables: { projectId: node.entityId, pagination: { limit: 50 } },
          }) as any
          cursor = cached?.itemsByProject?.pagination?.cursor ?? null
        } else {
          const cached = client.readQuery({
            query: GET_ITEMS_BY_FOLDER,
            variables: { hubId: node.hubId!, folderId: node.entityId, pagination: { limit: 50 } },
          }) as any
          cursor = cached?.itemsByFolder?.pagination?.cursor ?? null
        }

        if (!cursor) return

        // Fetch next page — pagedField merge fn appends into cache automatically
        if (isProjectParent) {
          await client.query<any>({
            query: GET_ITEMS_BY_PROJECT,
            variables: { projectId: node.entityId, pagination: { cursor, limit: 50 } },
            fetchPolicy: 'network-only',
          })
          // Read the now-merged full list from cache
          const merged = client.readQuery({
            query: GET_ITEMS_BY_PROJECT,
            variables: { projectId: node.entityId, pagination: { limit: 50 } },
          }) as any
          const allResults = merged?.itemsByProject?.results ?? []
          const nextCursor = merged?.itemsByProject?.pagination?.cursor ?? null
          const stillHasMore = !!nextCursor

          const newItems: NavNode[] = allResults.map((i: any) => ({
            id: `item:${i.id}`,
            label: i.name ?? i.id,
            type: 'item' as NavNodeType,
            entityId: i.id,
            hubId: node.hubId,
            projectId: node.projectId,
            hasChildren: false,
            isLoaded: true,
          }))

          const loadMoreNode: NavNode[] = stillHasMore ? [{
            id: `load-more:${parentNodeId}`,
            label: 'Load more...',
            type: 'load-more' as NavNodeType,
            entityId: node.entityId,
            hubId: node.hubId,
            projectId: node.projectId,
            parentNodeId,
            hasChildren: false,
            isLoaded: true,
          }] : []

          // Re-read folders from cache to rebuild full children list
          const cachedFolders = client.readQuery({
            query: GET_FOLDERS_BY_PROJECT,
            variables: { projectId: node.entityId },
          }) as any
          const folderNodes: NavNode[] = (cachedFolders?.foldersByProject?.results ?? []).map((f: any) => ({
            id: `folder:${f.id}`,
            label: f.name ?? f.id,
            type: 'folder' as NavNodeType,
            entityId: f.id,
            hubId: node.hubId,
            projectId: node.projectId,
            hasChildren: true,
            isLoaded: false,
          }))

          setNodeChildren(parentNodeId, [...folderNodes, ...newItems].sort(sortByLabel).concat(loadMoreNode))

        } else {
          await client.query<any>({
            query: GET_ITEMS_BY_FOLDER,
            variables: { hubId: node.hubId!, folderId: node.entityId, pagination: { cursor, limit: 50 } },
            fetchPolicy: 'network-only',
          })
          const merged = client.readQuery({
            query: GET_ITEMS_BY_FOLDER,
            variables: { hubId: node.hubId!, folderId: node.entityId, pagination: { limit: 50 } },
          }) as any
          const allResults = merged?.itemsByFolder?.results ?? []
          const nextCursor = merged?.itemsByFolder?.pagination?.cursor ?? null
          const stillHasMore = !!nextCursor

          const newItems: NavNode[] = allResults.map((i: any) => ({
            id: `item:${i.id}`,
            label: i.name ?? i.id,
            type: 'item' as NavNodeType,
            entityId: i.id,
            hubId: node.hubId,
            projectId: node.projectId,
            parentFolderId: node.entityId,
            hasChildren: false,
            isLoaded: true,
          }))

          const loadMoreNode: NavNode[] = stillHasMore ? [{
            id: `load-more:${parentNodeId}`,
            label: 'Load more...',
            type: 'load-more' as NavNodeType,
            entityId: node.entityId,
            hubId: node.hubId,
            projectId: node.projectId,
            parentFolderId: node.entityId,
            parentNodeId,
            hasChildren: false,
            isLoaded: true,
          }] : []

          const cachedFolders = client.readQuery({
            query: GET_FOLDERS_BY_FOLDER,
            variables: { projectId: node.projectId!, folderId: node.entityId },
          }) as any
          const folderNodes: NavNode[] = (cachedFolders?.foldersByFolder?.results ?? []).map((f: any) => ({
            id: `folder:${f.id}`,
            label: f.name ?? f.id,
            type: 'folder' as NavNodeType,
            entityId: f.id,
            hubId: node.hubId,
            projectId: node.projectId,
            parentFolderId: node.entityId,
            hasChildren: true,
            isLoaded: false,
          }))

          setNodeChildren(parentNodeId, [...folderNodes, ...newItems].sort(sortByLabel).concat(loadMoreNode))
        }
      }
    } catch (err) {
      console.error(`Failed to load children for node ${node.id}:`, err)
    } finally {
      setNodeLoading(node.id, false)
    }
  }, [client, nodeChildrenCache, setNodeChildren, setNodeLoading])

  return { loadChildren }
}
