import { useCallback } from 'react'
import { MfgDataModelClient } from '../services/api/mfgDataModelClient'
import { useAuth } from '../context/AuthContext'
import { useNavContext } from '../context/NavContext'
import type { NavNode, NavNodeType } from '../types/nav.types'

const sortByLabel = (a: NavNode, b: NavNode) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })

export function useNavLoader() {
  const { getAccessToken } = useAuth()
  const {
    setNodeChildren,
    setNodeLoading,
    setFolderPagination,
    getFolderPagination,
    replaceLoadMoreNode,
    nodeChildrenCache,
  } = useNavContext()

  const createClient = useCallback(() => {
    return new MfgDataModelClient({
      graphqlEndpoint: import.meta.env.VITE_GRAPHQL_ENDPOINT,
      getAccessToken,
    })
  }, [getAccessToken])

  const loadChildren = useCallback(async (node: NavNode) => {
    // Don't reload already-loaded nodes (except load-more)
    if (node.type !== 'load-more' && nodeChildrenCache.has(node.id)) return

    setNodeLoading(node.id, true)
    try {
      const client = createClient()

      if (node.type === 'hub') {
        const res = await client.getProjects(node.entityId)
        const children: NavNode[] = (res.projects?.results ?? []).map(p => ({
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
        // Fetch root folders AND first page of items in parallel — use allSettled so
        // a failure in one doesn't prevent the other from showing
        const [foldersResult, itemsResult] = await Promise.allSettled([
          client.getFoldersByProject(node.entityId),
          client.getItemsByProject(node.entityId, { limit: 50 }),
        ])

        if (foldersResult.status === 'rejected') {
          console.error('Failed to load folders for project:', node.entityId, foldersResult.reason)
        }
        if (itemsResult.status === 'rejected') {
          console.error('Failed to load items for project:', node.entityId, itemsResult.reason)
        }

        const foldersRes = foldersResult.status === 'fulfilled' ? foldersResult.value : null
        const itemsRes = itemsResult.status === 'fulfilled' ? itemsResult.value : null

        const folders: NavNode[] = (foldersRes?.foldersByProject?.results ?? []).map(f => ({
          id: `folder:${f.id}`,
          label: f.name ?? f.id,
          type: 'folder' as NavNodeType,
          entityId: f.id,
          hubId: node.hubId,
          projectId: node.entityId,
          hasChildren: true,
          isLoaded: false,
        }))

        const items: NavNode[] = (itemsRes?.itemsByProject?.results ?? []).map(i => ({
          id: `item:${i.id}`,
          label: i.name ?? i.id,
          type: 'item' as NavNodeType,
          entityId: i.id,
          hubId: node.hubId,
          projectId: node.entityId,
          hasChildren: false,
          isLoaded: true,
        }))

        const paginationCursor = itemsRes?.itemsByProject?.pagination?.cursor ?? null
        const hasMore = !!paginationCursor
        setFolderPagination(node.id, { nextCursor: paginationCursor, hasMore })

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

        // Always call setNodeChildren (even with empty array) so the placeholder is removed
        setNodeChildren(node.id, [...folders, ...items].sort(sortByLabel).concat(loadMoreNode))

      } else if (node.type === 'folder') {
        // Fetch sub-folders and first page of items in parallel
        const [foldersResult, itemsResult] = await Promise.allSettled([
          client.getFoldersByFolder(node.projectId!, node.entityId),
          client.getItemsByFolder(node.hubId!, node.entityId, { limit: 50 }),
        ])

        if (foldersResult.status === 'rejected') {
          console.error('Failed to load sub-folders:', node.entityId, foldersResult.reason)
        }
        if (itemsResult.status === 'rejected') {
          console.error('Failed to load items for folder:', node.entityId, itemsResult.reason)
        }

        const foldersRes = foldersResult.status === 'fulfilled' ? foldersResult.value : null
        const itemsRes = itemsResult.status === 'fulfilled' ? itemsResult.value : null

        const subFolders: NavNode[] = (foldersRes?.foldersByFolder?.results ?? []).map(f => ({
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

        const items: NavNode[] = (itemsRes?.itemsByFolder?.results ?? []).map(i => ({
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

        const paginationCursor = itemsRes?.itemsByFolder?.pagination?.cursor ?? null
        const hasMore = !!paginationCursor
        setFolderPagination(node.id, { nextCursor: paginationCursor, hasMore })

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
        // Load next page of items — parent may be a project or folder
        const parentNodeId = node.parentNodeId!
        const pagination = getFolderPagination(parentNodeId)
        if (!pagination?.hasMore || !pagination.nextCursor) return

        const isProjectParent = parentNodeId.startsWith('project:')
        let rawResults: any[]
        let nextCursor: string | null

        if (isProjectParent) {
          const res = await client.getItemsByProject(
            node.entityId,
            { limit: 50, cursor: pagination.nextCursor }
          )
          rawResults = res.itemsByProject?.results ?? []
          nextCursor = res.itemsByProject?.pagination?.cursor ?? null
        } else {
          const res = await client.getItemsByFolder(
            node.hubId!,
            node.entityId,
            { limit: 50, cursor: pagination.nextCursor }
          )
          rawResults = res.itemsByFolder?.results ?? []
          nextCursor = res.itemsByFolder?.pagination?.cursor ?? null
        }

        const newItems: NavNode[] = rawResults.map(i => ({
          id: `item:${i.id}`,
          label: i.name ?? i.id,
          type: 'item' as NavNodeType,
          entityId: i.id,
          hubId: node.hubId,
          projectId: node.projectId,
          parentFolderId: isProjectParent ? undefined : node.entityId,
          hasChildren: false,
          isLoaded: true,
        }))

        const stillHasMore = !!nextCursor
        replaceLoadMoreNode(parentNodeId, node.id, newItems.sort(sortByLabel), stillHasMore, nextCursor)
      }
    } catch (err) {
      console.error(`Failed to load children for node ${node.id}:`, err)
    } finally {
      setNodeLoading(node.id, false)
    }
  }, [createClient, nodeChildrenCache, setNodeChildren, setNodeLoading, setFolderPagination, getFolderPagination, replaceLoadMoreNode])

  return { loadChildren }
}
