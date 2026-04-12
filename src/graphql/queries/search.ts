import { gql } from '@apollo/client/core'

export const SEARCH_BY_HUB = gql`
  query SearchByHub($hubId: ID!, $searchCriteria: SearchInput, $pagination: PaginationInput) {
    searchByHub(hubId: $hubId, searchCriteria: $searchCriteria, pagination: $pagination) {
      pagination { cursor pageSize }
      results {
        name
        score
        thumbnail { signedUrl }
        matches {
          matchedPropertyId
          matchedText
        }
        searchResultObject {
          __typename
          ... on Component {
            id
            nameProp: name { value }
            partNumber { value }
            description { value }
            materialNameProp: materialName { value }
            componentState
            primaryModel {
              id
              designItem {
                id
                hub { id }
                parentFolder { id }
              }
            }
          }
          ... on Folder {
            id
            name
            hub { id }
            parentFolder { id }
            path
            objectCount
          }
          ... on DesignItem {
            id
            name
            hub { id }
            parentFolder { id }
            mimeType
            size
          }
          ... on DrawingItem {
            id
            name
            hub { id }
            parentFolder { id }
            mimeType
            size
          }
          ... on BasicItem {
            id
            name
            hub { id }
            parentFolder { id }
            mimeType
            size
          }
          ... on ConfiguredDesignItem {
            id
            name
            hub { id }
            parentFolder { id }
            mimeType
            size
          }
          ... on Model {
            id
            modelName: name { value }
            modelMaterialName: materialName { value }
            timestamp
            designItem {
              id
              hub { id }
              parentFolder { id }
            }
          }
        }
      }
    }
  }
`

export const GET_SEARCHABLE_PROPERTIES = gql`
  query GetSearchablePropertiesByHub($hubId: ID!, $pagination: PaginationInput) {
    searchablePropertiesByHub(hubId: $hubId, pagination: $pagination) {
      pagination { cursor pageSize }
      results {
        displayName
        propertyOrder
        propertyDefinition {
          id
          name
          specification
          units { name }
        }
      }
    }
  }
`
