import { gql } from '@apollo/client/core'

export const GET_HUB_BASE_PROPERTY_DEFINITIONS = gql`
  query GetHubBasePropertyDefinitions($hubId: ID!) {
    hub(hubId: $hubId) {
      id
      basePropertyDefinitionCollections {
        results {
          id
          name
          definitions {
            results {
              id
              name
              specification
              units { id name }
              isHidden
              isArchived
              isReadOnly
              propertyBehavior
            }
          }
        }
      }
    }
  }
`

export const GET_ROOT_COMPONENT_BASE_PROPERTIES = gql`
  query GetRootComponentBaseProperties($componentId: ID!) {
    component(componentId: $componentId, composition: WORKING) {
      id
      baseProperties {
        results {
          name
          displayValue
          value
          definition { id }
        }
      }
    }
  }
`

export const GET_COMPONENT_BASE_PROPERTIES = gql`
  query GetComponentBaseProperties($componentId: ID!, $state: String!) {
    component(componentId: $componentId, state: $state) {
      id
      baseProperties {
        results {
          name
          displayValue
          value
          definition { id }
        }
      }
    }
  }
`
