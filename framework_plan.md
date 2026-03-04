# Vite SPA with PKCE Authentication - Implementation Plan

## Project Overview

This plan outlines the development of a modern single-page application (SPA) using Vite and React with TypeScript, secured with OAuth 2.0 PKCE (Proof Key for Code Exchange) authentication flow for Autodesk Platform Services (APS).

### Key Objectives
- Build a fast, modern SPA using Vite and React with TypeScript
- Implement secure PKCE authentication flow with Autodesk APS OAuth 2.0
- Display user's available hubs immediately after authentication
- Access Autodesk Manufacturing Data Model API v3 for product design data
- Create a scalable and maintainable application structure
- Follow security best practices for client-side authentication

---

## Technology Stack

### Core Framework
- **Vite 5.x**: Fast build tool and dev server with HMR (Hot Module Replacement)
- **React 18.x with TypeScript**: Modern UI library with type safety
- **TypeScript 5.x**: Type-safe development

### Authentication & API
- **Autodesk Platform Services (APS) OAuth 2.0**: Authorization server with PKCE support
- **Client ID**: `nLpcDKju89IaO3hr8nWnxlaxaV60o2pzXf20GGB9p2RjSERG`
- **Scopes**: `data:read data:write` - Access to read and write Autodesk data/files
- **Manufacturing Data Model API**: Access to product design data via GraphQL

### Additional Libraries
- **react-router-dom 6.x**: Client-side routing for SPA navigation
- **axios 1.x**: HTTP client for API requests with interceptors
- **Web Crypto API**: Native browser API for PKCE code challenge generation (no external dependencies needed)

---

## PKCE Authentication Flow

### What is PKCE?

PKCE (RFC 7636) is an extension to the OAuth 2.0 Authorization Code flow designed to secure public clients (like SPAs) that cannot securely store client secrets. It prevents authorization code interception attacks.

### PKCE Flow Steps

1. **Generate Code Verifier**
   - Create a cryptographically random string (43-128 characters)
   - Store in session storage or memory

2. **Create Code Challenge**
   - Hash the code verifier using SHA-256
   - Base64URL encode the hash
   - Send with authorization request

3. **Authorization Request**
   - Redirect user to authorization server
   - Include: client_id, redirect_uri, code_challenge, code_challenge_method, scope, state

4. **Authorization Callback**
   - Receive authorization code from redirect
   - Validate state parameter to prevent CSRF

5. **Token Exchange**
   - Exchange authorization code for access token
   - Include original code_verifier in request
   - Server validates code_challenge matches code_verifier

6. **Access Protected Resources**
   - Use access token in Authorization header
   - Refresh tokens when expired

---

## Autodesk APS OAuth Configuration

### APS OAuth Endpoints

- **Authorization Endpoint**: `https://developer.api.autodesk.com/authentication/v2/authorize`
- **Token Endpoint**: `https://developer.api.autodesk.com/authentication/v2/token`
- **Logout Endpoint**: `https://developer.api.autodesk.com/authentication/v2/logout`

### Authorization Request Parameters

When redirecting to the authorization endpoint, include these parameters:

```
GET https://developer.api.autodesk.com/authentication/v2/authorize
?response_type=code
&client_id=nLpcDKju89IaO3hr8nWnxlaxaV60o2pzXf20GGB9p2RjSERG
&redirect_uri=http://localhost:5173/callback
&scope=data:read data:write
&state={random_state_value}
&code_challenge={pkce_code_challenge}
&code_challenge_method=S256
```

### Token Exchange Request

POST to the token endpoint with the following body:

```json
{
  "grant_type": "authorization_code",
  "client_id": "nLpcDKju89IaO3hr8nWnxlaxaV60o2pzXf20GGB9p2RjSERG",
  "code": "{authorization_code_from_callback}",
  "code_verifier": "{original_pkce_verifier}",
  "redirect_uri": "http://localhost:5173/callback"
}
```

### Manufacturing Data Model API v3

After authentication, the application will access the Manufacturing Data Model API v3:

