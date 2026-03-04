import { useState, useEffect } from 'react'
import { useQuery } from '@apollo/client/react'
import {
  GET_ROOT_COMPONENT_PHYSICAL_PROPERTIES,
  GET_COMPONENT_PHYSICAL_PROPERTIES,
} from '../graphql/queries/physicalProperties'

export const PHYSICAL_PROPS_WORKING_STATES = ['SCHEDULED', 'QUEUED', 'IN_PROGRESS']

const POLL_INTERVAL_MS = 3_000

export function useBomPhysicalProperties(
  componentId: string,
  componentState: string | null
) {
  const [pollInterval, setPollInterval] = useState(0)
  const isRoot = componentState === null

  const { loading, error, data } = useQuery(
    isRoot
      ? GET_ROOT_COMPONENT_PHYSICAL_PROPERTIES
      : GET_COMPONENT_PHYSICAL_PROPERTIES,
    {
      variables: isRoot
        ? { componentId }
        : { componentId, state: componentState },
      fetchPolicy: 'cache-first',
      pollInterval,
    }
  )

  useEffect(() => {
    if (!data) return
    const status = (data as any)?.component?.primaryModel?.physicalProperties?.status
    if (!status) return
    if (PHYSICAL_PROPS_WORKING_STATES.includes(status)) {
      setPollInterval(POLL_INTERVAL_MS)
    } else {
      setPollInterval(0)
    }
  }, [data])

  const physProps = (data as any)?.component?.primaryModel?.physicalProperties ?? null

  return { loading, error, physProps }
}
