# Mobile App Implementation Plan

## Status: ✅ IMPLEMENTED IN SEPARATE REPO

This plan has been executed in the standalone repo `fusion-data-demo-mobile`.
Do not implement anything from this plan in the current (web) repo — it lives elsewhere now.
This file is retained as historical reference only.

---

## Fusion Data Demo v3 — React Native + Expo

> **Goal:** Build a React Native + Expo mobile app (iOS + Android) that mirrors the full
> feature set of the Fusion Data Demo v3 web app: OAuth PKCE login, hub/project/folder/item
> drill-down navigation, BOM viewer, APS Viewer (via WebView), Search, User Management,
> GraphiQL editor, and Query Log.

*Plan created: 2026-05-09*

---

## Overview

```
fusion-data-demo-mobile  (separate repo)
├── Expo SDK 52 managed workflow
├── React Native 0.76.x + TypeScript
├── Apollo Client v4 — same queries/mutations/typePolicies as web
├── expo-auth-session PKCE OAuth → expo-secure-store token storage
├── React Navigation v7: DrawerNavigator + StackNavigator + BottomTabNavigator
├── react-native-paper v5 (Material Design components)
├── @shopify/flash-list (BOM, Search, Contents lists)
├── react-native-webview (APS Viewer + GraphiQL)
└── EAS Build → TestFlight (iOS) + Play Store beta (Android)
```

---

## Tech Stack

### Core

| Package | Version | Role |
|---------|---------|------|
| `expo` | SDK 52 | Managed workflow host |
| `react-native` | 0.76.x | Native runtime |
| TypeScript | 5.x | Type safety |
| `@apollo/client` | v4 | GraphQL client (same as web) |
| `graphql` | v16 | GQL runtime |

### Auth & Storage

| Package | Role |
|---------|------|
| `expo-auth-session` | PKCE OAuth — code verifier/challenge, browser redirect, token exchange |
| `expo-web-browser` | Opens the auth URL in a secure in-app browser |
| `expo-secure-store` | Token storage (replaces `localStorage` / `sessionStorage`) |
| `@react-native-async-storage/async-storage` | Apollo cache persistence + user prefs |

### Navigation

| Package | Role |
|---------|------|
| `@react-navigation/native` v7 | Core navigation library |
| `@react-navigation/drawer` | Drawer navigator (hub list + nav links) |
| `@react-navigation/stack` | Stack navigator (drill-down: Hub → Project → Folder → Item) |
| `@react-navigation/bottom-tabs` | Bottom tab bar for Detail / BOM / View / Users / Contents tabs |
| `react-native-gesture-handler` | Navigation peer dependency |
| `react-native-reanimated` | Navigation peer dependency |
| `react-native-screens` | Navigation peer dependency (native screen containers) |
| `react-native-safe-area-context` | Safe area insets for notched devices |

### UI & Lists

| Package | Role |
|---------|------|
| `react-native-paper` v5 | Material Design components (replaces MUI v7) |
| `@shopify/flash-list` | Virtualized lists — BOM rows, Search results, Contents |
| `react-native-fast-image` | Thumbnail display + native disk cache (replaces IndexedDB) |
| `react-native-webview` | APS Viewer iframe + GraphiQL editor |

### Build & Distribution

| Tool | Role |
|------|------|
| `eas-cli` | EAS Build + EAS Submit |
| GitHub Actions | CI/CD: trigger EAS builds on push to `main` |

---

## Decisions

| Topic | Decision |
|-------|----------|
| Repo structure | Separate repo `fusion-data-demo-mobile` (no monorepo for now) |
| Shared code | Copy `graphql/queries`, `graphql/mutations`, `types`, `typePolicies.ts`, `pagedField.ts`, `loggingLink.ts`, `possibleTypes.json` into the mobile project |
| Navigation | Drawer + drill-down stack (not a visible tree); drawer shows hub list |
| APS Viewer | `react-native-webview` loading a bundled `assets/viewer.html` |
| GraphiQL | `react-native-webview` loading a bundled `assets/graphiql.html` |
| OAuth scheme | `fusiondatademo://callback` — register in APS app credentials |
| Token storage | `expo-secure-store` (encrypted keychain / keystore) |
| Cache persistence | Port `cachePersistor.ts` to use `AsyncStorage` instead of `localStorage` |
| Thumbnail cache | `react-native-fast-image` native cache (no IndexedDB) |
| Distribution | TestFlight (iOS) + Play Store beta (Android) via EAS Build |

---

## Navigation Structure

```
Root
├── AuthStack (unauthenticated)
│   ├── LoginScreen           ← "Sign in with Autodesk" button
│   └── AuthCallbackScreen    ← deep link handler (fusiondatademo://callback)
└── AppDrawer (authenticated)
    ├── MainStack (drill-down content)
    │   ├── HubsScreen           ← drawer home — list of hubs
    │   ├── HubScreen            ← hub + bottom tabs (Details, Users)
    │   ├── ProjectScreen        ← project + bottom tabs (Details, Contents, Users)
    │   ├── FolderScreen         ← folder + bottom tabs (Details, Contents, Users)
    │   └── ItemScreen           ← item + bottom tabs (resolved by __typename)
    ├── SearchScreen             ← full-screen search
    ├── QueryEditorScreen        ← GraphiQL in WebView
    └── QueryLogScreen           ← native query log list
```

**Drawer content:**
- Hub list (from `useHubs`) with "CE Hubs Only" toggle switch
- Divider
- Navigation links: Search, Query Editor, Query Log
- Settings (theme, density) at the bottom

**Detail tab rules (mirrors web):**

| Node type | Bottom tabs |
|-----------|------------|
| Hub | Details, Users |
| Project | Details, Contents, Users |
| Folder | Details, Contents, Users |
| DesignItem | Details, BOM, View |
| DrawingItem | Details, View |
| BasicItem / ConfiguredDesignItem | Details |

---

## APS Viewer WebView Architecture

```
assets/viewer.html
  ├── Loads APS Viewer SDK CSS + JS from CDN (style.min.css, viewer3D.min.js)
  ├── window.initializeViewer(token, urn)  ← called via injectedJavaScript
  └── SELECTION_CHANGED_EVENT handler
        └── ReactNativeWebView.postMessage(JSON.stringify({
              type: 'selection',
              dbId, name, properties,
              parentDbId, parentName, parentProperties
            }))

ViewTab.tsx (React Native)
  ├── <WebView source={{ uri: 'file:///...viewer.html' }} />
  ├── injectedJavaScript: calls initializeViewer(token, urn) once loaded
  ├── onMessage: parses selection events, updates native state
  └── Slide-out properties panel (native View, same data as web ViewerPropertiesPanel)
```

---

## Environment Variables

