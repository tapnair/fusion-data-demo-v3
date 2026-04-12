import { useState, useEffect, useRef } from 'react'
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
  const isRoot = componentState === null

  // Step 1: Check IndexedDB on mount and revoke objectUrl on unmount
  useEffect(() => {
    let cancelled = false
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

  // Step 3: Fetch blob when signedUrl is available and we don't already have a cached blob
  useEffect(() => {
    if (!signedUrl || objectUrl || fetchedRef.current) return
    fetchedRef.current = true
    fetch(signedUrl)
      .then(r => r.blob())
      .then(blob => {
        setThumbnailBlob(componentId, blob).catch(console.error)
        const url = URL.createObjectURL(blob)
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = url
        setObjectUrl(url)
      })
      .catch(console.error)
  }, [signedUrl, componentId, objectUrl])

  return { loading, error, status, signedUrl, objectUrl }
}
