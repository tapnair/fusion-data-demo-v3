declare namespace Autodesk {
  namespace Viewing {
    const GEOMETRY_LOADED_EVENT: string

    function Initializer(
      options: {
        env: string
        api: string
        getAccessToken: (onTokenReady: (token: string, expiresIn: number) => void) => void
      },
      callback: () => void
    ): void

    function shutdown(): void

    class GuiViewer3D {
      constructor(container: HTMLElement, config?: Record<string, unknown>)
      start(): number
      finish(): void
      resize(): void
      unloadModel(model: any): void
      loadDocumentNode(doc: any, viewable: any, options?: Record<string, unknown>): Promise<any>
      setBackgroundColor(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): void
      setLightPreset(preset: number): void
      addEventListener(event: string, callback: () => void): void
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
