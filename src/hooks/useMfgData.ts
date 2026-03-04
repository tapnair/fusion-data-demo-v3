/**
 * useMfgData Hook
 * Provides access to Manufacturing Data Model API operations
 */

import { useCallback } from 'react'
import { MfgDataModelClient } from '../services/api/mfgDataModelClient'
import { useAuth } from '../context/AuthContext'

export function useMfgData() {
  const { getAccessToken } = useAuth()

  const client = new MfgDataModelClient({
    graphqlEndpoint: import.meta.env.VITE_GRAPHQL_ENDPOINT,
    getAccessToken,
  })

  const getComponent = useCallback(
    async (componentId: string) => {
      try {
        return await client.getComponent(componentId)
      } catch (error) {
        console.error('Error fetching component:', error)
        throw error
      }
    },
    [client]
  )

  const getBOM = useCallback(
    async (componentId: string) => {
      try {
        return await client.getBOM(componentId)
      } catch (error) {
        console.error('Error fetching BOM:', error)
        throw error
      }
    },
    [client]
  )

  const searchComponents = useCallback(
    async (searchText: string, hubId: string) => {
      try {
        return await client.searchComponents(searchText, hubId)
      } catch (error) {
        console.error('Error searching components:', error)
        throw error
      }
    },
    [client]
  )

  return {
    getComponent,
    getBOM,
    searchComponents,
  }
}
