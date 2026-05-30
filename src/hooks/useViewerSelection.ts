import { useState, useEffect, useCallback } from 'react'
import type {
  ViewerSelection,
  ViewerProperty,
  HierarchyNode,
} from '../types/viewerSelection.types'

function mapProps(props: Autodesk.Viewing.Property[]): ViewerProperty[] {
  return props.map((p) => ({
    attributeName: p.attributeName,
    displayCategory: p.displayCategory ?? 'Other',
    displayName: p.displayName,
    displayValue: p.displayValue,
    units: p.units ?? null,
    hidden: p.hidden ?? false,
    type: p.type,
  }))
}

function extractModelId(props: ViewerProperty[]): string | null {
  const prop = props.find((p) => p.attributeName === 'modelId')
  return prop && typeof prop.displayValue === 'string' ? prop.displayValue : null
}

export function useViewerSelection(
  viewerRef: React.RefObject<Autodesk.Viewing.GuiViewer3D | null>,
  viewerInitialized: boolean
): {
  selection: ViewerSelection | null
  selectByDbId: (dbId: number) => void
} {
  const [selection, setSelection] = useState<ViewerSelection | null>(null)

  useEffect(() => {
    if (!viewerInitialized || !viewerRef.current) return

    const viewer = viewerRef.current

    function buildHierarchyPath(dbId: number): HierarchyNode[] {
      const data = viewer.model?.getData()
      if (!data?.instanceTree) return []
      const tree = data.instanceTree
      const path: HierarchyNode[] = []
      let cur = dbId
      while (cur !== 0) {
        const name = tree.getNodeName(cur)
        if (name && name.trim() !== '') {
          path.unshift({ dbId: cur, name })
        }
        if (cur === tree.getRootId()) break
        cur = tree.getNodeParentId(cur)
      }
      return path
    }

    function isComponent(dbId: number): boolean {
      const data = viewer.model?.getData()
      if (!data?.instanceTree) return false
      return data.instanceTree.getChildCount(dbId) > 0
    }

    function getParentDbId(dbId: number): number | null {
      const data = viewer.model?.getData()
      if (!data?.instanceTree) return null
      const tree = data.instanceTree
      const parentId = tree.getNodeParentId(dbId)
      if (!parentId || parentId <= 0 || parentId === tree.getRootId()) return null
      return parentId
    }

    function onSelectionChanged(event: any) {
      const dbIds: number[] = event.dbIdArray ?? []
      if (dbIds.length === 0) {
        setSelection(null)
        return
      }

      const picked = dbIds[0]
      const pickedIsComponent = isComponent(picked)

      if (pickedIsComponent) {
        viewer.getProperties(
          picked,
          (result) => {
            const componentProperties = mapProps(result.properties)
            setSelection({
              componentDbId: picked,
              componentName: result.name ?? '',
              componentProperties,
              modelId: extractModelId(componentProperties),
              body: null,
              hierarchyPath: buildHierarchyPath(picked),
            })
          },
          () => setSelection(null)
        )
        return
      }

      // picked is a body (leaf)
      const parentDbId = getParentDbId(picked)

      if (parentDbId === null) {
        // body has no real parent component — degrade gracefully
        viewer.getProperties(
          picked,
          (result) => {
            const props = mapProps(result.properties)
            setSelection({
              componentDbId: picked,
              componentName: result.name ?? '',
              componentProperties: props,
              modelId: null,
              body: null,
              hierarchyPath: buildHierarchyPath(picked),
            })
          },
          () => setSelection(null)
        )
        return
      }

      viewer.getProperties(
        picked,
        (bodyResult) => {
          const bodyProperties = mapProps(bodyResult.properties)
          viewer.getProperties(
            parentDbId,
            (componentResult) => {
              const componentProperties = mapProps(componentResult.properties)
              setSelection({
                componentDbId: parentDbId,
                componentName: componentResult.name ?? '',
                componentProperties,
                modelId: extractModelId(componentProperties),
                body: {
                  dbId: bodyResult.dbId,
                  name: bodyResult.name ?? '',
                  externalId: bodyResult.externalId ?? '',
                  properties: bodyProperties,
                },
                hierarchyPath: buildHierarchyPath(parentDbId),
              })
            },
            () => {
              // Parent fetch failed — degrade to body-only view
              setSelection({
                componentDbId: picked,
                componentName: bodyResult.name ?? '',
                componentProperties: bodyProperties,
                modelId: null,
                body: null,
                hierarchyPath: buildHierarchyPath(picked),
              })
            }
          )
        },
        () => setSelection(null)
      )
    }

    viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, onSelectionChanged)

    return () => {
      viewer.removeEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, onSelectionChanged)
    }
  }, [viewerInitialized, viewerRef])

  const selectByDbId = useCallback((dbId: number) => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.select([dbId])
    if (typeof viewer.fitToView === 'function') {
      viewer.fitToView([dbId])
    }
  }, [viewerRef])

  return { selection, selectByDbId }
}
