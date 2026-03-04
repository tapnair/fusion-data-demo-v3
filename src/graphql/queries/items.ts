import { gql } from '@apollo/client/core'

export const GET_ITEMS_BY_FOLDER = gql`
  query GetItemsByFolder($hubId: ID!, $folderId: ID!, $pagination: PaginationInput) {
    itemsByFolder(hubId: $hubId, folderId: $folderId, pagination: $pagination) {
      pagination {
        cursor
        pageSize
      }
      results {
        id
        name
        extensionType
        mimeType
        size
        lastModifiedOn
        createdOn
        ... on DesignItem {
          fusionWebUrl
        }
        ... on DrawingItem {
          fusionWebUrl
        }
      }
    }
  }
`

export const GET_ITEMS_BY_PROJECT = gql`
  query GetItemsByProject($projectId: ID!, $pagination: PaginationInput) {
    itemsByProject(projectId: $projectId, pagination: $pagination) {
      pagination {
        cursor
        pageSize
      }
      results {
        id
        name
        extensionType
        mimeType
        size
        lastModifiedOn
        createdOn
        ... on DesignItem {
          fusionWebUrl
        }
        ... on DrawingItem {
          fusionWebUrl
        }
      }
    }
  }
`

export const GET_ITEM_DETAIL = gql`
  query GetItemDetail($hubId: ID!, $itemId: ID!) {
    item(hubId: $hubId, itemId: $itemId) {
      __typename
      id
      name
      extensionType
      mimeType
      size
      createdOn
      createdBy { userName }
      lastModifiedOn
      lastModifiedBy { userName }
      parentFolder {
        id
        name
      }
      project {
        id
        name
      }
      ... on DesignItem {
        fusionWebUrl
        isConfiguration
        thumbnail {
          status
          signedUrl
        }
        tipRootModel {
          id
          timestamp
          component(composition: WORKING) {
            id
            name { value }
            partNumber { value }
            description { value }
          }
        }
      }
      ... on DrawingItem {
        fusionWebUrl
      }
    }
  }
`
