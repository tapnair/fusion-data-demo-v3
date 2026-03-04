import { gql } from '@apollo/client/core'

export const GET_FOLDERS_BY_PROJECT = gql`
  query GetFoldersByProject($projectId: ID!) {
    foldersByProject(projectId: $projectId) {
      results {
        id
        name
        path
        objectCount
        lastModifiedOn
      }
    }
  }
`

export const GET_FOLDERS_BY_FOLDER = gql`
  query GetFoldersByFolder($projectId: ID!, $folderId: ID!) {
    foldersByFolder(projectId: $projectId, folderId: $folderId) {
      results {
        id
        name
        path
        objectCount
        lastModifiedOn
      }
    }
  }
`

export const GET_FOLDER_DETAIL = gql`
  query GetFolderDetail($projectId: ID!, $folderId: ID!) {
    folder(projectId: $projectId, folderId: $folderId) {
      id
      name
      path
      objectCount
      createdOn
      createdBy { userName }
      lastModifiedOn
      lastModifiedBy { userName }
      fusionWebUrl
      parentFolder {
        id
        name
      }
      project {
        id
        name
      }
    }
  }
`
