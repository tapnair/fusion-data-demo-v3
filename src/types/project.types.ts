export interface Project {
  id: string
  name: string
  thumbnailUrl?: string
  fusionWebUrl?: string
  hub?: { id: string; name: string }
  alternativeIdentifiers?: {
    dataManagementAPIProjectId?: string
  }
}

export interface ProjectsResponse {
  projects: {
    pagination?: { cursor?: string | null; pageSize?: number }
    results: Project[]
  }
}
