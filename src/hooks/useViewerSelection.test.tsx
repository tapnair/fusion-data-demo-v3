import { useRef } from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useViewerSelection } from './useViewerSelection'

const SELECTION_CHANGED = 'selection-changed-event'

beforeEach(() => {
  ;(globalThis as any).Autodesk = {
    Viewing: {
      SELECTION_CHANGED_EVENT: SELECTION_CHANGED,
    },
  }
})

interface TreeNode {
  name: string
  parentId: number
  childCount: number
}

function buildMockViewer(opts: {
  tree: Record<number, TreeNode>
  rootId: number
  properties: Record<number, { name: string; externalId?: string; properties: any[] }>
  parentFetchFails?: Set<number>
  bodyFetchFails?: Set<number>
}) {
  const listeners = new Map<string, ((event: any) => void)[]>()
  const selectCalls: number[][] = []
  const fitToViewCalls: number[][] = []

  const viewer: any = {
    addEventListener: (event: string, cb: (e: any) => void) => {
      const arr = listeners.get(event) ?? []
      arr.push(cb)
      listeners.set(event, arr)
    },
    removeEventListener: (event: string, cb: (e: any) => void) => {
      const arr = listeners.get(event) ?? []
      listeners.set(
        event,
        arr.filter((x) => x !== cb)
      )
    },
    select: (ids: number[]) => {
      selectCalls.push(ids)
    },
    fitToView: (ids?: number[]) => {
      fitToViewCalls.push(ids ?? [])
    },
    getProperties: (
      dbId: number,
      onSuccess: (r: any) => void,
      onError?: (code: number, msg: string) => void
    ) => {
      if (opts.bodyFetchFails?.has(dbId) || opts.parentFetchFails?.has(dbId)) {
        onError?.(500, 'mock error')
        return
      }
      const p = opts.properties[dbId]
      if (!p) {
        onError?.(404, 'not found')
        return
      }
      onSuccess({
        dbId,
        externalId: p.externalId ?? `ext-${dbId}`,
        name: p.name,
        properties: p.properties,
      })
    },
    model: {
      getData: () => ({
        instanceTree: {
          getRootId: () => opts.rootId,
          getNodeName: (id: number) => opts.tree[id]?.name ?? '',
          getNodeParentId: (id: number) => opts.tree[id]?.parentId ?? 0,
          getChildCount: (id: number) => opts.tree[id]?.childCount ?? 0,
        },
      }),
    },
  }

  return {
    viewer,
    fire(event: string, payload: any) {
      const arr = listeners.get(event) ?? []
      arr.forEach((cb) => cb(payload))
    },
    selectCalls,
    fitToViewCalls,
  }
}

function renderSelectionHook(viewer: any) {
  return renderHook(() => {
    const ref = useRef(viewer)
    return useViewerSelection(ref, true)
  })
}

