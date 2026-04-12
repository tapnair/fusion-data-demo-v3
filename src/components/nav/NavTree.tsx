import { useCallback, useEffect, useRef } from 'react'
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import { Box, Typography, CircularProgress } from '@mui/material'
import { useHubs } from '../../hooks/useHubs'
import { useNavContext } from '../../context/NavContext'
import { useNavLoader } from '../../hooks/useNavLoader'
import { NavTreeItem } from './NavTreeItem'
import type { NavNode } from '../../types/nav.types'

// Recursively renders tree items for a list of NavNodes
function renderNodes(
  nodes: NavNode[],
  cache: Map<string, NavNode[]>,
  loadingNodes: Set<string>,
): React.ReactNode {
  return nodes.map(node => {
    const isLoading = loadingNodes.has(node.id)
    const loadedChildren = cache.get(node.id)

    if (node.type === 'load-more') {
      return (
        <NavTreeItem
          key={node.id}
          itemId={node.id}
          label={isLoading ? 'Loading...' : 'Load more...'}
          nodeType="load-more"
          isLoading={isLoading}
        />
      )
    }

    return (
      <NavTreeItem
        key={node.id}
        itemId={node.id}
        label={node.label}
        nodeType={node.type}
        isLoading={isLoading}
      >
        {/* If hasChildren and not yet loaded: show placeholder to force expand arrow */}
        {node.hasChildren && !loadedChildren && !isLoading && (
          <NavTreeItem
            itemId={`__ph:${node.id}`}
            label=""
            nodeType={node.type}
          />
        )}
        {/* Show loading placeholder while fetching */}
        {node.hasChildren && isLoading && (
          <NavTreeItem
            itemId={`__loading:${node.id}`}
            label="Loading..."
            nodeType={node.type}
            isLoading
          />
        )}
        {/* Render actual children when loaded */}
        {loadedChildren && renderNodes(loadedChildren, cache, loadingNodes)}
      </NavTreeItem>
    )
  })
}

function findNodeById(
  nodes: NavNode[],
  cache: Map<string, NavNode[]>,
  nodeId: string,
): NavNode | undefined {
  for (const n of nodes) {
    if (n.id === nodeId) return n
    const children = cache.get(n.id)
    if (children) {
      const found = findNodeById(children, cache, nodeId)
      if (found) return found
    }
  }
  return undefined
}

function hubVersionAtLeast2(version?: string): boolean {
  if (!version) return false
  const major = parseInt(version.split('.')[0], 10)
  return !isNaN(major) && major >= 2
}

interface NavTreeProps {
  filterV2Hubs: boolean
}