| Web (`VITE_*`) | Mobile (`EXPO_PUBLIC_*`) |
|---|---|
| `VITE_CLIENT_ID` | `EXPO_PUBLIC_CLIENT_ID` |
| `VITE_AUTH_URL` | `EXPO_PUBLIC_AUTH_URL` |
| `VITE_TOKEN_URL` | `EXPO_PUBLIC_TOKEN_URL` |
| `VITE_SCOPE` | `EXPO_PUBLIC_SCOPE` |
| `VITE_GRAPHQL_ENDPOINT` | `EXPO_PUBLIC_GRAPHQL_ENDPOINT` |
| `VITE_REDIRECT_URI` | `EXPO_PUBLIC_REDIRECT_URI` (`fusiondatademo://callback`) |

---

## Files to Copy from Web Project (unchanged)

| Web path | Mobile path | Notes |
|---|---|---|
| `src/graphql/queries/*.ts` | `src/graphql/queries/*.ts` | All query DocumentNodes |
| `src/graphql/mutations/*.ts` | `src/graphql/mutations/*.ts` | All mutation DocumentNodes |
| `src/types/*.ts` | `src/types/*.ts` | All TypeScript interfaces |
| `src/apollo/possibleTypes.json` | `src/apollo/possibleTypes.json` | Union/interface types |
| `src/apollo/pagedField.ts` | `src/apollo/pagedField.ts` | Cursor pagination field policy helper |
| `src/apollo/typePolicies.ts` | `src/apollo/typePolicies.ts` | Apollo cache type policies |
| `src/apollo/loggingLink.ts` | `src/apollo/loggingLink.ts` | Apollo Link interceptor |
| `src/utils/propertyValue.ts` | `src/utils/propertyValue.ts` | Property value display helper |
| `src/utils/pkceHelper.ts` | *(replaced by expo-auth-session built-in PKCE)* | — |

**Files NOT copied — replaced with mobile equivalents:**

| Web file | Mobile replacement | Reason |
|---|---|---|
| `src/services/auth/authService.ts` | `src/services/auth/authService.ts` (expo-auth-session) | Browser APIs replaced |
| `src/services/auth/TokenManager.ts` | `src/services/auth/tokenManager.ts` (SecureStore) | `localStorage` → SecureStore |
| `src/apollo/cachePersistor.ts` | `src/apollo/cachePersistor.ts` (AsyncStorage) | `localStorage` → AsyncStorage |
| `src/apollo/client.ts` | `src/apollo/client.ts` (async init) | AsyncStorage persistence init |
| `src/context/AuthContext.tsx` | `src/context/AuthContext.tsx` | Async token ops |
| All `.tsx` components | New native components | Web DOM → React Native |

---

## Folder Structure

```
fusion-data-demo-mobile/
├── assets/
│   ├── viewer.html              ← bundled APS Viewer host page
│   └── graphiql.html            ← bundled GraphiQL host page
├── src/
│   ├── apollo/
│   │   ├── client.ts            ← Apollo client factory (AsyncStorage)
│   │   ├── cachePersistor.ts    ← ported from web (AsyncStorage)
│   │   ├── asyncStorageWrapper.ts ← wraps AsyncStorage for persistor
│   │   ├── loggingLink.ts       ← copied from web
│   │   ├── pagedField.ts        ← copied from web
│   │   ├── typePolicies.ts      ← copied from web
│   │   └── possibleTypes.json   ← copied from web
│   ├── context/
│   │   ├── AuthContext.tsx      ← auth state + token operations
│   │   ├── NavContext.tsx       ← selected node state
│   │   ├── SearchContext.tsx    ← search open/close state
│   │   └── QueryLogContext.tsx  ← copied logic from web
│   ├── graphql/
│   │   ├── queries/             ← copied from web
│   │   └── mutations/           ← copied from web
│   ├── hooks/
│   │   ├── useBomLoader.ts      ← ported from web (Apollo hooks unchanged)
│   │   ├── useComponentSearch.ts ← ported from web
│   │   ├── useSearchableProperties.ts ← ported from web
│   │   ├── useNavLoader.ts      ← ported from web
│   │   ├── useMembers.ts        ← ported from web
│   │   ├── useViewerTranslation.ts ← ported from web (no browser deps)
│   │   └── useDeepLinkExpansion.ts ← ported from web
│   ├── navigation/
│   │   ├── AppNavigator.tsx     ← root navigator (AuthStack vs AppDrawer)
│   │   ├── AuthStack.tsx        ← LoginScreen + AuthCallbackScreen
│   │   ├── AppDrawer.tsx        ← DrawerNavigator
│   │   ├── MainStack.tsx        ← StackNavigator for drill-down
│   │   └── DrawerContent.tsx    ← custom drawer with hub list
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── AuthCallbackScreen.tsx
│   │   ├── HubsScreen.tsx
│   │   ├── HubScreen.tsx
│   │   ├── ProjectScreen.tsx
│   │   ├── FolderScreen.tsx
│   │   ├── ItemScreen.tsx
│   │   ├── SearchScreen.tsx
│   │   ├── QueryEditorScreen.tsx
│   │   └── QueryLogScreen.tsx
│   ├── components/
│   │   ├── tabs/
│   │   │   ├── DetailsTab.tsx
│   │   │   ├── ContentsTab.tsx
│   │   │   ├── UsersTab.tsx
│   │   │   ├── BomTab.tsx
│   │   │   └── ViewTab.tsx
│   │   ├── bom/
│   │   │   ├── BomRow.tsx
│   │   │   ├── BomColumnSettings.tsx
│   │   │   └── BomLoadMoreRow.tsx
│   │   ├── viewer/
│   │   │   ├── ViewerWebView.tsx
│   │   │   └── ViewerPropertiesPanel.tsx
│   │   └── common/
│   │       ├── PropertyRow.tsx
│   │       ├── LoadingView.tsx
│   │       ├── ErrorView.tsx
│   │       └── NodeIcon.tsx
│   ├── services/
│   │   ├── auth/
│   │   │   ├── authService.ts   ← expo-auth-session PKCE
│   │   │   └── tokenManager.ts  ← expo-secure-store wrapper
│   │   └── viewer/
│   │       └── modelDerivativeService.ts ← ported from web (pure fetch)
│   ├── types/                   ← copied from web
│   └── utils/
│       └── propertyValue.ts     ← copied from web
├── app.json
├── eas.json
├── tsconfig.json
├── babel.config.js
└── .env
```

---

## Implementation Phases

---

### Phase 1 — Scaffold + Dependencies

**Goal:** Bootstrapped project with all packages installed, configured, and compiling cleanly.

#### 1.1 Create the project

```bash
npx create-expo-app fusion-data-demo-mobile --template expo-template-blank-typescript
cd fusion-data-demo-mobile
```

#### 1.2 Install all dependencies

