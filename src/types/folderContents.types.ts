export type ContentRowKind = 'folder' | 'item'

export interface ContentRow {
  id: string
  kind: ContentRowKind
  name: string
  itemType: string | null       // extensionType for items; null for folders
  size: string | null           // raw byte string for items; null for folders
  objectCount: number | null    // child count for folders; null for items
  lastModifiedOn: string | null
  __typename?: string           // 'DesignItem' | 'DrawingItem' (items only)
}
