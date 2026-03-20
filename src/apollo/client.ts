import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { typePolicies, possibleTypes } from './typePolicies'
import { createLoggingLink } from './loggingLink'
import type { QueryLogEntry } from '../context/QueryLogContext'

export function createApolloClient(getAccessToken: () => Promise<string>, addLogEntry: (entry: QueryLogEntry) => void) {
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
    cache: new InMemoryCache({ typePolicies, possibleTypes }),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-first' },
      query:      { fetchPolicy: 'cache-first' },
    },
  })
}