```bash
# Navigation
npx expo install @react-navigation/native @react-navigation/drawer \
  @react-navigation/stack @react-navigation/bottom-tabs \
  react-native-gesture-handler react-native-reanimated \
  react-native-screens react-native-safe-area-context

# Apollo
npm install @apollo/client graphql

# Auth & Storage
npx expo install expo-auth-session expo-web-browser \
  expo-secure-store @react-native-async-storage/async-storage

# UI
npm install react-native-paper react-native-vector-icons
npx expo install react-native-webview react-native-fast-image

# Lists
npm install @shopify/flash-list

# Build tooling
npm install -g eas-cli
```

#### 1.3 Configure `app.json`

Key settings:
- `name`: `"Fusion Data Demo"`
- `slug`: `"fusion-data-demo-mobile"`
- `bundleIdentifier` (iOS): `"com.autodesk.fusiondatademo"`
- `package` (Android): `"com.autodesk.fusiondatademo"`
- `scheme`: `"fusiondatademo"` — enables `fusiondatademo://callback` deep links
- `intentFilters` (Android): `DATA scheme="fusiondatademo"` for deep link handling
- `expo-secure-store`, `expo-auth-session` in `plugins`
- `userInterfaceStyle`: `"automatic"` (light/dark)
- No camera or location permissions needed

#### 1.4 Configure `eas.json`

```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    },
    "production": {
      "ios": { "buildType": "release" },
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "...", "ascAppId": "..." },
      "android": { "serviceAccountKeyPath": "..." }
    }
  }
}
```

#### 1.5 Configure `tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@apollo/*": ["src/apollo/*"],
      "@context/*": ["src/context/*"],
      "@hooks/*": ["src/hooks/*"],
      "@screens/*": ["src/screens/*"],
      "@components/*": ["src/components/*"],
      "@services/*": ["src/services/*"],
      "@types/*": ["src/types/*"],
      "@graphql/*": ["src/graphql/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

#### 1.6 `.env` setup

```bash
EXPO_PUBLIC_CLIENT_ID=<aps_client_id>
EXPO_PUBLIC_AUTH_URL=https://developer.api.autodesk.com/authentication/v2/authorize
EXPO_PUBLIC_TOKEN_URL=https://developer.api.autodesk.com/authentication/v2/token
EXPO_PUBLIC_SCOPE=data:read data:write
EXPO_PUBLIC_GRAPHQL_ENDPOINT=https://developer.api.autodesk.com/mfg/v3/graphql/public
EXPO_PUBLIC_REDIRECT_URI=fusiondatademo://callback
```

#### 1.7 Verify

- [ ] `npx expo start` launches without errors
- [ ] `npx tsc --noEmit` passes clean
- [ ] Metro bundler resolves all imports

---

### Phase 2 — Auth

**Goal:** Working PKCE OAuth flow. User taps "Sign in", browser opens, callback is handled, tokens stored, app navigates to authenticated state.

#### 2.1 `src/services/auth/tokenManager.ts`

Wraps `expo-secure-store`. Stores `access_token`, `refresh_token`, `expires_at` as separate keys. All methods are async.

```ts
const KEYS = {
  accessToken: 'aps_access_token',
  refreshToken: 'aps_refresh_token',
  expiresAt: 'aps_expires_at',
}

export const tokenManager = {
  async saveTokens(access: string, refresh: string, expiresIn: number): Promise<void>,
  async getAccessToken(): Promise<string | null>,
  async getRefreshToken(): Promise<string | null>,
  async isTokenExpired(): Promise<boolean>,
  async clearTokens(): Promise<void>,
}
```

`isTokenExpired()` returns `true` when `expiresAt - Date.now() < 5 * 60 * 1000` (5-minute buffer).

#### 2.2 `src/services/auth/authService.ts`

Uses `expo-auth-session` for PKCE. No manual `pkceHelper.ts` needed — `expo-auth-session` generates the code verifier and challenge internally.

```ts
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'

// Required for expo-auth-session on Android to complete the auth session
WebBrowser.maybeCompleteAuthSession()

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: process.env.EXPO_PUBLIC_AUTH_URL,
  tokenEndpoint: process.env.EXPO_PUBLIC_TOKEN_URL,
}

export async function login(): Promise<void>
// Uses AuthSession.useAuthRequest() pattern inside the hook, or
// AuthSession.startAsync() for imperative calls from a button press

export async function refreshAccessToken(): Promise<string>
// POST to EXPO_PUBLIC_TOKEN_URL with grant_type=refresh_token

export async function logout(): Promise<void>
// Calls tokenManager.clearTokens()
```

**Auth flow:**
1. `login()` calls `AuthSession.startAsync({ authUrl, returnUrl })` with PKCE params
2. APS redirects to `fusiondatademo://callback?code=...&state=...`
3. `expo-auth-session` intercepts the deep link, validates state, exchanges code for tokens
4. `tokenManager.saveTokens(...)` persists to SecureStore
5. `AuthContext` state updates to `isAuthenticated: true`

#### 2.3 `src/context/AuthContext.tsx`

```ts
interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean            // true during initial token check
  user: UserInfo | null
  login: () => Promise<void>
  logout: () => Promise<void>
  getAccessToken: () => Promise<string>  // refreshes if expired
}
```

On mount: checks SecureStore for existing tokens. If expired, attempts silent refresh. If refresh fails, clears tokens → `isAuthenticated: false`.

`getAccessToken()`:
1. Reads token from SecureStore
2. If expired, calls `authService.refreshAccessToken()`
3. Returns valid token (or throws, which triggers logout)

#### 2.4 `LoginScreen.tsx`

Simple screen with the Autodesk logo, app name, and a Paper `Button` "Sign in with Autodesk". Calls `auth.login()` on press. Shows `ActivityIndicator` during the auth flow.

#### 2.5 `AuthCallbackScreen.tsx`

Handles the case where the deep link callback arrives at this screen directly (Android pattern). Reads the `code` and `state` params from the URL, completes token exchange, then navigates to `AppDrawer`. On web/iOS `expo-auth-session` handles this automatically via `maybeCompleteAuthSession`.

#### 2.6 Verify

- [ ] Tap "Sign in" → browser opens APS login page
- [ ] Complete login → app navigates to hub list
- [ ] Kill and reopen app → session restored from SecureStore (no re-login)
- [ ] Token expiry → silent refresh works
- [ ] Logout clears SecureStore, navigates to LoginScreen

---

### Phase 3 — Apollo Client

**Goal:** Apollo Client initialised with async token auth, AsyncStorage cache persistence, and logging link wired in.

#### 3.1 Copy shared files from web project

Copy the following into `src/apollo/` (no changes needed):
- `pagedField.ts`
- `typePolicies.ts`
- `loggingLink.ts`
- `possibleTypes.json`

Copy `src/types/` and `src/graphql/` directories entirely.

#### 3.2 `src/apollo/asyncStorageWrapper.ts`

The `apollo3-cache-persist` library expects a `KeyValueStore` interface. Wrap AsyncStorage:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { PersistentStorage } from 'apollo3-cache-persist'

export const asyncStorageWrapper: PersistentStorage<string> = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
}
```

#### 3.3 `src/apollo/cachePersistor.ts`

Port from web. Replace `localStorage` with `asyncStorageWrapper`. Same 5 MB cap, same debounce, same exclusion of thumbnail `signedUrl` fields from persistence.

```ts
import { CachePersistor, AsyncStorageWrapper } from 'apollo3-cache-persist'
// or use asyncStorageWrapper from 3.2

