export { MockedProvider } from '@apollo/client/testing'
import { InMemoryCache } from '@apollo/client/core'

export function createTestCache() {
  return new InMemoryCache()
}
