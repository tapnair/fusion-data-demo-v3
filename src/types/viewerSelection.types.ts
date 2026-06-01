export interface ViewerProperty {
  attributeName: string
  displayCategory: string
  displayName: string
  displayValue: string | number
  units: string | null
  hidden: boolean
  type: number
}

export interface HierarchyNode {
  dbId: number
  name: string
}

export interface ViewerBody {
  dbId: number
  name: string
  externalId: string
  properties: ViewerProperty[]
}

export interface ViewerSelection {
  componentDbId: number
  componentName: string
  componentProperties: ViewerProperty[]
  modelId: string | null
  componentLineageUrn: string | null
  componentF3dId: string | null

  body: ViewerBody | null

  hierarchyPath: HierarchyNode[]
}