const MAX_CACHE_SIZE = 5 * 1024 * 1024  // 5 MB

export async function createCachePersistor(cache: InMemoryCache) {
  const persistor = new CachePersistor({
    cache,
    storage: asyncStorageWrapper,
    maxSize: MAX_CACHE_SIZE,
    persistenceMapper,   // same as web — excludes signedUrl
    debounce: 500,
  })
  await persistor.restore()
  return persistor
}
```

#### 3.4 `src/apollo/client.ts`

```ts
export async function createApolloClient(
  getAccessToken: () => Promise<string>,
  addLogEntry: (entry: QueryLogEntry) => void
): Promise<{ client: ApolloClient<NormalizedCacheObject>; persistor: CachePersistor<NormalizedCacheObject> }> {

  const cache = new InMemoryCache({
    possibleTypes,
    typePolicies,
  })

  const persistor = await createCachePersistor(cache)

  const authLink = new ApolloLink((operation, forward) => {
    // async setContext equivalent using fromPromise
    return fromPromise(
      getAccessToken().then(token => {
        operation.setContext({
          headers: { Authorization: `Bearer ${token}` },
        })
      })
    ).flatMap(() => forward(operation))
  })

  const httpLink = new HttpLink({ uri: process.env.EXPO_PUBLIC_GRAPHQL_ENDPOINT })
  const loggingLink = createLoggingLink(addLogEntry)

  const client = new ApolloClient({
    link: ApolloLink.from([authLink, loggingLink, httpLink]),
    cache,
  })

  return { client, persistor }
}
```

**Async init in `App.tsx`:** `createApolloClient` is awaited before rendering the main app. A simple `SplashScreen` or `ActivityIndicator` shows while initialising (combine with the token restoration check from `AuthContext`).

#### 3.5 `src/context/QueryLogContext.tsx`

Identical logic to web — copy `QueryLogEntry` interface, `QueryLogProvider`, `useQueryLog` hook. No changes needed (no browser APIs used).

#### 3.6 Verify

- [ ] Apollo client initialises and resolves
- [ ] A simple `useQuery(GET_HUBS)` returns data
- [ ] Cache persists to AsyncStorage across app restarts
- [ ] Query Log entries appear after operations

---

### Phase 4 — Navigation Shell

**Goal:** Full navigation structure wired up with placeholder screens. AuthContext controls which navigator is shown.

#### 4.1 `src/navigation/AppNavigator.tsx`

Root component. Reads `isAuthenticated` and `isLoading` from `AuthContext`:
- `isLoading` → show `SplashScreen` / `ActivityIndicator`
- `!isAuthenticated` → render `AuthStack`
- `isAuthenticated` → render `AppDrawer`

```tsx
export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <LoadingView />
  return (
    <NavigationContainer>
      {isAuthenticated ? <AppDrawer /> : <AuthStack />}
    </NavigationContainer>
  )
}
```

#### 4.2 `src/navigation/AuthStack.tsx`

```tsx
const Stack = createStackNavigator()

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="AuthCallback" component={AuthCallbackScreen} />
    </Stack.Navigator>
  )
}
```

#### 4.3 `src/navigation/MainStack.tsx`

Drill-down stack. Each screen receives the node as a route param.

```tsx
const Stack = createStackNavigator<MainStackParamList>()

export type MainStackParamList = {
  Hubs: undefined
  Hub: { hubId: string; hubName: string }
  Project: { projectId: string; projectName: string; hubId: string }
  Folder: { folderId: string; folderName: string; hubId: string; projectId: string }
  Item: { itemId: string; itemName: string; itemType: string; hubId: string; projectId: string }
}

export function MainStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Hubs" component={HubsScreen} options={{ title: 'Hubs' }} />
      <Stack.Screen name="Hub" component={HubScreen} options={({ route }) => ({ title: route.params.hubName })} />
      <Stack.Screen name="Project" component={ProjectScreen} options={({ route }) => ({ title: route.params.projectName })} />
      <Stack.Screen name="Folder" component={FolderScreen} options={({ route }) => ({ title: route.params.folderName })} />
      <Stack.Screen name="Item" component={ItemScreen} options={({ route }) => ({ title: route.params.itemName })} />
    </Stack.Navigator>
  )
}
```

#### 4.4 `src/navigation/AppDrawer.tsx`

```tsx
const Drawer = createDrawerNavigator()

