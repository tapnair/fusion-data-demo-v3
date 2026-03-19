import { useState, useEffect } from 'react'
import type { ViewerSelection, ViewerProperty } from '../types/viewerSelection.types'

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

export function useViewerSelection(
  viewerRef: React.RefObject<Autodesk.Viewing.GuiViewer3D | null>,
  viewerInitialized: boolean
): { selection: ViewerSelection | null } {
  const [selection, setSelection] = useState<ViewerSelection | null>(null)

  useEffect(() => {
    if (!viewerInitialized || !viewerRef.current) return

    const viewer = viewerRef.current

    function buildHierarchyPath(dbId: number): string[] {
      const data = viewer.model?.getData()
      if (!data?.instanceTree) return []
      const tree = data.instanceTree
      const path: string[] = []
      let cur = dbId
      while (cur !== 0) {
        path.unshift(tree.getNodeName(cur))
        if (cur === tree.getRootId()) break
        cur = tree.getNodeParentId(cur)
      }
      return path
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

      const dbId = dbIds[0]
      const parentDbId = getParentDbId(dbId)

      viewer.getProperties(
        dbId,
        (bodyResult) => {
          const base = {
            dbId: bodyResult.dbId,
            name: bodyResult.name ?? '',
            externalId: bodyResult.externalId ?? '',
            hierarchyPath: buildHierarchyPath(dbId),
            properties: mapProps(bodyResult.properties),
          }

          if (parentDbId === null) {
            setSelection({ ...base, parentDbId: null, parentName: '', parentProperties: [] })
            return
          }

          viewer.getProperties(
            parentDbId,
            (componentResult) => {
              setSelection({
                ...base,
                parentDbId,
                parentName: componentResult.name ?? '',
                parentProperties: mapProps(componentResult.properties),
              })
            },
            () => {
              // Parent fetch failed — show body only
              setSelection({ ...base, parentDbId: null, parentName: '', parentProperties: [] })
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

  return { selection }
}
