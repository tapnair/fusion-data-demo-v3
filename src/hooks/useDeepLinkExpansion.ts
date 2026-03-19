import { useState, useEffect, useCallback } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { useNavContext } from '../context/NavContext'
import type { NavNode } from '../types/nav.types'
import { GET_PROJECT_DETAIL } from '../graphql/queries/projects'
import { GET_FOLDER_DETAIL } from '../graphql/queries/folders'
import { GET_ITEM_DETAIL } from '../graphql/queries/items'

export function useDeepLinkExpansion(node: NavNode | null) {
  const client = useApolloClient()
  const { expandedItems, setExpandedItems, nodeChildrenCache } = useNavContext()

  // Ordered ancestor node IDs to expand: ['hub:H1', 'project:P1', 'folder:F1']
  // Does NOT include the target node itself — only its ancestors.
  const [pendingAncestors, setPendingAncestors] = useState<string[]>([])
  // Track which node ID this expansion is for, to reset when node changes
  const [expandingForNodeId, setExpandingForNodeId] = useState<string | null>(null)

  // ── Step 1: Resolve the ancestor chain when a deep-link stub node appears ──
  const resolveAncestors = useCallback(async (n: NavNode) => {
    try {
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

      if (!hubId) return  // can't expand without hubId

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
        // Fetch item detail to get project and parentFolder
        const itemResult = await client.query({
          query: GET_ITEM_DETAIL,
          variables: { hubId, itemId: n.entityId },
          fetchPolicy: 'cache-first',
        })
        const itemProjectId: string | undefined =
          (itemResult.data as any)?.item?.project?.id
        const parentFolderId: string | null =
          (itemResult.data as any)?.item?.parentFolder?.id ?? null

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

      setExpandingForNodeId(n.id)
      setPendingAncestors(ancestors)
    } catch {
      // Silently fail — detail panel still shows the resource
    }
  }, [client])

  // Trigger ancestor resolution when a new deep-link stub arrives
  useEffect(() => {
    if (!node || node.label !== '') return  // not a stub
    if (node.id === expandingForNodeId) return  // already resolving for this node
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

    if (nextIndex === 0) {
      // First level (hub) — always safe to expand immediately
      setExpandedItems([...expandedItems, nextId])
    } else {
      // Only expand once the previous level's children are loaded
      const prevId = pendingAncestors[nextIndex - 1]
      if (nodeChildrenCache.has(prevId)) {
        setExpandedItems([...expandedItems, nextId])
      }
      // If previous level not loaded yet, wait for next nodeChildrenCache update
    }
  }, [nodeChildrenCache, pendingAncestors])
}