export function AppDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Drawer.Screen name="Main" component={MainStack} />
      <Drawer.Screen name="Search" component={SearchScreen} />
      <Drawer.Screen name="QueryEditor" component={QueryEditorScreen} />
      <Drawer.Screen name="QueryLog" component={QueryLogScreen} />
    </Drawer.Navigator>
  )
}
```

#### 4.5 `src/navigation/DrawerContent.tsx`

Custom drawer component. Uses `useHubs` (Apollo query) to populate the hub list.

**Layout:**
```
┌─────────────────────────────┐
│  [App logo]  Fusion Data    │
│  Demo                       │
├─────────────────────────────┤
│  CE Hubs Only    [ toggle ] │
├─────────────────────────────┤
│  [hub icon]  Hub Name 1     │
│  [hub icon]  Hub Name 2     │
│  ...                        │
├─────────────────────────────┤
│  [search icon] Search       │
│  [code icon]   Query Editor │
│  [list icon]   Query Log    │
├─────────────────────────────┤
│  [settings icon] Settings   │
└─────────────────────────────┘
```

Tapping a hub calls `navigation.navigate('Main', { screen: 'Hub', params: { hubId, hubName } })` and closes the drawer.

CE Hubs Only toggle stored in AsyncStorage (same preference key as web).

#### 4.6 Verify

- [ ] Drawer opens / closes with swipe and hamburger icon
- [ ] Hub list loads in drawer
- [ ] CE Hubs Only toggle filters list
- [ ] Navigate to each placeholder screen via drawer links
- [ ] Back button works in MainStack drill-down

---

### Phase 5 — Drill-down Screens

**Goal:** Hub → Project → Folder → Item navigation with real data loaded at each level.

#### 5.1 Port nav hooks

Copy and verify the following hooks compile in React Native (they use only Apollo and TypeScript — no browser APIs):
- `useNavLoader.ts` — hub list, project children, folder children, item detail
- `useDeepLinkExpansion.ts` — handles deep link navigation to a specific node

#### 5.2 `HubsScreen.tsx`

- Calls `useNavLoader` (hub list query)
- Renders a `FlatList` of hub rows
- Each row: hub type icon + hub name + chevron
- Tap → `navigation.navigate('Hub', { hubId, hubName })`
- Pull-to-refresh support

#### 5.3 `HubScreen.tsx`

- Receives `{ hubId, hubName }` route params
- Loads hub detail via `GET_HUB_DETAIL`
- Bottom tab navigator: **Details** | **Users**
- `DetailsTab`: hub metadata (id, type, region, extension)
- `UsersTab`: members list (Phase 6)

#### 5.4 `ProjectScreen.tsx`

- Receives `{ projectId, projectName, hubId }` route params
- Loads project detail via `GET_PROJECT_DETAIL`
- Bottom tab navigator: **Details** | **Contents** | **Users**
- `DetailsTab`: project metadata
- `ContentsTab`: root folders + items (Phase 6)
- `UsersTab`: members list (Phase 6)

#### 5.5 `FolderScreen.tsx`

- Receives `{ folderId, folderName, hubId, projectId }` route params
- Loads folder detail via `GET_FOLDER_DETAIL`
- Bottom tab navigator: **Details** | **Contents** | **Users**
- Same pattern as ProjectScreen

#### 5.6 `ItemScreen.tsx`

- Receives `{ itemId, itemName, itemType, hubId, projectId }` route params
- Resolves `__typename` from `itemType` to determine available tabs
- Creates bottom tab navigator dynamically based on tab rules
- Loads item detail via `GET_ITEM_DETAIL`

Tab resolution logic (same as web):

```ts
function getItemTabs(typename: string): TabKey[] {
  switch (typename) {
    case 'DesignItem':          return ['details', 'bom', 'view']
    case 'DrawingItem':         return ['details', 'view']
    case 'BasicItem':
    case 'ConfiguredDesignItem':
    default:                    return ['details']
  }
}
```

#### 5.7 Verify

- [ ] HubsScreen loads and displays hub list
- [ ] Tap hub → HubScreen with correct hub name in header
- [ ] HubScreen loads hub metadata in Details tab
- [ ] Tap "Projects" in contents → ProjectScreen
- [ ] ProjectScreen shows correct tabs
- [ ] Tap folder → FolderScreen
- [ ] Tap DesignItem → ItemScreen with Details, BOM, View tabs
- [ ] Tap DrawingItem → ItemScreen with Details, View tabs
- [ ] Back navigation returns to previous screen

---

### Phase 6 — Detail Tabs (Details, Contents, Users)

**Goal:** All non-BOM, non-Viewer tabs implemented with real data.

#### 6.1 `DetailsTab.tsx`

A `ScrollView` rendering `PropertyRow` components (label + value pairs). Groups:
- **Identity**: name, id, type
- **Timestamps**: created, modified
- **Type-specific**: hub region/extension, project status, folder path, item MIME type/size/version

```tsx
function PropertyRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value ?? '—'}</Text>
    </View>
  )
}
```

Uses Paper `Divider` between sections. Adapts styling to Paper theme (light/dark).

#### 6.2 `ContentsTab.tsx`

`FlashList` of child folders and items. Each row:
- Node type icon (folder, design, drawing, etc.)
- Name
- Item type badge (for items)
- Chevron (for folders) / version indicator (for items)

Tap → navigate to child screen.

Supports pull-to-refresh and cursor-based "load more" at the bottom (same pagedField pattern as web).

Folders listed first, then items (same sort as web).

#### 6.3 `UsersTab.tsx`

`FlatList` of members. Each row:
- Avatar (initials if no photo)
- Name + email
- Role badge
- Edit role button (disabled for own row — self-protection)

**Role change**: Tap the role badge → Paper `Menu` with role options. Calls `UPDATE_HUB_MEMBER_ROLE` or `UPDATE_FOLDER_MEMBER_ROLE` mutation. Optimistic update.

**Add members**: FAB (`+` button) at the bottom right → Modal with a multi-line TextInput for email addresses (one per line) + role picker. Calls `ADD_HUB_MEMBERS` or `ADD_FOLDER_MEMBERS` mutation on confirm.

**Remove member**: Long-press row → confirmation `Alert.alert` → `REMOVE_HUB_MEMBER` or `REMOVE_FOLDER_MEMBER` mutation.

**Self-protection**: Compare member `userId` to current user ID from `AuthContext`. Disable role/remove controls on own row.

Same mutation structure as web — queries and mutations are copied unchanged.

#### 6.4 Verify

- [ ] Details tab shows correct metadata for each node type
- [ ] Contents tab loads folders and items with pagination
- [ ] Tap item in ContentsTab navigates to correct ItemScreen
- [ ] Users tab shows member list with roles
- [ ] Role change updates UI optimistically and commits
- [ ] Add member modal works, new member appears in list
- [ ] Own row is disabled (cannot change own role or remove self)

---

### Phase 7 — BOM Tab

**Goal:** Expandable BOM tree using FlashList with column settings, thumbnails, and base property inline editing.

#### 7.1 Port `useBomLoader.ts`

Copy from web project. The hook uses only Apollo Client hooks (`useApolloClient`, `useQuery`) and TypeScript — no browser APIs. Should compile unchanged. Uses same queries (`GET_ROOT_COMPONENT_BOM`, `GET_COMPONENT_BOM_CHILDREN`) and `BomRow` flat-array model from `src/types/bom.types.ts`.

#### 7.2 `BomTab.tsx`

```tsx
export function BomTab({ itemId }: { itemId: string }) {
  const { rows, loading, error, toggleRow, loadMore } = useBomLoader(itemId)
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS)
  const [columnSettingsVisible, setColumnSettingsVisible] = useState(false)

  return (
    <View style={{ flex: 1 }}>
      <BomColumnSettings
        visible={visibleColumns}
        onChangeVisible={setVisibleColumns}
        settingsOpen={columnSettingsVisible}
        onToggleSettings={() => setColumnSettingsVisible(v => !v)}
      />
      <FlashList
        data={rows}
        estimatedItemSize={44}
        keyExtractor={(row) => row.id}
        renderItem={({ item }) => (
          <BomRow
            row={item}
            visibleColumns={visibleColumns}
            onToggle={toggleRow}
            onLoadMore={loadMore}
          />
        )}
      />
    </View>
  )
}
```

#### 7.3 `BomRow.tsx`

Each row renders a horizontal `ScrollView` (for column groups) or switches between column sets via the active column group picker.

**Name cell**: `View` with `paddingLeft: row.depth * 16` for indentation + expand/collapse `TouchableOpacity` + name `Text`.

**Thumbnail**: `react-native-fast-image` sourced from `row.thumbnailUrl`. Fixed 32×32 size. Native disk cache — no IndexedDB needed.

**Column groups:**
- **Base columns**: Name, Part Number, Description, Material (always visible, horizontally scrollable)
- **Physical properties**: Surface Area, Volume, Mass, Density, Bounding Box (toggle group)
- **Base properties**: Inline-editable cells (toggle group)

**Active column group selector**: A row of `Chip` components above the FlashList (`Base | Physical | Properties`). Tapping a chip switches the visible column set.

**Base property edit**: Tap an editable cell → Paper `Dialog` with a `TextInput`. On confirm → `SET_PROPERTIES` mutation with optimistic update.

**Load more sentinel row**: Renders a full-width `Button` "Load more…" that calls `loadMore(row)`.

#### 7.4 Column settings

`BomColumnSettings` renders as a `Modal` bottom sheet (Paper `Portal` + `BottomSheet` pattern) with `Switch` toggles per column. Persisted to AsyncStorage (`bom-visible-columns`).

#### 7.5 Verify

- [ ] BOM loads root component + first-level children for DesignItem
- [ ] Expand row → children insert below, indented correctly
- [ ] Collapse row → descendants removed from list
- [ ] Load more sentinel appears when cursor is non-null, appends correctly
- [ ] Thumbnail renders via react-native-fast-image
- [ ] Physical properties columns visible when group selected
- [ ] Base property edit tap → dialog → mutation fires → optimistic update
- [ ] Column settings modal toggles columns, persists across restarts
- [ ] Cache: re-expand already-loaded row restores from Apollo cache instantly

---

### Phase 8 — APS Viewer (WebView)

**Goal:** APS Viewer embedded via WebView. Model loads, component selection works, properties panel slides out.

#### 8.1 `assets/viewer.html`

A self-contained HTML file bundled with the app. Loaded by WebView via `require('../assets/viewer.html')`.

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css">
  <style>
    html, body, #viewer { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  </style>
</head>
<body>
  <div id="viewer"></div>
  <script src="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js"></script>
  <script>
    var viewer;

    window.initializeViewer = function(token, urn) {
      Autodesk.Viewing.Initializer({
        env: 'AutodeskProduction2',
        api: 'streamingV2',
        getAccessToken: function(callback) { callback(token, 3600); }
      }, function() {
        viewer = new Autodesk.Viewing.GuiViewer3D(document.getElementById('viewer'));
        viewer.start();
        var docId = 'urn:' + urn;
        Autodesk.Viewing.Document.load(docId, function(doc) {
          var viewables = doc.getRoot().search({ type: 'geometry' });
          viewer.loadDocumentNode(doc, viewables[0]);
        }, function(code, msg) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', code: code, message: msg }));
        });
        viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, function() {
          var ids = viewer.getSelection();
          if (!ids.length) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'selection', dbId: null }));
            return;
          }
          var dbId = ids[0];
          viewer.getProperties(dbId, function(props) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'selection',
              dbId: dbId,
              name: props.name,
              properties: props.properties
            }));
          });
        });
      });
    };
  </script>
</body>
</html>
```

