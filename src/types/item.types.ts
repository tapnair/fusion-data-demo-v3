export interface Thumbnail {
  status?: string
  signedUrl?: string
}

export interface ItemBase {
  id: string
  name: string
  extensionType?: string
  mimeType?: string
  size?: string
  createdOn?: string
  createdBy?: { userName: string }
  lastModifiedOn?: string
  lastModifiedBy?: { userName: string }
  parentFolder?: { id: string; name: string }
  project?: { id: string; name: string }
  fusionWebUrl?: string
}

export interface DesignItem extends ItemBase {
  __typename: 'DesignItem'
  isConfiguration?: boolean
  thumbnail?: Thumbnail
  tipRootModel?: {
    id: string
    timestamp?: string
    component?: {
      id: string
      name?: { value: string }
      partNumber?: { value: string }
      description?: { value: string }
    }
  }
}

export interface DrawingItem extends ItemBase {
  __typename: 'DrawingItem'
}

export type Item = DesignItem | DrawingItem

export interface ItemsResponse {
  itemsByFolder: {
    pagination?: { cursor?: string | null; pageSize?: number }
    results: Item[]
  }
}
