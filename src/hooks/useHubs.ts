/**
 * useHubs Hook
 * Fetches and manages user hubs from Manufacturing Data Model API
 */

import { useState, useEffect, useCallback } from 'react'
import { MfgDataModelClient } from '../services/api/mfgDataModelClient'
import { useAuth } from '../context/AuthContext'
import type { Hub } from '../types/hub.types'

export function useHubs() {
  const { getAccessToken, isAuthenticated } = useAuth()
  const [hubs, setHubs] = useState<Hub[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchHubs = useCallback(async () => {
    if (!isAuthenticated) {
      console.log('⏸️ Not authenticated, skipping hub fetch')
      return
    }

    console.log('🔄 Fetching hubs...')
    setLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      console.log('🔑 Access token obtained:', token.substring(0, 20) + '...')

      const client = new MfgDataModelClient({
        graphqlEndpoint: import.meta.env.VITE_GRAPHQL_ENDPOINT,
        getAccessToken,
      })

      console.log('📡 Calling getHubs API...')
      const response = await client.getHubs()
      console.log('✅ Hubs response:', response)

      setHubs(response.hubs.results)
      console.log(`✅ Loaded ${response.hubs.results.length} hubs`)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch hubs')
      setError(error)
      console.error('❌ Error fetching hubs:', {
        message: error.message,
        stack: error.stack,
        fullError: err,
      })
    } finally {
      setLoading(false)
    }
  }, [getAccessToken, isAuthenticated])

  // Auto-fetch hubs when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchHubs()
    }
  }, [isAuthenticated, fetchHubs])

  return {
    hubs,
    loading,
    error,
    refetch: fetchHubs,
  }
}
