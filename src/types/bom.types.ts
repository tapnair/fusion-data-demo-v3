export interface BomRow {
  id: string              // BOMRelation id; root row uses 'root:{componentId}'; load-more rows use 'load-more:{parentRowId}'
  componentId: string     // toComponent.id (or root component id)
  componentState: string | null  // toComponentState — null for root
  name: string
  partNumber: string
  description: string
  materialName: string
  quantity: string | null  // null for root row (no parent BOMRelation)
  sequenceNumber: number   // 0 for root
  depth: number            // 0 = root component, 1 = direct children, etc.
  hasChildren: boolean
  isExpanded: boolean
  isLoading: boolean
  parentRowId: string | null
  nextCursor: string | null  // for load-more rows: the cursor to fetch next page; for data rows: null
}
