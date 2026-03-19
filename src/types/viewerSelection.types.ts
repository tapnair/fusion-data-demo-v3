export interface ViewerProperty {
  attributeName: string
  displayCategory: string
  displayName: string
  displayValue: string | number
  units: string | null
  hidden: boolean
  type: number
}

export interface ViewerSelection {
  dbId: number
  name: string
  externalId: string
  hierarchyPath: string[]
  properties: ViewerProperty[]        // body (selected node) properties

  // Parent component — one level up in the instance tree from the selected body
  parentDbId: number | null
  parentName: string
  parentProperties: ViewerProperty[]  // component properties (empty array if no parent)
}
