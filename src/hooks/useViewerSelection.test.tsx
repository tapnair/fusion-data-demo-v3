import { useRef } from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useViewerSelection } from './useViewerSelection'

const SELECTION_CHANGED = 'selection-changed-event'
const GEOMETRY_LOADED = 'geometry-loaded-event'

beforeEach(() => {
  ;(globalThis as any).Autodesk = {
    Viewing: {
      SELECTION_CHANGED_EVENT: SELECTION_CHANGED,
      GEOMETRY_LOADED_EVENT: GEOMETRY_LOADED,
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
          enumNodeChildren: (id: number, cb: (child: number) => void) => {
            Object.entries(opts.tree).forEach(([childIdStr, node]) => {
              if (node.parentId === id) cb(Number(childIdStr))
            })
          },
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
            { attributeName: 'lineageUrn', displayValue: 'urn:adsk.wipprod:dm.lineage:test-1', displayCategory: '', displayName: 'lineageUrn', type: 20, units: null, hidden: true },
            { attributeName: 'f3dComponentId', displayValue: 'uuid-1', displayCategory: '', displayName: 'f3dComponentId', type: 20, units: null, hidden: true },
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
    expect(result.current.selection!.componentLineageUrn).toBe('urn:adsk.wipprod:dm.lineage:test-1')
    expect(result.current.selection!.componentF3dId).toBe('uuid-1')
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
            { attributeName: 'lineageUrn', displayValue: 'urn:adsk.wipprod:dm.lineage:test-2', displayCategory: '', displayName: 'lineageUrn', type: 20, units: null, hidden: true },
            { attributeName: 'f3dComponentId', displayValue: 'uuid-2', displayCategory: '', displayName: 'f3dComponentId', type: 20, units: null, hidden: true },
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
    expect(result.current.selection!.componentLineageUrn).toBe('urn:adsk.wipprod:dm.lineage:test-2')
    expect(result.current.selection!.componentF3dId).toBe('uuid-2')
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

  it('populates rootSelection on GEOMETRY_LOADED_EVENT', async () => {
    const { viewer, fire } = buildMockViewer({
      rootId: 1,
      tree: {
        1: { name: 'Espresso Machine v1', parentId: 0, childCount: 1 },
      },
      properties: {
        1: {
          name: 'Espresso Machine v1',
          properties: [
            {
              attributeName: 'modelId',
              displayValue: 'root-mid-xyz',
              displayCategory: '',
              displayName: 'modelId',
              type: 20,
              units: null,
              hidden: true,
            },
            {
              attributeName: 'lineageUrn',
              displayValue: 'urn:adsk.wipprod:dm.lineage:test-3',
              displayCategory: '',
              displayName: 'lineageUrn',
              type: 20,
              units: null,
              hidden: true,
            },
            {
              attributeName: 'f3dComponentId',
              displayValue: 'uuid-3',
              displayCategory: '',
              displayName: 'f3dComponentId',
              type: 20,
              units: null,
              hidden: true,
            },
          ],
        },
      },
    })

    const { result } = renderSelectionHook(viewer)

    expect(result.current.rootSelection).toBeNull()

    await act(async () => {
      fire(GEOMETRY_LOADED, {})
    })

    expect(result.current.rootSelection).not.toBeNull()
    expect(result.current.rootSelection!.componentDbId).toBe(1)
    expect(result.current.rootSelection!.componentName).toBe('Espresso Machine v1')
    expect(result.current.rootSelection!.body).toBeNull()
    expect(result.current.rootSelection!.modelId).toBe('root-mid-xyz')
    expect(result.current.rootSelection!.componentLineageUrn).toBe('urn:adsk.wipprod:dm.lineage:test-3')
    expect(result.current.rootSelection!.componentF3dId).toBe('uuid-3')
    expect(result.current.rootSelection!.hierarchyPath).toEqual([
      { dbId: 1, name: 'Espresso Machine v1' },
    ])
  })

  it('walks past a wrapper root that has no modelId to find a child that does', async () => {
    const { viewer, fire } = buildMockViewer({
      rootId: 1,
      tree: {
        1: { name: 'Controls v1', parentId: 0, childCount: 1 },
        2: { name: 'Controls v1:1', parentId: 1, childCount: 1 },
        3: { name: 'Body1', parentId: 2, childCount: 0 },
      },
      properties: {
        1: { name: 'Controls v1', properties: [] },
        2: {
          name: 'Controls v1:1',
          properties: [
            {
              attributeName: 'modelId',
              displayValue: 'top-component-mid',
              displayCategory: '',
              displayName: 'modelId',
              type: 20,
              units: null,
              hidden: true,
            },
            {
              attributeName: 'lineageUrn',
              displayValue: 'urn:adsk.wipprod:dm.lineage:test-4',
              displayCategory: '',
              displayName: 'lineageUrn',
              type: 20,
              units: null,
              hidden: true,
            },
            {
              attributeName: 'f3dComponentId',
              displayValue: 'uuid-4',
              displayCategory: '',
              displayName: 'f3dComponentId',
              type: 20,
              units: null,
              hidden: true,
            },
          ],
        },
      },
    })

    const { result } = renderSelectionHook(viewer)

    await act(async () => {
      fire(GEOMETRY_LOADED, {})
    })

    expect(result.current.rootSelection).not.toBeNull()
    expect(result.current.rootSelection!.componentDbId).toBe(2)
    expect(result.current.rootSelection!.componentName).toBe('Controls v1:1')
    expect(result.current.rootSelection!.modelId).toBe('top-component-mid')
    expect(result.current.rootSelection!.componentLineageUrn).toBe('urn:adsk.wipprod:dm.lineage:test-4')
    expect(result.current.rootSelection!.componentF3dId).toBe('uuid-4')
  })

  it('keeps rootSelection independent of selection when a body is picked', async () => {
    const { viewer, fire } = buildMockViewer({
      rootId: 1,
      tree: {
        1: { name: 'Espresso Machine v1', parentId: 0, childCount: 1 },
        2: { name: 'Top Asm', parentId: 1, childCount: 1 },
        4: { name: 'Main Shell', parentId: 2, childCount: 1 },
        5: { name: 'Body1', parentId: 4, childCount: 0 },
      },
      properties: {
        1: {
          name: 'Espresso Machine v1',
          properties: [
            {
              attributeName: 'modelId',
              displayValue: 'root-mid-xyz',
              displayCategory: '',
              displayName: 'modelId',
              type: 20,
              units: null,
              hidden: true,
            },
            {
              attributeName: 'lineageUrn',
              displayValue: 'urn:adsk.wipprod:dm.lineage:test-5-root',
              displayCategory: '',
              displayName: 'lineageUrn',
              type: 20,
              units: null,
              hidden: true,
            },
            {
              attributeName: 'f3dComponentId',
              displayValue: 'uuid-5-root',
              displayCategory: '',
              displayName: 'f3dComponentId',
              type: 20,
              units: null,
              hidden: true,
            },
          ],
        },
        5: { name: 'Body1', properties: [] },
        4: {
          name: 'Main Shell:1',
          properties: [
            {
              attributeName: 'modelId',
              displayValue: 'mid-abc',
              displayCategory: '',
              displayName: 'modelId',
              type: 20,
              units: null,
              hidden: true,
            },
            {
              attributeName: 'lineageUrn',
              displayValue: 'urn:adsk.wipprod:dm.lineage:test-5-shell',
              displayCategory: '',
              displayName: 'lineageUrn',
              type: 20,
              units: null,
              hidden: true,
            },
            {
              attributeName: 'f3dComponentId',
              displayValue: 'uuid-5-shell',
              displayCategory: '',
              displayName: 'f3dComponentId',
              type: 20,
              units: null,
              hidden: true,
            },
          ],
        },
      },
    })

    const { result } = renderSelectionHook(viewer)

    await act(async () => {
      fire(GEOMETRY_LOADED, {})
    })

    expect(result.current.rootSelection!.componentDbId).toBe(1)
    expect(result.current.selection).toBeNull()

    act(() => {
      fire(SELECTION_CHANGED, { dbIdArray: [5] })
    })

    expect(result.current.selection).not.toBeNull()
    expect(result.current.selection!.componentDbId).toBe(4)
    expect(result.current.selection!.componentName).toBe('Main Shell:1')
    expect(result.current.selection!.componentLineageUrn).toBe('urn:adsk.wipprod:dm.lineage:test-5-shell')
    expect(result.current.selection!.componentF3dId).toBe('uuid-5-shell')
    expect(result.current.selection!.body).toEqual({
      dbId: 5,
      name: 'Body1',
      externalId: 'ext-5',
      properties: [],
    })

    expect(result.current.rootSelection).not.toBeNull()
    expect(result.current.rootSelection!.componentDbId).toBe(1)
    expect(result.current.rootSelection!.componentName).toBe('Espresso Machine v1')
    expect(result.current.rootSelection!.modelId).toBe('root-mid-xyz')
    expect(result.current.rootSelection!.componentLineageUrn).toBe('urn:adsk.wipprod:dm.lineage:test-5-root')
    expect(result.current.rootSelection!.componentF3dId).toBe('uuid-5-root')
  })
})
