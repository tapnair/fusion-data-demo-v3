const VIEWER_VERSION = '7.*'
const CSS_URL = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${VIEWER_VERSION}/style.min.css`
const JS_URL  = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${VIEWER_VERSION}/viewer3D.min.js`

let loadPromise: Promise<void> | null = null

export function loadViewerScripts(): Promise<void> {
  if (loadPromise !== null) {
    return loadPromise
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = CSS_URL
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = JS_URL
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load APS Viewer scripts'))
    document.head.appendChild(script)
  })

  return loadPromise
}
