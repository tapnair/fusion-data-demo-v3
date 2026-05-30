import { gql } from '@apollo/client'

export const GET_VIEWER_COMPONENT = gql`
  query GetViewerComponent($modelId: ID!) {
    model(modelId: $modelId) {
      id
      component {
        id
        name { displayValue }
        partNumber { displayValue }
        description { displayValue }
        materialName { displayValue }
      }
    }
  }
`
