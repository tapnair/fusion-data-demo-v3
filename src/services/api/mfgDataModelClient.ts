/**
 * Manufacturing Data Model API v3 Client
 * GraphQL client for Autodesk Manufacturing Data Model API
 */

import { ApiClient } from './apiClient'
import type { HubsResponse } from '../../types/hub.types'
import type { ProjectsResponse } from '../../types/project.types'
import type { FoldersResponse } from '../../types/folder.types'
import type { ItemsResponse } from '../../types/item.types'

export interface MfgDataModelConfig {
  graphqlEndpoint: string
  getAccessToken: () => Promise<string>
}

export class MfgDataModelClient extends ApiClient {
  constructor(config: MfgDataModelConfig) {
    super({
      baseURL: config.graphqlEndpoint,
      getAccessToken: config.getAccessToken,
    })
  }

  /**
   * Execute a GraphQL query against Manufacturing Data Model API v3
   */
  async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    console.log('🔍 GraphQL Query:', { query, variables })

    try {
      const response = await this.client.post('', {
        query,
        variables,
      })

      console.log('✅ GraphQL Response:', response.data)

      if (response.data.errors) {
        const errorMessages = response.data.errors
          .map((err: any) => err.message)
          .join(', ')
        console.error('❌ GraphQL Errors:', response.data.errors)
        throw new Error(`GraphQL Error: ${errorMessages}`)
      }

      return response.data.data
    } catch (error: any) {
      console.error('❌ GraphQL Request Failed:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
      })
      throw error
    }
  }

  /**
   * Get list of user hubs (FIRST QUERY AFTER LOGIN)
   * This is the primary feature - displays available hubs to the user
   */
  async getHubs(): Promise<HubsResponse> {
    const query = `
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

    return this.query<HubsResponse>(query)
  }

  /**
   * Get component details by ID
   */
  async getComponent(componentId: string) {
    const query = `
      query GetComponent($componentId: ID!) {
        component(id: $componentId) {
          id
          name
          description
          properties {
            name
            value
            units
          }
          children {
            id
            name
          }
        }
      }
    `

    return this.query(query, { componentId })
  }

  /**
   * Get Bill of Materials (BOM) for a component
   */
  async getBOM(componentId: string) {
    const query = `
      query GetBOM($componentId: ID!) {
        component(id: $componentId) {
          id
          name
          bom {
            component {
              id
              name
              partNumber
              quantity
            }
            level
          }
        }
      }
    `

    return this.query(query, { componentId })
  }

  /**
   * Search components by criteria
   */
  async searchComponents(searchText: string, hubId: string) {
    const query = `
      query SearchComponents($searchText: String!, $hubId: ID!) {
        search(text: $searchText, hubId: $hubId) {
          components {
            id
            name
            description
            partNumber
          }
        }
      }
    `

    return this.query(query, { searchText, hubId })
  }

  /** Get projects for a hub */
  async getProjects(hubId: string): Promise<ProjectsResponse> {
    const query = `
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
    return this.query<ProjectsResponse>(query, { hubId })
  }

  /** Get root folders for a project */
  async getFoldersByProject(projectId: string): Promise<FoldersResponse> {
    const query = `
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
    return this.query<FoldersResponse>(query, { projectId })
  }

  /** Get sub-folders within a folder */
  async getFoldersByFolder(projectId: string, folderId: string): Promise<FoldersResponse> {
    const query = `
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
    return this.query<FoldersResponse>(query, { projectId, folderId })
  }

  /** Get items within a folder, with optional pagination (limit=50) */
  async getItemsByFolder(
    hubId: string,
    folderId: string,
    pagination?: { cursor?: string | null; limit?: number }
  ): Promise<ItemsResponse> {
    const query = `
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
    const paginationInput = pagination
      ? { cursor: pagination.cursor ?? null, limit: pagination.limit ?? 50 }
      : { limit: 50 }
    return this.query<ItemsResponse>(query, { hubId, folderId, pagination: paginationInput })
  }

  /** Get items within a project, with optional pagination (limit=50) */
  async getItemsByProject(
    projectId: string,
    pagination?: { cursor?: string | null; limit?: number }
  ): Promise<{ itemsByProject: { pagination?: { cursor?: string | null; pageSize?: number }; results: any[] } }> {
    const query = `
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
    const paginationInput = pagination
      ? { cursor: pagination.cursor ?? null, limit: pagination.limit ?? 50 }
      : { limit: 50 }
    return this.query(query, { projectId, pagination: paginationInput })
  }

  /** Get hub detail */
  async getHubDetail(hubId: string) {
    const query = `
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
    return this.query<{ hub: any }>(query, { hubId })
  }

  /** Get project detail */
  async getProjectDetail(projectId: string) {
    const query = `
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
    return this.query<{ project: any }>(query, { projectId })
  }

  /** Get folder detail */
  async getFolderDetail(projectId: string, folderId: string) {
    const query = `
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
    return this.query<{ folder: any }>(query, { projectId, folderId })
  }

  /** Get item detail */
  async getItemDetail(hubId: string, itemId: string) {
    const query = `
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
    return this.query<{ item: any }>(query, { hubId, itemId })
  }
}
