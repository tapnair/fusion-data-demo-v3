export interface Folder {
  id: string
  name: string
  path?: string
  objectCount?: number
  createdOn?: string
  createdBy?: { name: string }
  lastModifiedOn?: string
  lastModifiedBy?: { name: string }
  fusionWebUrl?: string
  parentFolder?: { id: string; name: string }
  project?: { id: string; name: string }
}

export interface FoldersResponse {
  foldersByProject?: {
    pagination?: { cursor?: string | null; pageSize?: number }
    results: Folder[]
  }
  foldersByFolder?: {
    pagination?: { cursor?: string | null; pageSize?: number }
    results: Folder[]
  }
}
