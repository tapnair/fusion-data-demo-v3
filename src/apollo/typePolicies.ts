import type { TypePolicies } from '@apollo/client/core'
import { pagedField } from './pagedField'
import possibleTypesJson from './possibleTypes.json'

/**
 * possibleTypes tells Apollo which concrete types implement each interface
 * or union. Required for correct fragment matching (e.g. DesignItem /
 * DrawingItem inline fragments). Generated from schema.graphql.
 */
export const possibleTypes = possibleTypesJson

export const typePolicies: TypePolicies = {
  // --- Entity normalization ---
  // All entities keyed by their scalar `id` field.
  Hub:        { keyFields: ['id'] },
  Project:    { keyFields: ['id'] },
  Folder:     { keyFields: ['id'] },
  DesignItem: { keyFields: ['id'] },
  DrawingItem: { keyFields: ['id'] },
  BasicItem:  { keyFields: ['id'] },
  ConfiguredDesignItem: { keyFields: ['id'] },

  // --- Non-entity (embedded) types ---
  // No stable identity; merge inline without normalization.
  Thumbnail:  { keyFields: false, merge: true },
  Pagination: { keyFields: false, merge: true },

  // --- Query-level field policies ---
  // In v3 ALL list/paginated fields live at the Query root (not on types).
  Query: {
    fields: {
      // Single-entity read shortcuts — serve detail queries instantly from
      // cache when the entity is already present from a prior list query.
      hub: {
        read(_, { args, toReference }) {
          return toReference({ __typename: 'Hub', id: args!.hubId })
        },
      },
      project: {
        read(_, { args, toReference }) {
          return toReference({ __typename: 'Project', id: args!.projectId })
        },
      },
      folder: {
        read(_, { args, toReference }) {
          return toReference({ __typename: 'Folder', id: args!.folderId })
        },
      },
      item: {
        read(_, { args, toReference }) {
          return toReference({ __typename: 'Item', id: args!.itemId })
        },
      },

      // Paginated list fields.
      // keyArgs partitions the cache per parent entity; pagination variables
      // (cursor, limit) are intentionally excluded so all pages of the same
      // parent share one cache entry and pages are merged by pagedField().
      hubs:             pagedField(false),
      projects:         pagedField(['hubId']),
      foldersByProject: pagedField(['projectId']),
      foldersByFolder:  pagedField(['projectId', 'folderId']),
      itemsByProject:   pagedField(['projectId']),
      itemsByFolder:    pagedField(['hubId', 'folderId']),
    },
  },
}