- **GraphQL Endpoint**: `https://developer.api.autodesk.com/mfg/v3/graphql/public`
- **API Version**: v3 (latest version with enhanced features)
- **Query Language**: GraphQL for flexible, efficient data queries

**Key Features**:
  - Query user hubs (accounts/projects accessible to authenticated user)
  - Access component hierarchies and assemblies
  - Retrieve physical properties and relationships
  - Get BOM (Bill of Materials) data
  - Integration with Fusion 360 and Inventor data
  - Advanced search capabilities for Components, Models, Files, and Folders
  - Hide Children capability for treating sub-assemblies as single components

**Initial App Flow**:
1. User authenticates via PKCE OAuth flow
2. App redirects to callback, exchanges code for token
3. **Dashboard displays list of available user hubs**
4. User selects a hub to browse projects and data

**Resources**:
- [Manufacturing Data Model API Documentation](https://aps.autodesk.com/en/docs/mfgdataapi/v1/developers_guide/overview/)
- [APS OAuth Documentation](https://aps.autodesk.com/en/docs/oauth/v2)
- [Code Samples on GitHub](https://github.com/autodesk-platform-services/aps-mfgdm-samples)

---

## Project Structure

```
fusion-data-demo-v3/
├── public/
│   └── favicon.ico
├── src/
│   ├── assets/
│   │   └── styles/
│   ├── components/
│   │   ├── common/
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── ErrorMessage.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── Navigation.tsx
│   │   ├── auth/
│   │   │   ├── LoginButton.tsx
│   │   │   ├── LogoutButton.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── AuthCallback.tsx
│   │   └── hubs/
│   │       ├── HubList.tsx
│   │       ├── HubCard.tsx
│   │       └── HubDetails.tsx
│   ├── services/
│   │   ├── auth/
│   │   │   ├── authService.ts
│   │   │   ├── pkceHelper.ts
│   │   │   └── tokenManager.ts
│   │   └── api/
│   │       ├── apiClient.ts
│   │       ├── mfgDataModelClient.ts
│   │       └── apsService.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useApi.ts
│   │   ├── useMfgData.ts
│   │   └── useHubs.ts
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Dashboard.tsx
│   │   ├── HubsPage.tsx
│   │   ├── Login.tsx
│   │   └── Callback.tsx
│   ├── utils/
│   │   ├── constants.ts
│   │   └── storage.ts
│   ├── types/
│   │   ├── auth.types.ts
│   │   ├── hub.types.ts
│   │   └── mfg.types.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── .env.example
├── .env.local
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Implementation Steps

### Phase 1: Project Setup

1. **Initialize Vite Project**
   ```bash
   npm create vite@latest . -- --template react-ts
   npm install
   ```

2. **Install Dependencies**
   ```bash
   # Core dependencies
   npm install react-router-dom

   # Development dependencies
   npm install -D @types/node
   ```

3. **Configure Environment Variables**
   Create `.env.local`:
   ```env
   VITE_CLIENT_ID=nLpcDKju89IaO3hr8nWnxlaxaV60o2pzXf20GGB9p2RjSERG
   VITE_AUTH_URL=https://developer.api.autodesk.com/authentication/v2/authorize
   VITE_TOKEN_URL=https://developer.api.autodesk.com/authentication/v2/token
   VITE_REDIRECT_URI=http://localhost:5173/callback
   VITE_SCOPE=data:read data:write
   VITE_GRAPHQL_ENDPOINT=https://developer.api.autodesk.com/mfg/v3/graphql/public
   ```

4. **Update Vite Configuration**
   Configure base URL, plugins, and environment variable handling

### Phase 2: PKCE Authentication Implementation

1. **Create PKCE Helper Functions**
   - `generateCodeVerifier()`: Create random string
   - `generateCodeChallenge(verifier)`: Create SHA-256 hash
   - `base64URLEncode(buffer)`: Encode for URL safety

2. **Build Auth Service**
   - `login()`: Initiate authorization flow
   - `handleCallback()`: Process authorization code
   - `logout()`: Clear tokens and session
   - `refreshToken()`: Renew access token
   - `getAccessToken()`: Retrieve current token

3. **Implement Token Manager**
   - Secure token storage (memory or sessionStorage)
   - Token expiration handling
   - Automatic refresh logic
   - Token validation

4. **Create Auth Context**
   - Global authentication state
   - User information management
   - Loading states
   - Error handling

### Phase 3: UI Components

1. **Authentication Components**
   - Login button/page
   - Logout button
   - Callback handler component
   - Protected route wrapper

2. **Layout Components**
   - Header with auth status
   - Navigation
   - Footer
   - Loading indicators

3. **Page Components**
   - Public landing page
   - Protected dashboard with hub list
   - Hubs page displaying user's available hubs
   - Hub details page
   - Error pages (401, 404)

4. **Hub Components**
   - Hub list component
   - Hub card component with hub information
   - Hub details view
   - Loading states for async hub fetching

### Phase 4: API Integration

1. **API Client Setup**
   - Axios instance with interceptors
   - Automatic token injection in Authorization header
   - Request/response interceptors
   - Error handling and retry logic

2. **Manufacturing Data Model API v3 Integration**
   - Create GraphQL client for MfgDM API v3
   - **Implement hub queries (primary feature)**
   - Implement queries for components and assemblies
   - Handle BOM data retrieval
   - Error handling for APS-specific error codes

3. **Custom Hooks**
   - `useAuth()`: Access auth context
   - `useApi()`: Make authenticated requests to APS APIs
   - `useHubs()`: **Fetch and manage user hubs**
   - `useMfgData()`: Query Manufacturing Data Model
   - `useProtectedRoute()`: Route protection

### Phase 5: Security Hardening

1. **Implement Security Measures**
   - CSRF protection with state parameter
   - XSS prevention
   - Secure token storage
   - Content Security Policy headers
   - HTTPS enforcement in production

2. **Input Validation**
   - Validate all authorization responses
   - Sanitize user inputs
   - Type checking with TypeScript

### Phase 6: Testing & Deployment

1. **Testing**
   - Unit tests for auth functions
   - Integration tests for auth flow
   - E2E tests for user journeys

2. **Build & Deploy**
   - Production build optimization
   - Environment-specific configurations
   - CI/CD pipeline setup
   - Hosting deployment (Vercel, Netlify, etc.)

---

## Required Dependencies

### Production Dependencies
```json
{
  "react": "^18.x",
  "react-dom": "^18.x",
  "react-router-dom": "^6.x",
  "axios": "^1.x"
}
```

### Development Dependencies
```json
{
  "@types/react": "^18.x",
  "@types/react-dom": "^18.x",
  "@types/node": "^20.x",
  "@vitejs/plugin-react": "^4.x",
  "typescript": "^5.x",
  "vite": "^5.x"
}
```

---

## Environment Configuration

### Development (.env.local)
```env
# Autodesk APS OAuth Configuration
VITE_CLIENT_ID=nLpcDKju89IaO3hr8nWnxlaxaV60o2pzXf20GGB9p2RjSERG
VITE_AUTH_URL=https://developer.api.autodesk.com/authentication/v2/authorize
VITE_TOKEN_URL=https://developer.api.autodesk.com/authentication/v2/token
VITE_REDIRECT_URI=http://localhost:5173/callback
VITE_SCOPE=data:read data:write

# Autodesk Manufacturing Data Model API v3
VITE_GRAPHQL_ENDPOINT=https://developer.api.autodesk.com/mfg/v3/graphql/public
```

### Production (.env.production)
```env
# Autodesk APS OAuth Configuration
VITE_CLIENT_ID=nLpcDKju89IaO3hr8nWnxlaxaV60o2pzXf20GGB9p2RjSERG
VITE_AUTH_URL=https://developer.api.autodesk.com/authentication/v2/authorize
VITE_TOKEN_URL=https://developer.api.autodesk.com/authentication/v2/token
VITE_REDIRECT_URI=https://your-production-domain.com/callback
VITE_SCOPE=data:read data:write

# Autodesk Manufacturing Data Model API v3
VITE_GRAPHQL_ENDPOINT=https://developer.api.autodesk.com/mfg/v3/graphql/public
```

**Important**: Make sure to register both development and production redirect URIs in your Autodesk APS application settings.

---

## Security Best Practices

### PKCE Implementation
1. **Code Verifier**
   - Generate using cryptographically secure random number generator
   - Minimum 43 characters, maximum 128 characters
   - Use unreserved characters: [A-Z, a-z, 0-9, -, ., _, ~]

2. **Code Challenge**
   - Always use SHA-256 hashing (code_challenge_method=S256)
   - Never use plain method in production

3. **State Parameter**
   - Generate unique state for each authorization request
   - Validate state on callback to prevent CSRF
   - Store state temporarily in sessionStorage

### Token Storage
- **Recommended**: Store tokens in memory (JavaScript variables)
- **Alternative**: sessionStorage (cleared on tab close)
- **Avoid**: localStorage (persists across sessions, XSS vulnerable)
- Never store tokens in cookies without HttpOnly and Secure flags

### Additional Security
1. **HTTPS Only**: Always use HTTPS in production
2. **Redirect URI Validation**: Ensure exact match with registered URI
3. **Token Expiration**: Implement automatic refresh before expiration
4. **Logout**: Clear all tokens and session data
5. **Content Security Policy**: Restrict resource loading
6. **CORS Configuration**: Properly configure allowed origins

---

## Code Example: PKCE Helper

```typescript
// src/services/auth/pkceHelper.ts

export class PKCEHelper {
  /**
   * Generate a cryptographically random code verifier
   */
  static generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  /**
   * Generate code challenge from verifier
   */
  static async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64URLEncode(new Uint8Array(hash));
  }

  /**
   * Base64 URL encode without padding
   */
  private static base64URLEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generate random state for CSRF protection
   */
  static generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }
}
```

---

## Code Example: Auth Service

```typescript
// src/services/auth/authService.ts

import { PKCEHelper } from './pkceHelper';

interface AuthConfig {
  clientId: string;
  authUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scope: string;
}

export class AuthService {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Initiate PKCE login flow
   */
  async login(): Promise<void> {
    // Generate PKCE parameters
    const codeVerifier = PKCEHelper.generateCodeVerifier();
    const codeChallenge = await PKCEHelper.generateCodeChallenge(codeVerifier);
    const state = PKCEHelper.generateState();

    // Store for later use
    sessionStorage.setItem('code_verifier', codeVerifier);
    sessionStorage.setItem('auth_state', state);

    // Build authorization URL for Autodesk APS
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `${this.config.authUrl}?${params}`;

    // Redirect to authorization server
    window.location.href = authUrl;
  }

  /**
   * Handle authorization callback
   */
  async handleCallback(callbackUrl: string): Promise<TokenResponse> {
    const params = new URLSearchParams(new URL(callbackUrl).search);
    const code = params.get('code');
    const state = params.get('state');

    // Validate state
    const storedState = sessionStorage.getItem('auth_state');
    if (!state || state !== storedState) {
      throw new Error('Invalid state parameter');
    }

    // Get stored code verifier
    const codeVerifier = sessionStorage.getItem('code_verifier');
    if (!code || !codeVerifier) {
      throw new Error('Missing authorization code or verifier');
    }

    // Exchange code for tokens
    const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier);

    // Clean up
    sessionStorage.removeItem('code_verifier');
    sessionStorage.removeItem('auth_state');

    return tokenResponse;
  }

  /**
   * Exchange authorization code for access token with Autodesk APS
   */
  private async exchangeCodeForToken(
    code: string,
    codeVerifier: string
  ): Promise<TokenResponse> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Token exchange failed: ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Logout user from Autodesk APS
   */
  logout(): void {
    // Clear local session
    sessionStorage.clear();

    // Redirect to Autodesk logout endpoint
    const logoutUrl = 'https://developer.api.autodesk.com/authentication/v2/logout';
    const params = new URLSearchParams({
      post_logout_redirect_uri: window.location.origin
    });

    window.location.href = `${logoutUrl}?${params}`;
  }
}
```

---

## Code Example: TypeScript Types

```typescript
// src/types/hub.types.ts

