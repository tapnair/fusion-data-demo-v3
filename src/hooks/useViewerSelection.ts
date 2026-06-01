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

function extractAttribute(props: ViewerProperty[], name: string): string | null {
  const prop = props.find((p) => p.attributeName === name)
  return prop && typeof prop.displayValue === 'string' ? prop.displayValue : null
}

export function useViewerSelection(
  viewerRef: React.RefObject<Autodesk.Viewing.GuiViewer3D | null>,
  viewerInitialized: boolean
): {
  selection: ViewerSelection | null
  rootSelection: ViewerSelection | null
  selectByDbId: (dbId: number) => void
} {
  const [selection, setSelection] = useState<ViewerSelection | null>(null)
  const [rootSelection, setRootSelection] = useState<ViewerSelection | null>(null)

  useEffect(() => {
    if (!viewerInitialized || !viewerRef.current) {
      setSelection(null)
      setRootSelection(null)
      return
    }

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
              modelId: extractAttribute(componentProperties, 'modelId'),
              componentLineageUrn: extractAttribute(componentProperties, 'lineageUrn'),
              componentF3dId: extractAttribute(componentProperties, 'f3dComponentId'),
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
              componentLineageUrn: null,
              componentF3dId: null,
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
                modelId: extractAttribute(componentProperties, 'modelId'),
                componentLineageUrn: extractAttribute(componentProperties, 'lineageUrn'),
                componentF3dId: extractAttribute(componentProperties, 'f3dComponentId'),
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
                componentLineageUrn: null,
                componentF3dId: null,
                body: null,
                hierarchyPath: buildHierarchyPath(picked),
              })
            }
          )
        },
        () => setSelection(null)
      )
    }

    function fetchProps(dbId: number): Promise<{ name: string; props: ViewerProperty[] } | null> {
      return new Promise((resolve) => {
        viewer.getProperties(
          dbId,
          (result) => resolve({ name: result.name ?? '', props: mapProps(result.properties) }),
          () => resolve(null)
        )
      })
    }

    async function onGeometryLoaded() {
      const data = viewer.model?.getData()
      if (!data?.instanceTree) return
      const tree = data.instanceTree
      const rootDbId = tree.getRootId()

      // Fusion viewer trees often have a wrapper root node with no `modelId`
      // attribute; the top-level component (one level down) is the one that
      // carries it. Walk down BFS looking for the first node whose properties
      // include a `modelId`. Cap visits to avoid runaway on weird models.
      const MAX_VISITS = 10
      const queue: number[] = [rootDbId]
      let visits = 0
      let fallback: { dbId: number; name: string; props: ViewerProperty[] } | null = null

      while (queue.length > 0 && visits < MAX_VISITS) {
        const candidate = queue.shift()!
        visits++
        const fetched = await fetchProps(candidate)
        if (!fetched) continue
        if (fallback === null) {
          fallback = { dbId: candidate, name: fetched.name, props: fetched.props }
        }
        const modelId = extractAttribute(fetched.props, 'modelId')
        if (modelId !== null) {
          setRootSelection({
            componentDbId: candidate,
            componentName: fetched.name,
            componentProperties: fetched.props,
            modelId,
            componentLineageUrn: extractAttribute(fetched.props, 'lineageUrn'),
            componentF3dId: extractAttribute(fetched.props, 'f3dComponentId'),
            body: null,
            hierarchyPath: [{ dbId: candidate, name: fetched.name }],
          })
          return
        }
        tree.enumNodeChildren(candidate, (child) => queue.push(child))
      }

      if (fallback !== null) {
        setRootSelection({
          componentDbId: fallback.dbId,
          componentName: fallback.name,
          componentProperties: fallback.props,
          modelId: null,
          componentLineageUrn: extractAttribute(fallback.props, 'lineageUrn'),
          componentF3dId: extractAttribute(fallback.props, 'f3dComponentId'),
          body: null,
          hierarchyPath: [{ dbId: fallback.dbId, name: fallback.name }],
        })
      }
    }

    viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, onSelectionChanged)
    viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeometryLoaded)

    return () => {
      viewer.removeEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, onSelectionChanged)
      viewer.removeEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeometryLoaded)
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

  return { selection, rootSelection, selectByDbId }
}