#### 8.2 Port `useViewerTranslation.ts`

Copy from web project. Uses only `fetch` + `setInterval` — no browser APIs beyond those available in React Native. Adjust any `import.meta.env` references to `process.env.EXPO_PUBLIC_*`.

#### 8.3 `ViewerWebView.tsx`

```tsx
interface ViewerWebViewProps {
  token: string
  urn: string
  onSelectionChange: (selection: ViewerSelection | null) => void
  onError: (message: string) => void
}

export function ViewerWebView({ token, urn, onSelectionChange, onError }: ViewerWebViewProps) {
  const webViewRef = useRef<WebView>(null)

  // Inject initializeViewer(token, urn) after the page loads
  const injectedJS = `
    window.initializeViewer('${token}', '${urn}');
    true; // required by react-native-webview
  `

  function handleMessage(event: WebViewMessageEvent) {
    const data = JSON.parse(event.nativeEvent.data)
    if (data.type === 'selection') {
      onSelectionChange(data.dbId ? data : null)
    } else if (data.type === 'error') {
      onError(data.message)
    }
  }

  return (
    <WebView
      ref={webViewRef}
      source={require('../../assets/viewer.html')}
      injectedJavaScriptAfterContentLoaded={injectedJS}
      onMessage={handleMessage}
      originWhitelist={['*']}
      allowFileAccess
      allowUniversalAccessFromFileURLs
      javaScriptEnabled
      style={{ flex: 1 }}
    />
  )
}
```

#### 8.4 `ViewerPropertiesPanel.tsx`

A native slide-out panel (uses `Animated.Value` + `Animated.View` to slide in from the right). Renders component properties in accordion sections — same data as web `ViewerPropertiesPanel`. Tap anywhere outside closes it.

```tsx
interface ViewerPropertiesPanelProps {
  selection: ViewerSelection | null
  onClose: () => void
}
```

Property groups rendered as Paper `List.Accordion` components.

#### 8.5 `ViewTab.tsx`

```tsx
export function ViewTab({ itemId, itemType }: { itemId: string; itemType: string }) {
  const { getAccessToken } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [selection, setSelection] = useState<ViewerSelection | null>(null)

  const encodedUrn = useMemo(() => encodeUrn(itemId), [itemId])
  const { status, progress, error } = useViewerTranslation(encodedUrn)

  useEffect(() => {
    if (status === 'ready') {
      getAccessToken().then(setToken)
    }
  }, [status])

  if (status !== 'ready' || !token) {
    return <TranslationStatusView status={status} progress={progress} error={error} />
  }

  return (
    <View style={{ flex: 1 }}>
      <ViewerWebView
        token={token}
        urn={encodedUrn}
        onSelectionChange={setSelection}
        onError={console.error}
      />
      <ViewerPropertiesPanel
        selection={selection}
        onClose={() => setSelection(null)}
      />
    </View>
  )
}
```

`TranslationStatusView` renders loading / progress / error states with Paper `ActivityIndicator`, `Text`, and `Button` (retry).

#### 8.6 Verify

- [ ] DesignItem View tab → translation status indicators appear
- [ ] Model loads in WebView after translation completes
- [ ] Already-translated item → viewer loads immediately (no POST)
- [ ] Tap component in viewer → properties panel slides out
- [ ] Properties panel shows correct component properties
- [ ] Dismiss panel → panel slides away
- [ ] DrawingItem View tab → 2D drawing loads
- [ ] Error state + retry button works

---

### Phase 9 — Search

