import { gql } from '@apollo/client/core'

export const GET_PROJECTS = gql`
  query GetProjects($hubId: ID!) {
    projects(hubId: $hubId) {
      results {
        id
        name
        thumbnailUrl
        fusionWebUrl
        alternativeIdentifiers {
          dataManagementAPIProjectId
        }
      }
    }
  }
`

export const GET_PROJECT_DETAIL = gql`
  query GetProjectDetail($projectId: ID!) {
    project(projectId: $projectId) {
      id
      name
      fusionWebUrl
      thumbnailUrl
      hub {
        id
        name
      }
      alternativeIdentifiers {
        dataManagementAPIProjectId
      }
    }
  }
`
