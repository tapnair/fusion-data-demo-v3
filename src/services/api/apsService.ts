/**
 * Autodesk Platform Services (APS) Service
 * Central service for all APS API interactions
 */

import { MfgDataModelClient } from './mfgDataModelClient'

export class APSService {
  private mfgDataClient: MfgDataModelClient

  constructor(getAccessToken: () => Promise<string>) {
    this.mfgDataClient = new MfgDataModelClient({
      graphqlEndpoint: import.meta.env.VITE_GRAPHQL_ENDPOINT,
      getAccessToken,
    })
  }

  /**
   * Get Manufacturing Data Model client
   */
  get manufacturingData() {
    return this.mfgDataClient
  }
}