**Goal:** Full-screen search with free-text and property modes, FlashList results, navigate to found node.

#### 9.1 Port hooks

- `useComponentSearch.ts` — copy from web; uses `useLazyQuery` with `errorPolicy: 'all'`
- `useSearchableProperties.ts` — copy from web; fetches available property definitions for filter mode

Both hooks use only Apollo and TypeScript. Should compile unchanged.

#### 9.2 `SearchScreen.tsx`

Full-screen layout (no drawer overlay):

```
┌─────────────────────────────────────────┐
│  ← Back   [Search input field]    [×]   │
├─────────────────────────────────────────┤
│  Mode: [Free text ●] [Property]         │
│                                         │
│  Type filter: [All] [Component] [File]  │
│               [Folder] [Model]          │
├─────────────────────────────────────────┤
│  Results (FlashList)                    │
│  ┌─────────────────────────────────┐   │
│  │ [thumb] Name  Type  Part No.    │   │
│  │         Parent Folder           │   │
│  └─────────────────────────────────┘   │
│  ... more rows ...                      │
│  [ Load more ]                          │
└─────────────────────────────────────────┘
```

**Mode toggle**: Paper `SegmentedButtons` or two `Button` variants for Free Text / Property.

**Property mode**: Shows a Paper `Menu` / `Picker` for selecting which searchable property to query, plus a TextInput for the value.

**Type filter**: `Chip` group (All / Component / File / Folder / Model). Multiple selection allowed.

**Results FlashList**: Each row shows thumbnail (react-native-fast-image), name, type badge, part number. Secondary line shows parent folder + parent project names as tappable links.

**Navigate to result**: Tap a result row → resolve the node type, construct navigation params, navigate to correct screen in MainStack. Example: `Component` result → navigate to its parent item → ItemScreen → BOM tab.

**Column visibility**: Stored in AsyncStorage.

#### 9.3 `SearchContext.tsx`

Simple context with `isOpen: boolean`, `openSearch()`, `closeSearch()`. Used by the drawer link and search icon in headers.

#### 9.4 Verify

- [ ] SearchScreen opens from drawer nav link
- [ ] Free-text search returns results
- [ ] Property mode search works
- [ ] Type filter chips filter results correctly
- [ ] Tap result row → navigates to correct node
- [ ] Parent Folder / Project links navigate correctly
- [ ] Load more appends additional pages
- [ ] Column visibility persisted across restarts

---

### Phase 10 — GraphiQL + Query Log

**Goal:** GraphiQL embedded in WebView with auth token injected. Query Log as a native FlatList with tap-to-expand and Load in Editor.

#### 10.1 `assets/graphiql.html`

A bundled HTML file that loads GraphiQL from CDN (unpkg), accepts a token via URL hash or `postMessage`, and allows querying the MFG API. Receives queries pre-populated via URL params.

```html
<!DOCTYPE html>
<html>
<head>
  <title>GraphiQL</title>
  <link rel="stylesheet" href="https://unpkg.com/graphiql/graphiql.min.css" />
  <style> html, body, #graphiql { height: 100%; margin: 0; overflow: hidden; } </style>
</head>
<body>
  <div id="graphiql"></div>
  <script src="https://unpkg.com/react/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/graphiql/graphiql.min.js"></script>
  <script>
    var token = null;
    var endpoint = 'https://developer.api.autodesk.com/mfg/v3/graphql/public';

    // Receive token + optional query/variables from React Native
    window.addEventListener('message', function(event) {
      var msg = JSON.parse(event.data);
      if (msg.type === 'init') {
        token = msg.token;
        var fetcher = GraphiQL.createFetcher({
          url: endpoint,
          headers: { Authorization: 'Bearer ' + token }
        });
        ReactDOM.render(
          React.createElement(GraphiQL, {
            fetcher: fetcher,
            defaultQuery: msg.query || '',
            defaultVariables: msg.variables || '',
          }),
          document.getElementById('graphiql')
        );
      }
    });
  </script>
</body>
</html>
```

#### 10.2 `QueryEditorScreen.tsx`

