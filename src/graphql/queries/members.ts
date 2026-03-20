import { gql } from '@apollo/client'

export const GET_HUB_MEMBERS = gql`
  query GetHubMembers($hubId: ID!, $cursor: String) {
    hub(hubId: $hubId) {
      id
      members(pagination: { cursor: $cursor, limit: 50 }) {
        pagination { cursor pageSize }
        results {
          role
          status
          isProjectCreator
          avatarUrl
          displayName
          user {
            id
            email
            firstName
            lastName
            userName
          }
        }
      }
    }
  }
`

export const GET_PROJECT_MEMBERS = gql`
  query GetProjectMembers($projectId: ID!, $cursor: String) {
    project(projectId: $projectId) {
      id
      members(pagination: { cursor: $cursor, limit: 50 }) {
        pagination { cursor pageSize }
        results {
          role
          status
          avatarUrl
          displayName
          user {
            id
            email
            firstName
            lastName
            userName
          }
        }
      }
    }
  }
`

export const GET_FOLDER_MEMBERS = gql`
  query GetFolderMembers($folderId: ID!, $projectId: ID!, $cursor: String) {
    folder(folderId: $folderId, projectId: $projectId) {
      id
      members(pagination: { cursor: $cursor, limit: 50 }) {
        pagination { cursor pageSize }
        results {
          role
          status
          avatarUrl
          displayName
          user {
            id
            email
            firstName
            lastName
            userName
          }
        }
      }
    }
  }
`