export interface HubAttribute {
  name: string;
  value: string;
}

export interface Hub {
  id: string;
  name: string;
  type: string;
  region: string;
  attributes?: HubAttribute[];
}

export interface HubsResponse {
  hubs: {
    results: Hub[];
  };
}
```

```typescript
// src/types/mfg.types.ts

export interface ComponentProperty {
  name: string;
  value: string;
  units?: string;
}

export interface Component {
  id: string;
  name: string;
  description?: string;
  partNumber?: string;
  properties?: ComponentProperty[];
  children?: Component[];
}

export interface BOMItem {
  component: {
    id: string;
    name: string;
    partNumber?: string;
    quantity?: number;
  };
  level: number;
}

export interface BOMResponse {
  component: {
    id: string;
    name: string;
    bom: BOMItem[];
  };
}
```

---

## Code Example: Manufacturing Data Model API v3 Client

```typescript
// src/services/api/mfgDataModelClient.ts

import axios, { AxiosInstance } from 'axios';

export interface MfgDataModelConfig {
  graphqlEndpoint: string;
  getAccessToken: () => Promise<string>;
}

export class MfgDataModelClient {
  private client: AxiosInstance;
  private getAccessToken: () => Promise<string>;

  constructor(config: MfgDataModelConfig) {
    this.getAccessToken = config.getAccessToken;

    this.client = axios.create({
      baseURL: config.graphqlEndpoint,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to inject access token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - trigger re-authentication
          console.error('Authentication failed - token may be expired');
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Execute a GraphQL query against Manufacturing Data Model API v3
   */
  async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await this.client.post('', {
      query,
      variables,
    });

    if (response.data.errors) {
      throw new Error(`GraphQL Error: ${JSON.stringify(response.data.errors)}`);
    }

    return response.data.data;
  }

  /**
   * Get list of user hubs (FIRST QUERY AFTER LOGIN)
   */
  async getHubs() {
    const query = `
      query GetHubs {
        hubs {
          results {
            id
            name
            type
            region
            attributes {
              name
              value
            }
          }
        }
      }
    `;

    return this.query(query);
  }

  /**
   * Get component details by ID
   */
  async getComponent(componentId: string) {
    const query = `
      query GetComponent($componentId: ID!) {
        component(id: $componentId) {
          id
          name
          description
          properties {
            name
            value
            units
          }
          children {
            id
            name
          }
        }
      }
    `;

    return this.query(query, { componentId });
  }

  /**
   * Get Bill of Materials (BOM) for a component
   */
  async getBOM(componentId: string) {
    const query = `
      query GetBOM($componentId: ID!) {
        component(id: $componentId) {
          id
          name
          bom {
            component {
              id
              name
              partNumber
              quantity
            }
            level
          }
        }
      }
    `;

    return this.query(query, { componentId });
  }

  /**
   * Search components by criteria
   */
  async searchComponents(searchText: string, hubId: string) {
    const query = `
      query SearchComponents($searchText: String!, $hubId: ID!) {
        search(text: $searchText, hubId: $hubId) {
          components {
            id
            name
            description
            partNumber
          }
        }
      }
    `;

    return this.query(query, { searchText, hubId });
  }
}
```

### Usage Example: Hubs Hook

```typescript
// src/hooks/useHubs.ts

import { useState, useEffect, useCallback } from 'react';
import { MfgDataModelClient } from '../services/api/mfgDataModelClient';
import { useAuth } from './useAuth';

interface Hub {
  id: string;
  name: string;
  type: string;
  region: string;
  attributes?: Array<{ name: string; value: string }>;
}

export function useHubs() {
  const { getAccessToken } = useAuth();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = new MfgDataModelClient({
    graphqlEndpoint: import.meta.env.VITE_GRAPHQL_ENDPOINT,
    getAccessToken,
  });

  const fetchHubs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await client.getHubs();
      setHubs(response.hubs.results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch hubs'));
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Auto-fetch hubs on mount
  useEffect(() => {
    fetchHubs();
  }, [fetchHubs]);

  return {
    hubs,
    loading,
    error,
    refetch: fetchHubs,
  };
}
```

### Usage Example: MfgData Hook

```typescript
// src/hooks/useMfgData.ts

import { useCallback } from 'react';
import { MfgDataModelClient } from '../services/api/mfgDataModelClient';
import { useAuth } from './useAuth';

export function useMfgData() {
  const { getAccessToken } = useAuth();

  const client = new MfgDataModelClient({
    graphqlEndpoint: import.meta.env.VITE_GRAPHQL_ENDPOINT,
    getAccessToken,
  });

  const getComponent = useCallback(
    async (componentId: string) => {
      return await client.getComponent(componentId);
    },
    [client]
  );

  const getBOM = useCallback(
    async (componentId: string) => {
      return await client.getBOM(componentId);
    },
    [client]
  );

  const searchComponents = useCallback(
    async (searchText: string, hubId: string) => {
      return await client.searchComponents(searchText, hubId);
    },
    [client]
  );

  return {
    getComponent,
    getBOM,
    searchComponents,
  };
}
```

### Usage Example: Hub Card Component

```typescript
// src/components/hubs/HubCard.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Hub } from '../../types/hub.types';

interface HubCardProps {
  hub: Hub;
}

export function HubCard({ hub }: HubCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/hubs/${hub.id}`);
  };

  return (
    <div className="hub-card" onClick={handleClick}>
      <div className="hub-card-header">
        <h3>{hub.name}</h3>
        <span className="hub-type-badge">{hub.type}</span>
      </div>

      <div className="hub-card-body">
        <p className="hub-region">
          <strong>Region:</strong> {hub.region}
        </p>

        {hub.attributes && hub.attributes.length > 0 && (
          <div className="hub-attributes">
            {hub.attributes.map((attr, index) => (
              <div key={index} className="hub-attribute">
                <span className="attribute-name">{attr.name}:</span>
                <span className="attribute-value">{attr.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hub-card-footer">
        <button className="btn-primary">View Hub Details →</button>
      </div>
    </div>
  );
}
```

### Usage Example: Hubs Page Component

```typescript
// src/pages/HubsPage.tsx

import React from 'react';
import { useHubs } from '../hooks/useHubs';
import { HubCard } from '../components/hubs/HubCard';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';

export function HubsPage() {
  const { hubs, loading, error, refetch } = useHubs();

  if (loading) {
    return <LoadingSpinner message="Loading your hubs..." />;
  }

  if (error) {
    return (
      <ErrorMessage
        error={error}
        onRetry={refetch}
        message="Failed to load hubs. Please try again."
      />
    );
  }

  return (
    <div className="hubs-page">
      <header className="hubs-header">
        <h1>Your Hubs</h1>
        <p>Select a hub to view projects and manufacturing data</p>
      </header>

      {hubs.length === 0 ? (
        <div className="empty-state">
          <p>No hubs available</p>
          <p>Please check your Autodesk account permissions</p>
        </div>
      ) : (
        <div className="hub-grid">
          {hubs.map((hub) => (
            <HubCard key={hub.id} hub={hub} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Application Flow

### User Journey

1. **Landing Page** (`/`)
   - User sees welcome screen with "Login with Autodesk" button
   - Click triggers PKCE OAuth flow

2. **Authentication Flow**
   - Redirect to Autodesk authorization endpoint
   - User logs in with Autodesk credentials
   - User grants permissions (`data:read data:write`)
   - Redirect back to callback URL

3. **Callback Handler** (`/callback`)
   - Validate state parameter
   - Exchange authorization code for access token
   - Store token securely
   - Redirect to dashboard

4. **Dashboard** (`/dashboard`)
   - **Immediately fetch and display user hubs**
   - Show loading state while fetching
   - Display hub cards in a grid layout
   - Each hub card shows:
     - Hub name
     - Hub type
     - Region
     - Click to view hub details

5. **Hub Details** (`/hubs/:hubId`)
   - Display selected hub information
   - Show projects within the hub
   - Access to components and data within hub
   - Navigate to specific projects/models

### Post-Login Data Flow

```
Login Success
    ↓
Exchange Code for Token
    ↓
Store Access Token
    ↓
Redirect to Dashboard
    ↓
[AUTOMATIC] Fetch User Hubs via GraphQL
    ↓
Display Hub List
    ↓
User Selects Hub
    ↓
Fetch Hub-Specific Data
```

---

## Next Steps

1. **Autodesk APS Application Setup**
   - Ensure your APS application is registered at [https://aps.autodesk.com/myapps](https://aps.autodesk.com/myapps)
   - Verify Client ID: `nLpcDKju89IaO3hr8nWnxlaxaV60o2pzXf20GGB9p2RjSERG`
   - Add redirect URIs to your APS app settings:
     - Development: `http://localhost:5173/callback`
     - Production: Your production domain callback URL
   - Confirm scopes `data:read` and `data:write` are enabled
   - Note: Manufacturing Data Model API may require specific APS subscription

2. **Setup Development Environment**
   - Initialize Vite + React + TypeScript project
   - Configure environment variables with APS endpoints
   - Set up version control (Git)
   - Install required dependencies

3. **Begin Implementation**
   - **Phase 1**: Project Setup - Initialize Vite and dependencies
   - **Phase 2**: PKCE Authentication - Implement APS OAuth flow
   - **Phase 3**: UI Components - Build auth and layout components
   - **Phase 4**: API Integration - Connect to Manufacturing Data Model API
   - **Phase 5**: Security Hardening - Apply security best practices
   - **Phase 6**: Testing & Deployment - Test and deploy application

4. **Manufacturing Data Model API Setup**
   - Review [Manufacturing Data Model API documentation](https://aps.autodesk.com/en/docs/mfgdataapi/v1/developers_guide/overview/)
   - Explore [code samples on GitHub](https://github.com/autodesk-platform-services/aps-mfgdm-samples)
   - Understand GraphQL query structure for components and BOMs
   - Plan data models and state management for manufacturing data

5. **Documentation**
   - Document APS authentication flow
   - Create user guides for the application
   - Write developer documentation
   - Document Manufacturing Data Model API integration
   - Document deployment process

---

## Additional Resources

### Autodesk Platform Services
- [APS OAuth 2.0 Documentation](https://aps.autodesk.com/en/docs/oauth/v2)
- [Manufacturing Data Model API Overview](https://aps.autodesk.com/en/docs/mfgdataapi/v1/developers_guide/overview/)
- [APS PKCE Tutorial](https://aps.autodesk.com/en/docs/oauth/v2/tutorials/get-3-legged-token-pkce)
- [Manufacturing Data Model Code Samples](https://github.com/autodesk-platform-services/aps-mfgdm-samples)
- [APS Developer Portal](https://aps.autodesk.com/)

### Web Development
- [RFC 7636 - PKCE Specification](https://tools.ietf.org/html/rfc7636)
- [OAuth 2.0 for Browser-Based Apps](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [React Router Documentation](https://reactrouter.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

### Security
- [OWASP Security Guidelines](https://owasp.org/www-project-web-security-testing-guide/)
- [Web Crypto API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

## Conclusion

This plan provides a comprehensive roadmap for building a secure, modern single-page application using Vite, React, TypeScript, and Autodesk Platform Services OAuth 2.0 PKCE authentication. The application will integrate with the Manufacturing Data Model API v3 to access product design data, assemblies, and BOMs.

Upon successful authentication, users are immediately presented with a list of their available Autodesk hubs, providing instant access to their manufacturing data ecosystem. The application leverages the v3 GraphQL endpoint (`https://developer.api.autodesk.com/mfg/v3/graphql/public`) for all data operations.

The implementation prioritizes security best practices while maintaining excellent developer experience and application performance. Following this plan will result in a production-ready SPA that securely authenticates with Autodesk APS and provides seamless access to manufacturing data through modern web technologies.

**Key Deliverables:**
- ✅ Vite + React + TypeScript SPA
- ✅ Secure PKCE OAuth 2.0 flow with Autodesk APS
- ✅ **Post-login hub list display (primary feature)**
- ✅ Integration with Manufacturing Data Model API v3 via GraphQL
- ✅ Production-ready authentication and API client services
- ✅ Hub navigation and data exploration
- ✅ Scalable and maintainable architecture
