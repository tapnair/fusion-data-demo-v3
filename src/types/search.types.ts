import type { ComponentRow, ComponentColumnDef } from '../components/shared/componentColumns'

export type SearchResultType = 'COMPONENT' | 'FILE' | 'FOLDER' | 'MODEL'

export interface SearchResultMatch {
  matchedPropertyId: string
  matchedText: string
}

export interface SearchRow extends ComponentRow {
  resultType: SearchResultType
  /** "Component", "Design", "Drawing", "Folder", "Model", etc. */
  objectTypeName: string

  // All types
  relevancyScore: number | null
  /** Direct URL string from SearchResult.thumbnail */
  thumbnailUrl: string | null
  matches: SearchResultMatch[]

  // FILE-specific
  mimeType: string | null
  fileSize: string | null
  folderPath: string | null

  // FOLDER-specific
  objectCount: number | null

  // MODEL-specific
  timestamp: string | null

  // For navigation: parent DesignItem info (COMPONENT results)
  parentItemId: string | null
  parentItemHubId: string | null
  parentItemFolderId: string | null
  parentFolderName: string | null
  /** The MFG project ID (needed to expand the tree). */
  parentProjectId: string | null
  parentProjectName: string | null
}

export interface SearchCellContext {
  sigFigs: number
  // No setBaseProperty — search results are read-only
}

export type SearchColumnDef = ComponentColumnDef<SearchRow, SearchCellContext>