describe('useViewerSelection', () => {
  it('treats a body pick (leaf) as picking its parent component', () => {
    const { viewer, fire } = buildMockViewer({
      rootId: 1,
      tree: {
        1: { name: 'Model', parentId: 0, childCount: 1 },
        2: { name: 'Top Asm', parentId: 1, childCount: 1 },
        4: { name: 'Main Shell', parentId: 2, childCount: 1 },
        5: { name: 'Body1', parentId: 4, childCount: 0 },
      },
      properties: {
        5: { name: 'Body1', properties: [] },
        4: {
          name: 'Main Shell:1',
          properties: [
            { attributeName: 'modelId', displayValue: 'mid-abc', displayCategory: '', displayName: 'modelId', type: 20, units: null, hidden: true },
          ],
        },
      },
    })

    const { result } = renderSelectionHook(viewer)

    act(() => {
      fire(SELECTION_CHANGED, { dbIdArray: [5] })
    })

    expect(result.current.selection).not.toBeNull()
    expect(result.current.selection!.componentDbId).toBe(4)
    expect(result.current.selection!.componentName).toBe('Main Shell:1')
    expect(result.current.selection!.modelId).toBe('mid-abc')
    expect(result.current.selection!.body).toEqual({
      dbId: 5,
      name: 'Body1',
      externalId: 'ext-5',
      properties: [],
    })
    expect(result.current.selection!.hierarchyPath.map((n) => n.dbId)).toEqual([1, 2, 4])
  })

  it('treats a component pick (non-leaf) as the component itself, with no body', () => {
    const { viewer, fire } = buildMockViewer({
      rootId: 1,
      tree: {
        1: { name: 'Model', parentId: 0, childCount: 1 },
        2: { name: 'Top Asm', parentId: 1, childCount: 2 },
      },
      properties: {
        2: {
          name: 'Top Asm:1',
          properties: [
            { attributeName: 'modelId', displayValue: 'top-mid', displayCategory: '', displayName: 'modelId', type: 20, units: null, hidden: true },
          ],
        },
      },
    })

    const { result } = renderSelectionHook(viewer)

    act(() => {
      fire(SELECTION_CHANGED, { dbIdArray: [2] })
    })

    expect(result.current.selection!.componentDbId).toBe(2)
    expect(result.current.selection!.componentName).toBe('Top Asm:1')
    expect(result.current.selection!.modelId).toBe('top-mid')
    expect(result.current.selection!.body).toBeNull()
    expect(result.current.selection!.hierarchyPath.map((n) => n.dbId)).toEqual([1, 2])
  })

  it('degrades when a picked body has no real parent component', () => {
    const { viewer, fire } = buildMockViewer({
      rootId: 1,
      tree: {
        1: { name: 'Model', parentId: 0, childCount: 1 },
        5: { name: 'Floating Body', parentId: 1, childCount: 0 },
      },
      properties: {
        5: { name: 'Floating Body', properties: [] },
      },
    })

    const { result } = renderSelectionHook(viewer)

    act(() => {
      fire(SELECTION_CHANGED, { dbIdArray: [5] })
    })

    expect(result.current.selection!.componentDbId).toBe(5)
    expect(result.current.selection!.modelId).toBeNull()
    expect(result.current.selection!.body).toBeNull()
  })

  it('clears the selection when the event has no dbIds', () => {
    const { viewer, fire } = buildMockViewer({
      rootId: 1,
      tree: { 1: { name: 'Model', parentId: 0, childCount: 0 } },
      properties: {},
    })

    const { result } = renderSelectionHook(viewer)

    act(() => {
      fire(SELECTION_CHANGED, { dbIdArray: [] })
    })

    expect(result.current.selection).toBeNull()
  })

  it('selectByDbId calls viewer.select and viewer.fitToView', () => {
    const { viewer, selectCalls, fitToViewCalls } = buildMockViewer({
      rootId: 1,
      tree: { 1: { name: 'Model', parentId: 0, childCount: 0 } },
      properties: {},
    })

    const { result } = renderSelectionHook(viewer)

    act(() => {
      result.current.selectByDbId(42)
    })

    expect(selectCalls).toEqual([[42]])
    expect(fitToViewCalls).toEqual([[42]])
  })

  it('selectByDbId skips fitToView gracefully when not available', () => {
    const { viewer, selectCalls } = buildMockViewer({
      rootId: 1,
      tree: { 1: { name: 'Model', parentId: 0, childCount: 0 } },
      properties: {},
    })
    // Older Viewer build: no fitToView
    viewer.fitToView = undefined

    const { result } = renderSelectionHook(viewer)

    act(() => {
      result.current.selectByDbId(7)
    })

    expect(selectCalls).toEqual([[7]])
  })

  it('falls back to body-only view when parent component fetch fails', () => {
    const { viewer, fire } = buildMockViewer({
      rootId: 1,
      tree: {
        1: { name: 'Model', parentId: 0, childCount: 1 },
        4: { name: 'Comp', parentId: 1, childCount: 1 },
        5: { name: 'Body1', parentId: 4, childCount: 0 },
      },
      properties: {
        5: { name: 'Body1', properties: [] },
      },
      parentFetchFails: new Set([4]),
    })

    const { result } = renderSelectionHook(viewer)

    act(() => {
      fire(SELECTION_CHANGED, { dbIdArray: [5] })
    })

    expect(result.current.selection!.componentDbId).toBe(5)
    expect(result.current.selection!.modelId).toBeNull()
    expect(result.current.selection!.body).toBeNull()
  })

  it('filters out empty-named segments from hierarchyPath', () => {
    const { viewer, fire } = buildMockViewer({
      rootId: 1,
      tree: {
        1: { name: 'Model', parentId: 0, childCount: 1 },
        2: { name: '', parentId: 1, childCount: 1 },
        4: { name: 'Main Shell', parentId: 2, childCount: 1 },
        5: { name: 'Body1', parentId: 4, childCount: 0 },
      },
      properties: {
        5: { name: 'Body1', properties: [] },
        4: { name: 'Main Shell:1', properties: [] },
      },
    })

    const { result } = renderSelectionHook(viewer)

    act(() => {
      fire(SELECTION_CHANGED, { dbIdArray: [5] })
    })

    expect(result.current.selection!.hierarchyPath.map((n) => n.name)).toEqual([
      'Model',
      'Main Shell',
    ])
  })
})
