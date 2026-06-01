declare namespace Autodesk {
  namespace Viewing {
    const GEOMETRY_LOADED_EVENT: string
    const SELECTION_CHANGED_EVENT: string

    function Initializer(
      options: {
        env: string
        api: string
        getAccessToken: (onTokenReady: (token: string, expiresIn: number) => void) => void
      },
      callback: () => void
    ): void

    function shutdown(): void

    interface PropertyResult {
      dbId: number
      externalId: string
      name: string
      properties: Property[]
    }

    interface Property {
      attributeName: string
      displayCategory: string
      displayName: string
      displayValue: string | number
      hidden: boolean
      type: number
      units: string | null
    }

    interface InstanceTree {
      getRootId(): number
      getNodeName(dbId: number): string
      getNodeParentId(dbId: number): number
      getChildCount(dbId: number): number
      enumNodeChildren(dbId: number, callback: (childDbId: number) => void, recursive?: boolean): void
    }

    interface ModelData {
      instanceTree: InstanceTree
    }

    interface Model {
      getData(): ModelData
    }

    class GuiViewer3D {
      constructor(container: HTMLElement, config?: Record<string, unknown>)
      start(): number
      finish(): void
      resize(): void
      unloadModel(model: any): void
      loadDocumentNode(doc: any, viewable: any, options?: Record<string, unknown>): Promise<any>
      setBackgroundColor(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): void
      setLightPreset(preset: number): void
      addEventListener(event: string, callback: (event: any) => void): void
      removeEventListener(event: string, callback: (event: any) => void): void
      getSelection(): number[]
      clearSelection(): void
      select(dbIds: number | number[]): void
      fitToView(dbIds?: number[]): void
      getProperties(
        dbId: number,
        onSuccess: (result: PropertyResult) => void,
        onError?: (errCode: number, errMsg: string) => void
      ): void
      model: Model
    }

    namespace Document {
      function load(
        urn: string,
        onSuccess: (doc: any) => void,
        onFailure: (errCode: number, errMsg: string) => void
      ): void
    }
  }
}
