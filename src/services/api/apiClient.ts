/**
 * Base API Client
 * Axios instance with authentication interceptor
 */

import axios, { AxiosInstance, AxiosError } from 'axios'

export interface ApiClientConfig {
  baseURL?: string
  getAccessToken: () => Promise<string>
}

export class ApiClient {
  protected client: AxiosInstance
  private getAccessToken: () => Promise<string>

  constructor(config: ApiClientConfig) {
    this.getAccessToken = config.getAccessToken

    this.client = axios.create({
      baseURL: config.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to inject access token
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const token = await this.getAccessToken()
          if (token) {
            config.headers.Authorization = `Bearer ${token}`
          }
        } catch (error) {
          console.error('Failed to get access token:', error)
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          console.error('Authentication failed - token may be expired')
          // Could trigger re-authentication here
        }
        return Promise.reject(error)
      }
    )
  }
}
