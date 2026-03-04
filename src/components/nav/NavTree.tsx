import { useCallback } from 'react'
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
  } = useNavContext()
  const { loadChildren } = useNavLoader()

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

  const handleExpandedItemsChange = useCallback(
    (_event: React.SyntheticEvent | null, nodeIds: string[]) => {
      setExpandedItems(nodeIds)

      // Find newly expanded nodes (in new list but not in current list)
      const newlyExpanded = nodeIds.filter(id => !expandedItems.includes(id))

      newlyExpanded.forEach(nodeId => {
        // Find the NavNode for this id — search hubs + cache recursively
        const findNode = (nodes: NavNode[]): NavNode | undefined => {
          for (const n of nodes) {
            if (n.id === nodeId) return n
            const children = nodeChildrenCache.get(n.id)
            if (children) {
              const found = findNode(children)
              if (found) return found
            }
          }
          return undefined
        }

        const node = findNode(hubNodes)
        if (node && node.type !== 'load-more' && !nodeChildrenCache.has(node.id)) {
          loadChildren(node)
        }
      })
    },
    [expandedItems, setExpandedItems, hubNodes, nodeChildrenCache, loadChildren],
  )

  const handleItemSelectionToggle = useCallback(
    (_event: React.SyntheticEvent | null, nodeId: string, isSelected: boolean) => {
      if (!isSelected) return

      // Skip placeholder nodes
      if (nodeId.startsWith('__ph:') || nodeId.startsWith('__loading:')) return

      // Find the NavNode — search hubs + cache recursively
      const findNode = (nodes: NavNode[]): NavNode | undefined => {
        for (const n of nodes) {
          if (n.id === nodeId) return n
          const children = nodeChildrenCache.get(n.id)
          if (children) {
            const found = findNode(children)
            if (found) return found
          }
        }
        return undefined
      }

      const node = findNode(hubNodes)
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
      expandedItems={expandedItems}
      onExpandedItemsChange={handleExpandedItemsChange}
      onItemSelectionToggle={handleItemSelectionToggle}
      sx={{ overflowX: 'hidden' }}
    >
      {renderNodes(hubNodes, nodeChildrenCache, loadingNodes)}
    </SimpleTreeView>
  )
}
