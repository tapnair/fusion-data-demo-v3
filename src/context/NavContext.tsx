import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { NavNode } from '../types/nav.types'

interface NavContextValue {
  // Selected node drives the detail panel
  selectedNode: NavNode | null
  setSelectedNode: (node: NavNode | null) => void

  // Expanded tree items (controlled)
  expandedItems: string[]
  setExpandedItems: (ids: string[]) => void

  // Children cache: nodeId -> its loaded children (UI tree model)
  nodeChildrenCache: Map<string, NavNode[]>
  setNodeChildren: (parentId: string, children: NavNode[]) => void

  // Which nodes are currently loading (drives spinner UX)
  loadingNodes: Set<string>
  setNodeLoading: (nodeId: string, loading: boolean) => void
}

const NavContext = createContext<NavContextValue | undefined>(undefined)

export function NavProvider({ children }: { children: ReactNode }) {
  const [selectedNode, setSelectedNode] = useState<NavNode | null>(null)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [nodeChildrenCache, setNodeChildrenCacheState] = useState<Map<string, NavNode[]>>(new Map())
  const [loadingNodes, setLoadingNodesState] = useState<Set<string>>(new Set())

  const setNodeChildren = useCallback((parentId: string, children: NavNode[]) => {
    setNodeChildrenCacheState(prev => new Map(prev).set(parentId, children))
  }, [])

  const setNodeLoading = useCallback((nodeId: string, loading: boolean) => {
    setLoadingNodesState(prev => {
      const next = new Set(prev)
      if (loading) next.add(nodeId)
      else next.delete(nodeId)
      return next
    })
  }, [])

  const value: NavContextValue = {
    selectedNode,
    setSelectedNode,
    expandedItems,
    setExpandedItems,
    nodeChildrenCache,
    setNodeChildren,
    loadingNodes,
    setNodeLoading,
  }

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

export function useNavContext(): NavContextValue {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNavContext must be used within NavProvider')
  return ctx
}
