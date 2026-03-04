import { gql } from '@apollo/client/core'

export const GET_ITEM_BOM = gql`
  query GetItemBom($hubId: ID!, $itemId: ID!, $pagination: PaginationInput) {
    item(hubId: $hubId, itemId: $itemId) {
      __typename
      ... on DesignItem {
        tipRootModel {
          component {
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
