import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { NavNode, FolderPaginationState } from '../types/nav.types'

interface NavContextValue {
  // Selected node drives the detail panel
  selectedNode: NavNode | null
  setSelectedNode: (node: NavNode | null) => void

  // Expanded tree items (controlled)
  expandedItems: string[]
  setExpandedItems: (ids: string[]) => void

  // Children cache: nodeId -> its loaded children
  nodeChildrenCache: Map<string, NavNode[]>
  setNodeChildren: (parentId: string, children: NavNode[]) => void
  // Append more items to an existing cache entry (for load-more)
  appendNodeChildren: (parentId: string, newChildren: NavNode[]) => void
  // Replace a load-more node with actual items (+ new load-more if needed)
  replaceLoadMoreNode: (
    parentId: string,
    loadMoreNodeId: string,
    newNodes: NavNode[],
    stillHasMore: boolean,
    nextCursor: string | null
  ) => void

  // Which nodes are currently loading
  loadingNodes: Set<string>
  setNodeLoading: (nodeId: string, loading: boolean) => void

  // Pagination state per folder node
  folderPagination: Map<string, FolderPaginationState>
  setFolderPagination: (nodeId: string, state: FolderPaginationState) => void
  getFolderPagination: (nodeId: string) => FolderPaginationState | undefined
}

const NavContext = createContext<NavContextValue | undefined>(undefined)

export function NavProvider({ children }: { children: ReactNode }) {
  const [selectedNode, setSelectedNode] = useState<NavNode | null>(null)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [nodeChildrenCache, setNodeChildrenCacheState] = useState<Map<string, NavNode[]>>(new Map())
  const [loadingNodes, setLoadingNodesState] = useState<Set<string>>(new Set())
  const [folderPagination, setFolderPaginationState] = useState<Map<string, FolderPaginationState>>(new Map())

  const setNodeChildren = useCallback((parentId: string, children: NavNode[]) => {
    setNodeChildrenCacheState(prev => new Map(prev).set(parentId, children))
  }, [])

  const appendNodeChildren = useCallback((parentId: string, newChildren: NavNode[]) => {
    setNodeChildrenCacheState(prev => {
      const existing = prev.get(parentId) ?? []
      return new Map(prev).set(parentId, [...existing, ...newChildren])
    })
  }, [])

  const replaceLoadMoreNode = useCallback((
    parentId: string,
    loadMoreNodeId: string,
    newNodes: NavNode[],
    stillHasMore: boolean,
    nextCursor: string | null
  ) => {
    setNodeChildrenCacheState(prev => {
      const existing = prev.get(parentId) ?? []
      const withoutLoadMore = existing.filter(n => n.id !== loadMoreNodeId)
      const loadMoreNode: NavNode[] = stillHasMore ? [{
        id: `load-more:${parentId}`,
        label: 'Load more...',
        type: 'load-more',
        entityId: newNodes[0]?.parentFolderId ?? '',
        hubId: newNodes[0]?.hubId,
        projectId: newNodes[0]?.projectId,
        parentFolderId: newNodes[0]?.parentFolderId,
        parentNodeId: parentId,
        hasChildren: false,
        isLoaded: true,
      }] : []
      return new Map(prev).set(parentId, [...withoutLoadMore, ...newNodes, ...loadMoreNode])
    })
    setFolderPaginationState(prev =>
      new Map(prev).set(parentId, { nextCursor, hasMore: stillHasMore })
    )
  }, [])

  const setNodeLoading = useCallback((nodeId: string, loading: boolean) => {
    setLoadingNodesState(prev => {
      const next = new Set(prev)
      if (loading) next.add(nodeId)
      else next.delete(nodeId)
      return next
    })
  }, [])

  const setFolderPagination = useCallback((nodeId: string, state: FolderPaginationState) => {
    setFolderPaginationState(prev => new Map(prev).set(nodeId, state))
  }, [])

  const getFolderPagination = useCallback((nodeId: string) => {
    return folderPagination.get(nodeId)
  }, [folderPagination])

  const value: NavContextValue = {
    selectedNode,
    setSelectedNode,
    expandedItems,
    setExpandedItems,
    nodeChildrenCache,
    setNodeChildren,
    appendNodeChildren,
    replaceLoadMoreNode,
    loadingNodes,
    setNodeLoading,
    folderPagination,
    setFolderPagination,
    getFolderPagination,
  }

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

export function useNavContext(): NavContextValue {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNavContext must be used within NavProvider')
  return ctx
}
