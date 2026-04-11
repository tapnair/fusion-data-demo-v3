import { ApolloLink, Observable } from '@apollo/client/core'
import type { FetchResult } from '@apollo/client/core'
import { print } from 'graphql'
import type { QueryLogEntry } from '../context/QueryLogContext'

export function createLoggingLink(
  addEntry: (entry: QueryLogEntry) => void
): ApolloLink {
  return new ApolloLink((operation, forward) => {
    const startTime = Date.now()
    const { operationName, variables, query } = operation
    const opDef = query.definitions[0] as any
    const opType: string = opDef?.operation ?? 'query'
    const name = operationName ?? 'Anonymous'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Observable<FetchResult>((observer: any) => {
      const sub = forward(operation).subscribe({
        next: (response: FetchResult) => {
          addEntry({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            operationName: name,
            operationType: opType,
            isIntrospection: name === 'IntrospectionQuery',
            query: print(query),
            variables: variables ?? {},
            response: response.data ?? null,
            errors: response.errors ? [...response.errors] : null,
            durationMs: Date.now() - startTime,
          })
          observer.next(response)
        },
        error: (err: Error) => observer.error(err),
        complete: () => observer.complete(),
      })
      return () => sub.unsubscribe()
    })
  })
}
