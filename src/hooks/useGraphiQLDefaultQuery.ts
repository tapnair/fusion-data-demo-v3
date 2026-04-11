import type { NavNode } from '../types/nav.types'

interface GraphiQLDefault {
  query: string
  variables: string
}

const NO_SELECTION_QUERY = `# Welcome to the Fusion Data Model API Query Editor
# Select an item in the left navigation to see an example query,
# or write your own query below.

query GetHubs {
  hubs {
    results {
      id
      name
      hubDataVersion
      alternativeIdentifiers {
        dataManagementAPIHubId
      }
    }
  }
}`

const NO_SELECTION_VARIABLES = '{}'

function hubQuery(hubId: string): GraphiQLDefault {
  return {
    query: `query GetHub($hubId: ID!) {
  hub(hubId: $hubId) {
    id
    name
    hubDataVersion
    alternativeIdentifiers {
      dataManagementAPIHubId
    }
    projects(pagination: { limit: 5 }) {
      results {
        id
        name
        hubDataVersion
        projectStatus
      }
      pagination {
        cursor
        pageSize
      }
    }
  }
}`,
    variables: JSON.stringify({ hubId }, null, 2),
  }
}

function projectQuery(projectId: string): GraphiQLDefault {
  return {
    query: `query GetProject($projectId: ID!) {
  project(projectId: $projectId) {
    id
    name
    hubDataVersion
    projectStatus
    hub {
      id
      name
    }
    folders(pagination: { limit: 10 }) {
      results {
        id
        name
        objectCount
        path
      }
      pagination {
        cursor
        pageSize
      }
    }
  }
}`,
    variables: JSON.stringify({ projectId }, null, 2),
  }
}

function folderQuery(folderId: string, projectId: string | undefined): GraphiQLDefault {
  return {
    query: `query GetFolderContents($folderId: ID!, $projectId: ID!) {
  folder(folderId: $folderId, projectId: $projectId) {
    id
    name
    objectCount
    folders(pagination: { limit: 10 }) {
      results {
        id
        name
        objectCount
        path
      }
      pagination { cursor pageSize }
    }
    items(pagination: { limit: 10 }) {
      results {
        id
        __typename
        ... on DesignItem {
          name
          tipRootModel {
            id
            component(composition: WORKING) {
              id
              name
              partNumber
              materialName
            }
          }
        }
        ... on DrawingItem {
          name
        }
      }
      pagination { cursor pageSize }
    }
  }
}`,
    variables: JSON.stringify(
      { folderId, projectId: projectId ?? '' },
      null,
      2
    ),
  }
}

function itemQuery(hubId: string, itemId: string): GraphiQLDefault {
  return {
    query: `query GetDesignItem($hubId: ID!, $itemId: ID!) {
  item(hubId: $hubId, itemId: $itemId) {
    id
    __typename
    ... on DesignItem {
      name
      hub {
        id
        name
      }
      tipRootModel {
        id
        component(composition: WORKING) {
          id
          name
          description
          partNumber
          materialName
          hasChildren
          bomRelations(depth: 1) {
            results {
              toComponent {
                id
                name
                partNumber
                materialName
                hasChildren
              }
            }
            pagination { cursor pageSize }
          }
        }
      }
    }
    ... on DrawingItem {
      name
    }
  }
}`,
    variables: JSON.stringify({ hubId, itemId }, null, 2),
  }
}

export function useGraphiQLDefaultQuery(node: NavNode | null): GraphiQLDefault {
  if (!node) {
    return { query: NO_SELECTION_QUERY, variables: NO_SELECTION_VARIABLES }
  }

  switch (node.type) {
    case 'hub':
      return hubQuery(node.entityId)
    case 'project':
      return projectQuery(node.entityId)
    case 'folder':
      return folderQuery(node.entityId, node.projectId)
    case 'item':
      return itemQuery(node.hubId ?? '', node.entityId)
    default:
      return { query: NO_SELECTION_QUERY, variables: NO_SELECTION_VARIABLES }
  }
}

// Also exported as a non-hook function for use inside effects
export const getDefaultsForNode = useGraphiQLDefaultQuery
