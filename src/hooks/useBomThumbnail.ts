import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@apollo/client/react'
import { GET_ROOT_COMPONENT_THUMBNAIL, GET_COMPONENT_THUMBNAIL } from '../graphql/queries/thumbnail'
import { getThumbnailBlob, setThumbnailBlob } from '../services/thumbnailImageCache'

export const WORKING_STATES = ['IN_PROGRESS', 'PENDING', 'TIMEOUT']

const POLL_MIN_MS = 10_000
const POLL_MAX_MS = 30_000

function randomPollInterval() {
  return Math.floor(Math.random() * (POLL_MAX_MS - POLL_MIN_MS) + POLL_MIN_MS)
}

export function useBomThumbnail(
  componentId: string,
  componentState: string | null,
  thumbnailGeneration: number = 0
) {
  const [pollInterval, setPollInterval] = useState(0)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const fetchedRef = useRef(false)
  const refetchedOnceRef = useRef(false)
  const isRoot = componentState === null

  // Step 1: Check IndexedDB on mount and revoke objectUrl on unmount.
  // Also resets transient state whenever the componentId changes so we never
  // render a revoked blob URL from a previous component, and so the signedUrl
  // fetch can re-fire for the new component.
  useEffect(() => {
    let cancelled = false
    setObjectUrl(null)
    fetchedRef.current = false
    refetchedOnceRef.current = false

    getThumbnailBlob(componentId).then(blob => {
      if (blob && !cancelled) {
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        setObjectUrl(url)
      }
    }).catch(() => {/* ignore IDB errors */})

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [componentId])

  // Step 2: Reset objectUrl when user forces a refresh
  useEffect(() => {
    if (thumbnailGeneration === 0) return
    fetchedRef.current = false
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setObjectUrl(null)
  }, [thumbnailGeneration])

  const { loading, error, data, refetch } = useQuery(
    isRoot ? GET_ROOT_COMPONENT_THUMBNAIL : GET_COMPONENT_THUMBNAIL,
    {
      variables: isRoot
        ? { componentId }
        : { componentId, state: componentState },
      fetchPolicy: 'cache-first',
      pollInterval,
    }
  )

  // Force a network re-fetch when the user clicks "Refresh Thumbnails"
  useEffect(() => {
    if (thumbnailGeneration === 0) return
    refetch()
  }, [thumbnailGeneration]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling state machine
  useEffect(() => {
    if (!data) return
    const status = (data as any)?.component?.thumbnail?.status
    if (!status) return
    if (WORKING_STATES.includes(status)) {
      setPollInterval(randomPollInterval())
    } else {
      setPollInterval(0)
    }
  }, [data])

  const anyData = data as any
  const thumbnail = anyData?.component?.thumbnail ?? null
  const status: string | null = thumbnail?.status ?? null
  const signedUrl: string | null = thumbnail?.signedUrl ?? null

  // Step 3: Fetch blob when signedUrl is available and we don't already have a
  // cached blob. On CORS failure (e.g. GitHub Pages or local dev — APS doesn't
  // send Access-Control-Allow-Origin), `fetch` rejects; we leave objectUrl null
  // so the cell falls back to `<img src={signedUrl}>` which DOES render across
  // origins. We still validate status + blob type so we never cache a 4xx HTML
  // body or other non-image content under the componentId.
  useEffect(() => {
    if (!signedUrl || objectUrl || fetchedRef.current) return
    fetchedRef.current = true
    fetch(signedUrl)
      .then(r => {
        if (!r.ok) throw new Error(`thumbnail fetch ${r.status}`)
        return r.blob()
      })
      .then(blob => {
        if (!blob.type.startsWith('image/') || blob.size < 200) {
          throw new Error('thumbnail response is not an image')
        }
        setThumbnailBlob(componentId, blob).catch(console.error)
        const url = URL.createObjectURL(blob)
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = url
        setObjectUrl(url)
      })
      .catch(() => {
        // CORS or genuine 4xx — leave objectUrl null; the cell falls back to
        // rendering the signedUrl directly via <img>, which works across CORS.
        fetchedRef.current = false
      })
  }, [signedUrl, componentId, objectUrl])

  // Refetch the GraphQL query for a fresh signedUrl, but only once per
  // componentId mount. Called by cells when their <img> onError fires —
  // the only reliable signal that the signedUrl is genuinely bad (vs
  // CORS-blocked but valid, which is indistinguishable from the JS fetch
  // perspective).
  const refetchOnce = useCallback(() => {
    if (refetchedOnceRef.current) return
    refetchedOnceRef.current = true
    refetch().catch(() => {/* ignore */})
  }, [refetch])

  return { loading, error, status, signedUrl, objectUrl, refetchOnce }
}
