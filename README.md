# Fusion Data Demo v3

A modern single-page application built with Vite, React, and TypeScript that integrates with Autodesk Platform Services (APS) using OAuth 2.0 PKCE authentication to access the Manufacturing Data Model API.

## Features

- 🔐 Secure PKCE OAuth 2.0 authentication with Autodesk APS
- 📊 Access to Manufacturing Data Model API v3
- 🏢 Display user hubs after authentication
- 🎨 **Weave 3 Design System** - Enterprise-grade Autodesk theming
  - 3 color schemes: Light Gray, Dark Gray, Dark Blue
  - 3 density levels: High (Compact), Medium, Low (Comfortable)
  - Theme persistence with localStorage
- ⚡ Built with Vite for fast development and optimized builds
- 💪 TypeScript for type safety
- ⚛️ React 19+ for modern UI development
- 🎯 Material-UI v7 with custom Weave 3 component overrides

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm or yarn
- Autodesk APS account and registered application

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and update with your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Autodesk APS credentials:

```env
VITE_CLIENT_ID=your-client-id-here
VITE_AUTH_URL=https://developer.api.autodesk.com/authentication/v2/authorize
VITE_TOKEN_URL=https://developer.api.autodesk.com/authentication/v2/token
VITE_REDIRECT_URI=http://localhost:5173/callback
VITE_SCOPE=data:read data:write
VITE_GRAPHQL_ENDPOINT=https://developer.api.autodesk.com/mfg/v3/graphql/public
```

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

The optimized build will be in the `dist` directory.

## Project Structure

```
fusion-data-demo-v3/
├── public/              # Static assets
├── src/
│   ├── assets/          # Stylesheets and images
│   ├── components/      # React components
│   │   ├── auth/        # Authentication components
│   │   ├── common/      # Shared components
│   │   ├── hubs/        # Hub-related components
│   │   └── layout/      # Layout components
│   ├── context/         # React context providers
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Page components
│   ├── services/        # API services
│   │   ├── auth/        # Authentication services
│   │   └── api/         # API clients
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── .env.local           # Local environment variables (not in git)
├── .env.example         # Example environment variables
└── package.json         # Project dependencies and scripts
```

## Weave 3 Theme System

This application implements the **Autodesk Weave 3 Design System**, providing a professional, enterprise-grade user interface.

### Theme Options

**Color Schemes:**
- **Light Gray** (default) - Clean light theme with gray surfaces
- **Dark Gray** - Dark theme with dark gray surfaces
- **Dark Blue** - Dark theme with navy blue surfaces

**Density Levels:**
- **High (Compact)** - Tighter spacing, ideal for data-dense interfaces
- **Medium (default)** - Balanced spacing for general use
- **Low (Comfortable)** - Spacious layout for improved readability

### Theme Switcher

When authenticated, access theme controls via the **Settings icon** (⚙️) in the top right corner of the header. Your theme preference is automatically saved and persists across sessions.

### Typography

The application uses **ArtifaktElement** font family, loaded from Autodesk's CDN, providing a consistent typographic experience across all Autodesk products.

See [THEME.md](./THEME.md) for detailed theme documentation.

## Authentication Flow

1. User clicks "Login with Autodesk"
2. App generates PKCE code verifier and challenge
3. User redirects to Autodesk authorization server
4. User grants permissions
5. Autodesk redirects back to `/callback` with authorization code
6. App exchanges code for access token using PKCE verifier
7. User redirects to dashboard
8. **App fetches and displays user hubs**

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run TypeScript type checking

## Technologies

- **Vite 7** - Build tool and dev server
- **React 19** - UI library
- **TypeScript 5** - Type safety
- **Material-UI v7** - Component library with Weave 3 theming
- **Emotion** - CSS-in-JS styling engine
- **React Router 7** - Client-side routing
- **Axios** - HTTP client
- **Autodesk APS** - Platform services
- **Weave 3** - Autodesk design system (2200+ design tokens)

## Documentation

- [framework_plan.md](./framework_plan.md) - Original implementation plan
- [weave_v3_plan.md](./weave_v3_plan.md) - Weave 3 integration plan
- [THEME.md](./THEME.md) - Theme system documentation

## License

MIT