export function NavTree({ filterV2Hubs }: NavTreeProps) {
  const { hubs, loading: hubsLoading, error: hubsError } = useHubs()
  const {
    expandedItems,
    setExpandedItems,
    nodeChildrenCache,
    loadingNodes,
    setSelectedNode,
    selectedNode,
    activeHubNode,
    setActiveHub,
  } = useNavContext()
  const { loadChildren } = useNavLoader()

  const prevExpandedRef = useRef<string[]>([])

  // Build root hub nodes from useHubs result
  const visibleHubs = filterV2Hubs ? hubs.filter(h => hubVersionAtLeast2(h.hubDataVersion)) : hubs
  const hubNodes: NavNode[] = visibleHubs.map(hub => ({
    id: `hub:${hub.id}`,
    label: hub.name ?? hub.id,
    type: 'hub',
    entityId: hub.id,
    hasChildren: true,
    isLoaded: nodeChildrenCache.has(`hub:${hub.id}`),
  }))

  // Set of all hub node IDs (used for single-hub expansion enforcement)
  const hubNodeIds = hubNodes.map(h => h.id)

  // Sync activeHub from expandedItems — covers all code paths that mutate
  // expandedItems directly (useDeepLinkExpansion, search navigation, etc.)
  // and enforces the single-hub rule on restoration.
  useEffect(() => {
    if (hubNodes.length === 0) return
    const hubIdSet = new Set(hubNodeIds)
    const expandedHubIds = expandedItems.filter(id => hubIdSet.has(id))

    if (expandedHubIds.length === 0) {
      if (activeHubNode !== null) setActiveHub(null)
      return
    }

    // Enforce single-hub: drop any extra expanded hubs beyond the first
    if (expandedHubIds.length > 1) {
      setExpandedItems(expandedItems.filter(id => !hubIdSet.has(id) || id === expandedHubIds[0]))
    }

    const hubNode = hubNodes.find(h => h.id === expandedHubIds[0]) ?? null
    if (hubNode?.entityId !== activeHubNode?.entityId) {
      setActiveHub(hubNode)
    }
  // hubNodeIds is a new array each render — depend on hubNodes instead
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedItems, hubNodes])

  const handleExpandedItemsChange = useCallback(
    (_event: React.SyntheticEvent | null, nodeIds: string[]) => {
      // Find newly added and removed items
      const added = nodeIds.filter(id => !expandedItems.includes(id))
      const removed = expandedItems.filter(id => !nodeIds.includes(id))

      // Check if any newly added item is a hub node
      const addedHubs = added.filter(id => hubNodeIds.includes(id))

      let nextExpanded: string[]

      if (addedHubs.length > 0) {
        // Single-hub rule: keep the newly expanded hub, remove all other hub IDs
        nextExpanded = nodeIds.filter(id => !hubNodeIds.includes(id) || addedHubs.includes(id))
        const hubNode = hubNodes.find(h => h.id === addedHubs[0]) ?? null
        setActiveHub(hubNode)
      } else {
        nextExpanded = nodeIds
        // If a hub was collapsed, clear the active hub
        const removedHubs = removed.filter(id => hubNodeIds.includes(id))
        if (removedHubs.length > 0) {
          setActiveHub(null)
        }
      }

      setExpandedItems(nextExpanded)

      // Find newly expanded nodes that need their children loaded
      const newlyExpanded = nextExpanded.filter(id => !expandedItems.includes(id))
      newlyExpanded.forEach(nodeId => {
        const node = findNodeById(hubNodes, nodeChildrenCache, nodeId)
        if (node && node.type !== 'load-more' && !nodeChildrenCache.has(node.id)) {
          loadChildren(node)
        }
      })
    },
    [expandedItems, setExpandedItems, hubNodes, hubNodeIds, nodeChildrenCache, loadChildren, setActiveHub],
  )

  const handleItemSelectionToggle = useCallback(
    (_event: React.SyntheticEvent | null, nodeId: string, isSelected: boolean) => {
      if (!isSelected) return

      // Skip placeholder nodes
      if (nodeId.startsWith('__ph:') || nodeId.startsWith('__loading:')) return

      const node = findNodeById(hubNodes, nodeChildrenCache, nodeId)
      if (!node) return

      if (node.type === 'load-more') {
        // Load-more: trigger pagination load instead of selection
        loadChildren(node)
        return
      }

      setSelectedNode(node)
    },
    [hubNodes, nodeChildrenCache, setSelectedNode, loadChildren],
  )

  useEffect(() => {
    if (!selectedNode) return
    const targetId = `nav-tree-${selectedNode.id}`
    let attempts = 0
    const tryScroll = () => {
      const el = document.getElementById(targetId)
      const container = document.getElementById('nav-tree-scroll-container')
      if (el && container) {
        const elTop = el.getBoundingClientRect().top
        const containerTop = container.getBoundingClientRect().top
        const targetOffset = elTop - containerTop - container.clientHeight * 0.3
        container.scrollBy({ top: targetOffset, behavior: 'smooth' })
      } else if (attempts < 10) {
        setTimeout(tryScroll, 100 * Math.pow(2, attempts++))
      }
    }
    requestAnimationFrame(tryScroll)
  }, [selectedNode?.id, nodeChildrenCache])

  useEffect(() => {
    const prev = prevExpandedRef.current
    const newIds = expandedItems.filter(id => !prev.includes(id))
    prevExpandedRef.current = expandedItems
    newIds.forEach(nodeId => {
      if (nodeId.startsWith('__')) return
      if (nodeChildrenCache.has(nodeId) || loadingNodes.has(nodeId)) return
      const node = findNodeById(hubNodes, nodeChildrenCache, nodeId)
      if (node?.hasChildren) loadChildren(node)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedItems])

  // Retry loading children for expanded nodes when hubNodes first populates.
  // This fixes the race where deep-link expansion adds hub IDs to expandedItems
  // before the useHubs query resolves, so findNodeById returned null above.
  useEffect(() => {
    if (hubNodes.length === 0) return
    expandedItems.forEach(nodeId => {
      if (nodeId.startsWith('__')) return
      if (nodeChildrenCache.has(nodeId) || loadingNodes.has(nodeId)) return
      const node = findNodeById(hubNodes, nodeChildrenCache, nodeId)
      if (node?.hasChildren) loadChildren(node)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubNodes])

  if (hubsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (hubsError) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="error">
          Failed to load hubs
        </Typography>
      </Box>
    )
  }

  if (hubNodes.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        {filterV2Hubs ? (
          <Typography variant="caption" color="warning.main">
            You do not have access to any CE hubs. This application will not perform as expected.
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">
            No hubs available
          </Typography>
        )}
      </Box>
    )
  }

  return (
    <SimpleTreeView
      id="nav-tree"
      selectedItems={selectedNode?.id ?? null}
      expandedItems={expandedItems}
      onExpandedItemsChange={handleExpandedItemsChange}
      onItemSelectionToggle={handleItemSelectionToggle}
      sx={{ overflowX: 'hidden' }}
    >
      {renderNodes(hubNodes, nodeChildrenCache, loadingNodes)}
    </SimpleTreeView>
  )
}
