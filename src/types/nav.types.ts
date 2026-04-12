export type NavNodeType = 'hub' | 'project' | 'folder' | 'item' | 'load-more'

export interface NavNode {
  id: string           // "{type}:{entityId}" e.g. "hub:abc123"
  label: string
  type: NavNodeType
  entityId: string     // raw API entity ID
  hubId?: string       // propagated from parent for API calls
  projectId?: string   // propagated from parent for API calls (MFG project UUID)
  dmProjectId?: string // propagated from parent for DM API calls (b.xxx format)
  parentFolderId?: string
  hasChildren: boolean
  isLoaded: boolean
  parentNodeId?: string  // for load-more nodes only — the folder node id they belong to
  /** When true, useDeepLinkExpansion expands the tree to this node even if label is non-empty. */
  needsTreeExpansion?: boolean
}

export interface FolderPaginationState {
  nextCursor: string | null
  hasMore: boolean
}
