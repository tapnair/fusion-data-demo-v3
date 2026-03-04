import { gql } from '@apollo/client/core'

export const GET_ROOT_COMPONENT_THUMBNAIL = gql`
  query GetRootComponentThumbnail($componentId: ID!) {
    component(componentId: $componentId, composition: WORKING) {
      id
      thumbnail {
        id
        status
        signedUrl
      }
    }
  }
`

export const GET_COMPONENT_THUMBNAIL = gql`
  query GetComponentThumbnail($componentId: ID!, $state: String) {
    component(componentId: $componentId, state: $state) {
      id
      thumbnail {
        id
        status
        signedUrl
      }
    }
  }
`
