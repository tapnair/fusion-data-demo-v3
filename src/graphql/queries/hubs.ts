import { gql } from '@apollo/client/core'

export const GET_HUBS = gql`
  query GetHubs {
    hubs {
      results {
        id
        name
        hubDataVersion
      }
    }
  }
`

export const GET_HUB_DETAIL = gql`
  query GetHubDetail($hubId: ID!) {
    hub(hubId: $hubId) {
      id
      name
      fusionWebUrl
      alternativeIdentifiers {
        dataManagementAPIHubId
      }
    }
  }
`
