import { gql } from '@apollo/client/core'

export const GET_ROOT_COMPONENT_BOM = gql`
  query GetRootComponentBom($componentId: ID!, $pagination: PaginationInput) {
    component(componentId: $componentId, composition: WORKING) {
      id
      name { value }
      partNumber { value }
      description { value }
      materialName { value }
      hasChildren
      bomRelations(depth: 1, pagination: $pagination) {
        pagination { cursor pageSize }
        results {
          id
          sequenceNumber
          quantityProperty { value }
          toComponentState
          toComponent {
            id
            name { value }
            partNumber { value }
            description { value }
            materialName { value }
            hasChildren
          }
        }
      }
    }
  }
`

export const GET_COMPONENT_BOM_CHILDREN = gql`
  query GetComponentBomChildren($componentId: ID!, $state: String, $pagination: PaginationInput) {
    component(componentId: $componentId, state: $state) {
      id
      bomRelations(depth: 1, pagination: $pagination) {
        pagination { cursor pageSize }
        results {
          id
          sequenceNumber
          quantityProperty { value }
          toComponentState
          toComponent {
            id
            name { value }
            partNumber { value }
            description { value }
            materialName { value }
            hasChildren
          }
        }
      }
    }
  }
`
