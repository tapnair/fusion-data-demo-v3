/**
 * useApi Hook
 * General purpose hook for API operations
 */

import { APSService } from '../services/api/apsService'
import { useAuth } from '../context/AuthContext'
import { useMemo } from 'react'

export function useApi() {
  const { getAccessToken } = useAuth()

  const apsService = useMemo(
    () => new APSService(getAccessToken),
    [getAccessToken]
  )

  return {
    apsService,
  }
}