```tsx
export function QueryEditorScreen({ route }) {
  const { getAccessToken } = useAuth()
  const webViewRef = useRef<WebView>(null)
  const { query, variables } = route.params ?? {}

  // Once WebView loads, inject token + optional pre-populated query
  async function onWebViewLoad() {
    const token = await getAccessToken()
    const msg = JSON.stringify({
      type: 'init',
      token,
      query: query ?? '',
      variables: variables ?? '',
    })
    webViewRef.current?.injectJavaScript(`
      window.dispatchEvent(new MessageEvent('message', { data: '${msg.replace(/'/g, "\\'")}' }));
      true;
    `)
  }

  return (
    <WebView
      ref={webViewRef}
      source={require('../../assets/graphiql.html')}
      onLoad={onWebViewLoad}
      javaScriptEnabled
      originWhitelist={['*']}
      style={{ flex: 1 }}
    />
  )
}
```

Route params: `{ query?: string; variables?: string }` — passed from Query Log "Load in Editor".

#### 10.3 `QueryLogContext.tsx`

Identical to web — already copied in Phase 3. The `loggingLink.ts` feeds entries into this context.

#### 10.4 `QueryLogScreen.tsx`

Native `FlatList` (not a WebView). Each row:
- Operation name (bold) + type chip (`Query` / `Mutation` / `Introspection`)
- Timestamp + duration
- Tap to expand: shows full query in monospace `ScrollView`, variables JSON, response JSON
- "Load in Editor" button → `navigation.navigate('QueryEditor', { query: entry.query, variables: JSON.stringify(entry.variables) })`

**Error rows**: Left border in Paper `error` colour when `entry.errors !== null`.

**Toolbar**: Clear Log button in the screen header (Paper `Appbar.Action`).

**Expand/collapse state**: `Set<string>` of expanded entry IDs.

#### 10.5 Verify

- [ ] Query Editor loads GraphiQL with token injected
- [ ] Can run arbitrary queries in GraphiQL
- [ ] Autocomplete works (schema introspection via authenticated fetcher)
- [ ] Query Log entries appear after any Apollo operation
- [ ] Mutation entries appear
- [ ] Tap entry → expands to show query, variables, response
- [ ] "Load in Editor" navigates to QueryEditorScreen with query pre-populated
- [ ] Clear Log empties the list
- [ ] Error rows visually distinguished

---

### Phase 11 — EAS Build + CI

**Goal:** Automated builds via EAS, TestFlight-ready iOS build, Play Store-ready Android build.

#### 11.1 EAS setup

```bash
eas init
eas build:configure
```

Store the following as EAS secrets (not in `.env`):
- `EXPO_PUBLIC_CLIENT_ID`
- `EXPO_PUBLIC_AUTH_URL`
- `EXPO_PUBLIC_TOKEN_URL`
- `EXPO_PUBLIC_SCOPE`
- `EXPO_PUBLIC_GRAPHQL_ENDPOINT`
- `EXPO_PUBLIC_REDIRECT_URI`

#### 11.2 iOS setup

- Apple Developer Program membership required
- Create App ID `com.autodesk.fusiondatademo` in App Store Connect
- Create a Distribution Certificate and Provisioning Profile (or let EAS manage these)
- Configure `eas.json` `submit.production.ios` with Apple ID and ASC App ID

#### 11.3 Android setup

- Create app in Google Play Console (internal track for initial upload)
- Generate a service account key for automated submission
- Configure `eas.json` `submit.production.android`

#### 11.4 GitHub Actions CI

`.github/workflows/eas-build.yml`:

```yaml
name: EAS Build

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    name: EAS Build (preview)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - run: eas build --platform all --profile preview --non-interactive
```

Secrets required in GitHub: `EXPO_TOKEN` (from expo.dev account).

#### 11.5 Submit to TestFlight

```bash
eas build --platform ios --profile preview
eas submit -p ios --latest
```

#### 11.6 Verify

- [ ] `eas build --platform ios --profile development` succeeds
- [ ] `eas build --platform android --profile development` succeeds
- [ ] Preview build installs via TestFlight on a physical iOS device
- [ ] Preview APK installs on Android device
- [ ] Deep link `fusiondatademo://callback` handled correctly post-OAuth on device
- [ ] GitHub Actions workflow triggers and completes successfully

---

### Phase 12 — Final Verification

End-to-end checklist covering all implemented features:

**Auth**
- [ ] OAuth login → token stored → authenticated state
- [ ] Session restored on app restart
- [ ] Token refresh works silently
- [ ] Logout clears tokens and returns to LoginScreen

**Navigation**
- [ ] Drawer opens with hub list
- [ ] CE Hubs Only toggle filters correctly
- [ ] Tap hub → HubScreen (correct hub name in header)
- [ ] Tap project → ProjectScreen
- [ ] Tap folder → FolderScreen
- [ ] Back navigation works at every level
- [ ] Deep link navigates to correct node

**Details Tab**
- [ ] Hub metadata displays correctly
- [ ] Project metadata displays correctly
- [ ] Folder metadata displays correctly
- [ ] Item metadata displays correctly (type-appropriate fields)

**Contents Tab**
- [ ] Project root folders and items load
- [ ] Folder children load
- [ ] Pagination works (load more)
- [ ] Tap navigates to correct child screen

**Users Tab**
- [ ] Hub members list loads with roles
- [ ] Project/Folder members list loads
- [ ] Role change via menu works + optimistic update
- [ ] Add member modal works
- [ ] Own row is disabled
- [ ] Remove member via long-press works

**BOM Tab**
- [ ] Root component + first-level children load
- [ ] Expand/collapse rows
- [ ] Depth indentation correct
- [ ] Load more pagination
- [ ] Thumbnail renders via react-native-fast-image
- [ ] Physical properties column group shows correct values
- [ ] Base property inline edit → mutation fires → optimistic update
- [ ] Column settings persist across restarts

**View Tab**
- [ ] APS Viewer loads in WebView for DesignItem
- [ ] Translation polling with progress indicator
- [ ] Already-translated: viewer loads immediately
- [ ] Select component → properties panel slides out
- [ ] Properties panel shows correct property groups
- [ ] DrawingItem: 2D view loads
- [ ] Retry on failed translation

**Search**
- [ ] SearchScreen opens from drawer
- [ ] Free-text search returns results
- [ ] Property mode search works
- [ ] Type filter chips work
- [ ] Tap result navigates to node
- [ ] Load more appends results

**Query Editor**
- [ ] GraphiQL loads with auth token
- [ ] Can run queries
- [ ] Autocomplete works
- [ ] Pre-populated query from Query Log renders correctly

**Query Log**
- [ ] Entries appear after Apollo operations
- [ ] Tap to expand shows full query/variables/response
- [ ] Load in Editor passes query + variables to QueryEditorScreen
- [ ] Clear Log empties the list

**Build**
- [ ] EAS build succeeds for both platforms
- [ ] TestFlight build installs and runs on physical iOS device
- [ ] Android APK installs and runs on physical Android device

---

## Key Differences from Web App

| Topic | Web | Mobile |
|-------|-----|--------|
| Token storage | `localStorage` / `sessionStorage` | `expo-secure-store` (encrypted) |
| Cache persistence | `localStorage` | `AsyncStorage` |
| Auth flow | `window.location.href` redirect | `expo-auth-session` in-app browser |
| PKCE helper | Custom `pkceHelper.ts` | Built into `expo-auth-session` |
| APS Viewer | Direct WebGL in DOM | Bundled HTML in `react-native-webview` |
| GraphiQL | npm package, React component | Bundled HTML in `react-native-webview` |
| Navigation | React Router v7, URL-based | React Navigation v7, stack/drawer |
| Lists | MUI DataGrid | FlashList (BOM, Search) / FlatList (Users, QueryLog) |
| Thumbnails | IndexedDB + blob URLs | `react-native-fast-image` native cache |
| Design system | MUI v7 + Weave 3 | `react-native-paper` v5 |
| Column settings storage | `localStorage` | AsyncStorage |
| Environment variables | `VITE_*` | `EXPO_PUBLIC_*` |
| Build tooling | Vite | Expo / Metro |
| Distribution | GitHub Pages | TestFlight + Play Store beta |

---

## Open Questions

| Topic | Status | Answer |
|-------|--------|--------|
| iOS only or both? | Resolved | Both iOS + Android |
| Include APS Viewer? | Resolved | Yes, via WebView |
| Monorepo or separate repo? | Resolved | Separate repo `fusion-data-demo-mobile` |
| Distribution? | Resolved | TestFlight (iOS), Play Store beta (Android) |
| Custom URL scheme? | Resolved | `fusiondatademo://callback` — register in APS app credentials |
| Shared package? | Resolved | Copy files initially; extract workspace if it becomes painful |
| GraphiQL + Query Log? | Resolved | Yes, both included |
| react-native-fast-image on Expo managed? | Open | Verify compatibility with Expo SDK 52; if incompatible, use `expo-image` as the drop-in replacement |
| WebView CORS for APS Viewer CDN? | Open | Test on physical device; may need `allowUniversalAccessFromFileURLs` on Android |

---

## Non-goals (this plan)

- Subscriptions (API does not support WebSocket subscriptions)
- Offline mode (cache persistence is performance/UX only — not full offline support)
- Push notifications
- File upload or versioning
- Multiple saved queries in the editor
- Sharing / export features
- iPad-specific split-view layout (phone layout used for all form factors in v1)

---

*Last updated: 2026-05-09*
