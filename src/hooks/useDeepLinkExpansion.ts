import { useState, useEffect, useCallback } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { useNavContext } from '../context/NavContext'
import { useNavLoader } from './useNavLoader'
import type { NavNode } from '../types/nav.types'
import { GET_PROJECT_DETAIL } from '../graphql/queries/projects'
import { GET_FOLDER_DETAIL } from '../graphql/queries/folders'
import { GET_ITEM_DETAIL } from '../graphql/queries/items'

export function useDeepLinkExpansion(node: NavNode | null) {
  const client = useApolloClient()
  const { expandedItems, setExpandedItems, nodeChildrenCache } = useNavContext()
  const { loadChildren } = useNavLoader()

  // Ordered ancestor node IDs to expand: ['hub:H1', 'project:P1', 'folder:F1']
  // Does NOT include the target node itself — only its ancestors.
  const [pendingAncestors, setPendingAncestors] = useState<string[]>([])
  // Track which node ID this expansion is for, to reset when node changes
  const [expandingForNodeId, setExpandingForNodeId] = useState<string | null>(null)
  // After ancestors are expanded, auto-paginate to surface the target in the tree
  const [paginationTarget, setPaginationTarget] = useState<{
    targetId: string
    parentNodeId: string
  } | null>(null)

  // ── Step 1: Resolve the ancestor chain when a stub or expansion-requested node appears ──
  const resolveAncestors = useCallback(async (n: NavNode) => {
    try {
      console.log('[DeepLink] resolveAncestors start', n.id, n.type)
      let hubId = n.hubId
      let projectId = n.projectId

      // For projects and folders, get hubId from project detail
      if (!hubId && projectId) {
        const result = await client.query({
          query: GET_PROJECT_DETAIL,
          variables: { projectId },
          fetchPolicy: 'cache-first',
        })
        hubId = (result.data as any)?.project?.hub?.id
      }

      if (!hubId) { console.log('[DeepLink] no hubId, aborting'); return }  // can't expand without hubId

      const ancestors: string[] = [`hub:${hubId}`]

      if (n.type === 'project') {
        // Hub → project
        ancestors.push(`project:${n.entityId}`)
      } else if (n.type === 'folder' && projectId) {
        // Hub → project → [intermediate folders] → parent of target
        ancestors.push(`project:${projectId}`)

        // Walk up parentFolder chain to find all intermediate folders
        const folderChain: string[] = []
        let currentFolderId: string | null = n.entityId

        while (currentFolderId) {
          const folderResult: { data: any } = await client.query({
            query: GET_FOLDER_DETAIL,
            variables: { projectId, folderId: currentFolderId },
            fetchPolicy: 'cache-first',
          })
          const parentFolderId: string | null =
            folderResult.data?.folder?.parentFolder?.id ?? null

          if (parentFolderId) {
            folderChain.unshift(`folder:${parentFolderId}`)
            currentFolderId = parentFolderId
          } else {
            break  // reached a root-level folder
          }
        }
        ancestors.push(...folderChain)
        // We expand all ancestors DOWN TO (but not including) the target.
        // The target will become visible once its parent is expanded.
      } else if (n.type === 'item') {
        // Hub → project → [intermediate folders]
        // Prefer URL-encoded ancestor IDs (projectId, parentFolderId) over an
        // extra API round-trip — GET_ITEM_DETAIL may return null for these fields
        // when queried with a lineage URN.
        let itemProjectId: string | undefined = n.projectId
        let parentFolderId: string | null = n.parentFolderId ?? null

        if (!itemProjectId || !parentFolderId) {
          const itemResult = await client.query({
            query: GET_ITEM_DETAIL,
            variables: { hubId, itemId: n.entityId },
            fetchPolicy: 'cache-first',
          })
          itemProjectId = itemProjectId ?? (itemResult.data as any)?.item?.project?.id
          parentFolderId = parentFolderId ?? ((itemResult.data as any)?.item?.parentFolder?.id ?? null)
        }

        if (itemProjectId) {
          ancestors.push(`project:${itemProjectId}`)
        }

        if (parentFolderId && itemProjectId) {
          // Walk up from parentFolder to get full intermediate folder chain
          const folderChain: string[] = [`folder:${parentFolderId}`]
          let currentFolderId: string | null = parentFolderId

          while (currentFolderId) {
            const folderResult: { data: any } = await client.query({
              query: GET_FOLDER_DETAIL,
              variables: { projectId: itemProjectId, folderId: currentFolderId },
              fetchPolicy: 'cache-first',
            })
            const nextParentId: string | null =
              folderResult.data?.folder?.parentFolder?.id ?? null

            if (nextParentId) {
              folderChain.unshift(`folder:${nextParentId}`)
              currentFolderId = nextParentId
            } else {
              break
            }
          }
          ancestors.push(...folderChain)
        }
      }

      console.log('[DeepLink] ancestors resolved:', ancestors)
      setExpandingForNodeId(n.id)
      setPendingAncestors(ancestors)

      // The immediate parent of the target is the last ancestor.
      // Set up auto-pagination so the target is found even if it's beyond the first page.
      const parentNodeId = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null
      if (parentNodeId) {
        setPaginationTarget({ targetId: n.id, parentNodeId })
      }
    } catch (err) {
      console.error('[DeepLink] resolveAncestors failed:', err)
    }
  }, [client])

  // Trigger ancestor resolution when a new deep-link stub or tree-expansion-requested node arrives
  useEffect(() => {
    if (!node) return
    // Fire for stub nodes (label='', URL-driven) OR nodes explicitly requesting tree expansion
    if (node.label !== '' && !node.needsTreeExpansion) return
    if (node.id === expandingForNodeId) return  // already resolving for this node
    console.log('[DeepLink] trigger fired for', node.id, 'needsTreeExpansion:', node.needsTreeExpansion)
    resolveAncestors(node)
  }, [node?.id])

  // ── Step 2: Progressively expand one level at a time ──────────────────────
  // Fires whenever nodeChildrenCache updates (new children loaded by NavTree).
  useEffect(() => {
    if (pendingAncestors.length === 0) return

    // Find the first ancestor not yet in expandedItems
    const nextIndex = pendingAncestors.findIndex(id => !expandedItems.includes(id))
    if (nextIndex === -1) {
      // All ancestors expanded — expansion complete
      setPendingAncestors([])
      return
    }

    const nextId = pendingAncestors[nextIndex]
    console.log('[DeepLink] step2: next to expand:', nextId, 'index:', nextIndex)

    if (nextIndex === 0) {
      // First level (hub) — always safe to expand immediately
      setExpandedItems([...expandedItems, nextId])
    } else {
      // Only expand once the previous level's children are loaded.
      // NOTE: children may already be cached from prior browsing — check before waiting.
      const prevId = pendingAncestors[nextIndex - 1]
      const prevLoaded = nodeChildrenCache.has(prevId)
      console.log('[DeepLink] step2: prev', prevId, 'loaded:', prevLoaded)
      if (prevLoaded) {
        setExpandedItems([...expandedItems, nextId])
      }
      // If previous level not loaded yet, wait for next nodeChildrenCache update
    }
  // expandedItems must be here: when a level is already cached loadChildren returns early
  // (no nodeChildrenCache change), so re-firing on expandedItems change is the only way
  // to continue the cascade.
  }, [nodeChildrenCache, pendingAncestors, expandedItems])

  // ── Step 3: Auto-paginate until target node appears in the tree ───────────
  // After all ancestors are expanded, check whether the target is in the
  // parent's children list. If not, trigger load-more until found or exhausted.
  useEffect(() => {
    if (!paginationTarget || pendingAncestors.length > 0) return
    const { targetId, parentNodeId } = paginationTarget

    const children = nodeChildrenCache.get(parentNodeId)
    if (!children) return  // parent not loaded yet

    // Target found — done
    if (children.some(c => c.id === targetId)) {
      setPaginationTarget(null)
      return
    }

    // Load next page if available
    const loadMoreNode = children.find(c => c.type === 'load-more')
    if (!loadMoreNode) {
      // No more pages — target not found (perhaps filtered or unavailable)
      setPaginationTarget(null)
      return
    }

    loadChildren(loadMoreNode)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeChildrenCache, paginationTarget, pendingAncestors.length])
}
