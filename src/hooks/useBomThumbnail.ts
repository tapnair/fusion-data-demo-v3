import { useState, useEffect } from 'react'
import { useQuery } from '@apollo/client/react'
import { GET_ROOT_COMPONENT_THUMBNAIL, GET_COMPONENT_THUMBNAIL } from '../graphql/queries/thumbnail'

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
  const isRoot = componentState === null

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

  return { loading, error, status, signedUrl }
}
