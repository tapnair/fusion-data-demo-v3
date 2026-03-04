import { useState, useEffect, useCallback } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { GET_ITEM_BOM, GET_COMPONENT_BOM_CHILDREN } from '../graphql/queries/bom'
import type { NavNode } from '../types/nav.types'
import type { BomRow } from '../types/bom.types'

function mapRelationToRow(rel: any, depth: number, parentRowId: string): BomRow {
  const c = rel.toComponent
  return {
    id: rel.id,
    componentId: c.id,
    componentState: rel.toComponentState ?? null,
    name: c.name?.value ?? '',
    partNumber: c.partNumber?.value ?? '',
    description: c.description?.value ?? '',
    materialName: c.materialName?.value ?? '',
    quantity: rel.quantityProperty?.value ?? null,
    sequenceNumber: rel.sequenceNumber ?? 0,
    depth,
    hasChildren: c.hasChildren ?? false,
    isExpanded: false,
    isLoading: false,
    parentRowId,
    nextCursor: null,
  }
}

function mapRootToRow(component: any): BomRow {
  return {
    id: `root:${component.id}`,
    componentId: component.id,
    componentState: null,
    name: component.name?.value ?? '',
    partNumber: component.partNumber?.value ?? '',
    description: component.description?.value ?? '',
    materialName: component.materialName?.value ?? '',
    quantity: null,
    sequenceNumber: 0,
    depth: 0,
    hasChildren: component.hasChildren ?? false,
    isExpanded: true,
    isLoading: false,
    parentRowId: null,
    nextCursor: null,
  }
}

function makeLoadMoreRow(parentRow: BomRow, cursor: string): BomRow {
  return {
    id: `load-more:${parentRow.id}`,
    componentId: parentRow.componentId,
    componentState: parentRow.componentState,
    name: 'Load more...',
    partNumber: '',
    description: '',
    materialName: '',
    quantity: null,
    sequenceNumber: 999999,
    depth: parentRow.depth + 1,
    hasChildren: false,
    isExpanded: false,
    isLoading: false,
    parentRowId: parentRow.id,
    nextCursor: cursor,
  }
}

function sortBySequence(rels: any[]): any[] {
  return [...rels].sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0))
}

function getDescendantIds(rows: BomRow[], parentRowId: string): Set<string> {
  const result = new Set<string>()
  const queue = [parentRowId]
  while (queue.length) {
    const pid = queue.shift()!
    for (const r of rows) {
      if (r.parentRowId === pid) {
        result.add(r.id)
        queue.push(r.id)
      }
    }
  }
  return result
}

export function useBomLoader(node: NavNode) {
  const client = useApolloClient()
  const [rows, setRows] = useState<BomRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadRoot() {
      setLoading(true)
      setError(null)
      setRows([])
      try {
        const { data } = await client.query<any>({
          query: GET_ITEM_BOM,
          variables: { hubId: node.hubId!, itemId: node.entityId, pagination: { limit: 50 } },
        })
        if (cancelled) return

        const component = data?.item?.tipRootModel?.component
        if (!component) {
          setRows([])
          return
        }

        const rootRow = mapRootToRow(component)
        const relations: any[] = component.bomRelations?.results ?? []
        const cursor: string | null = component.bomRelations?.pagination?.cursor ?? null

        const childRows = sortBySequence(relations).map(rel =>
          mapRelationToRow(rel, 1, rootRow.id)
        )
        const loadMoreRows = cursor ? [makeLoadMoreRow(rootRow, cursor)] : []

        setRows([rootRow, ...childRows, ...loadMoreRows])
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Failed to load BOM')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRoot()
    return () => { cancelled = true }
  }, [node.entityId, node.hubId, client])

  const toggleRow = useCallback(async (row: BomRow) => {
    if (row.isExpanded) {
      setRows(prev => {
        const toRemove = getDescendantIds(prev, row.id)
        return prev
          .filter(r => !toRemove.has(r.id))
          .map(r => r.id === row.id ? { ...r, isExpanded: false } : r)
      })
      return
    }

    // Mark as loading
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, isLoading: true } : r))

    try {
      const { data } = await client.query<any>({
        query: GET_COMPONENT_BOM_CHILDREN,
        variables: {
          componentId: row.componentId,
          state: row.componentState ?? undefined,
          pagination: { limit: 50 },
        },
      })

      const relations: any[] = data?.component?.bomRelations?.results ?? []
      const cursor: string | null = data?.component?.bomRelations?.pagination?.cursor ?? null
      const childRows = sortBySequence(relations).map(rel =>
        mapRelationToRow(rel, row.depth + 1, row.id)
      )

      setRows(prev => {
        const idx = prev.findIndex(r => r.id === row.id)
        if (idx === -1) return prev
        const updatedRow: BomRow = { ...row, isExpanded: true, isLoading: false }
        const loadMoreRows = cursor ? [makeLoadMoreRow(updatedRow, cursor)] : []
        const next = [...prev]
        next.splice(idx, 1, updatedRow, ...childRows, ...loadMoreRows)
        return next
      })
    } catch (err: any) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, isLoading: false } : r))
      console.error('Failed to load BOM children:', err)
    }
  }, [client])

  const loadMore = useCallback(async (loadMoreRow: BomRow) => {
    if (!loadMoreRow.nextCursor) return

    setRows(prev => prev.map(r =>
      r.id === loadMoreRow.id ? { ...r, isLoading: true } : r
    ))

    try {
      const { data } = await client.query<any>({
        query: GET_COMPONENT_BOM_CHILDREN,
        variables: {
          componentId: loadMoreRow.componentId,
          state: loadMoreRow.componentState ?? undefined,
          pagination: { cursor: loadMoreRow.nextCursor, limit: 50 },
        },
        fetchPolicy: 'network-only',
      })

      const relations: any[] = data?.component?.bomRelations?.results ?? []
      const nextCursor: string | null = data?.component?.bomRelations?.pagination?.cursor ?? null
      const parentRowId = loadMoreRow.parentRowId!
      const parentDepth = loadMoreRow.depth - 1

      const newChildRows = sortBySequence(relations).map(rel =>
        mapRelationToRow(rel, parentDepth + 1, parentRowId)
      )

      setRows(prev => {
        const loadMoreIdx = prev.findIndex(r => r.id === loadMoreRow.id)
        if (loadMoreIdx === -1) return prev

        // Build replacement: new children + optional new load-more sentinel
        const syntheticParent: BomRow = {
          ...loadMoreRow,
          id: parentRowId,
          depth: parentDepth,
        }
        const nextLoadMore = nextCursor ? [makeLoadMoreRow(syntheticParent, nextCursor)] : []

        const next = [...prev]
        next.splice(loadMoreIdx, 1, ...newChildRows, ...nextLoadMore)
        return next
      })
    } catch (err: any) {
      setRows(prev => prev.map(r =>
        r.id === loadMoreRow.id ? { ...r, isLoading: false } : r
      ))
      console.error('Failed to load more BOM rows:', err)
    }
  }, [client])

  return { rows, loading, error, toggleRow, loadMore }
}
