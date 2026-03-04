import { useQuery } from '@apollo/client/react'
import { useAuth } from '../context/AuthContext'
import { GET_HUBS } from '../graphql/queries/hubs'
import type { Hub } from '../types/hub.types'

export function useHubs() {
  const { isAuthenticated } = useAuth()
  const { data, loading, error, refetch } = useQuery<any>(GET_HUBS, {
    skip: !isAuthenticated,
  })

  return {
    hubs: (data?.hubs?.results ?? []) as Hub[],
    loading,
    error: error ?? null,
    refetch,
  }
}
