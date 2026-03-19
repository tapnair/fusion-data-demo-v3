import { useEffect, useRef, useState } from 'react'
import { loadViewerScripts } from '../services/viewer/loadViewerScripts'

export function useApsViewer(
  containerRef: React.RefObject<HTMLDivElement | null>,
  encodedUrn: string | null,
  isReady: boolean,
  getAccessToken: () => Promise<string>
): { viewerLoaded: boolean; viewerError: string | null; viewerRef: React.RefObject<Autodesk.Viewing.GuiViewer3D | null>; viewerInitialized: boolean } {
  // Keep viewer in a ref for imperative access, but mirror initialization
  // into state so Effect 3 re-fires when the viewer becomes available.
  const viewerRef = useRef<Autodesk.Viewing.GuiViewer3D | null>(null)
  const [scriptsLoaded, setScriptsLoaded] = useState(false)
  const [viewerInitialized, setViewerInitialized] = useState(false)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [viewerLoaded, setViewerLoaded] = useState(false)

  // Effect 1 — Load scripts (runs once on mount)
  useEffect(() => {
    loadViewerScripts()
      .then(() => setScriptsLoaded(true))
      .catch((e: Error) => setViewerError(e.message))
  }, [])

  // Effect 2 — Initialize viewer once scripts are loaded
  useEffect(() => {
    if (!scriptsLoaded || !containerRef.current || viewerRef.current) {
      return
    }

    const container = containerRef.current

    Autodesk.Viewing.Initializer(
      {
        env: 'AutodeskProduction2',
        api: 'streamingV2',
        getAccessToken: (onTokenReady) => {
          getAccessToken().then((token) => {
            onTokenReady(token, 3600)
          })
        },
      },
      () => {
        const newViewer = new Autodesk.Viewing.GuiViewer3D(container)
        const startCode = newViewer.start()

        if (startCode > 0) {
          setViewerError('WebGL not supported')
          return
        }

        newViewer.resize()
        newViewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
          setViewerLoaded(true)
        })

        viewerRef.current = newViewer
        // Flip state so Effect 3 re-evaluates — refs alone don't trigger re-renders
        setViewerInitialized(true)
      }
    )

    return () => {
      if (viewerRef.current) {
        viewerRef.current.finish()
        viewerRef.current = null
        Autodesk.Viewing.shutdown()
      }
    }
  }, [scriptsLoaded, containerRef]) // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 3 — Load document when BOTH viewer is initialized AND translation is ready.
  // Depends on `viewerInitialized` so it re-runs if the viewer finishes after isReady fires.
  useEffect(() => {
    if (!viewerInitialized || !viewerRef.current || !encodedUrn || !isReady) {
      return
    }

    setViewerLoaded(false)

    const viewer = viewerRef.current
    const documentId = 'urn:' + encodedUrn

    viewer.resize()

    Autodesk.Viewing.Document.load(
      documentId,
      (doc) => {
        const root = doc.getRoot()
        const viewables = root.search({ type: 'geometry' })

        if (!viewables || viewables.length === 0) {
          setViewerError('No viewable geometry found')
          return
        }

        viewer
          .loadDocumentNode(doc, viewables[0])
          .catch((e: unknown) => setViewerError(String(e)))
      },
      (_errCode: number, errMsg: string) => {
        setViewerError('Document load failed: ' + errMsg)
      }
    )
  }, [viewerInitialized, encodedUrn, isReady]) // eslint-disable-line react-hooks/exhaustive-deps

  return { viewerLoaded, viewerError, viewerRef, viewerInitialized }
}
