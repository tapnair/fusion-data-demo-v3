import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { typePolicies, possibleTypes } from './typePolicies'
import { createLoggingLink } from './loggingLink'
import type { QueryLogEntry } from '../context/QueryLogContext'

export function createCache(): InMemoryCache {
  return new InMemoryCache({ typePolicies, possibleTypes })
}

export function createApolloClient(
  cache: InMemoryCache,
  getAccessToken: () => Promise<string>,
  addLogEntry: (entry: QueryLogEntry) => void
) {
  const httpLink = new HttpLink({
    uri: import.meta.env.VITE_GRAPHQL_ENDPOINT,
  })

  const loggingLink = createLoggingLink(addLogEntry)

  const authLink = setContext(async (_, { headers }) => {
    const token = await getAccessToken()
    return {
      headers: {
        ...headers,
        authorization: `Bearer ${token}`,
      },
    }
  })

  return new ApolloClient({
    link: ApolloLink.from([authLink, loggingLink, httpLink]),
    cache,
    defaultOptions: {
      // cache-and-network: serve cached data instantly, then re-fetch in background.
      // Applies to useQuery / useLazyQuery (both use watchQuery internally).
      watchQuery: { fetchPolicy: 'cache-and-network' },
    },
  })
}
