/**
 * Weave 3 — ArtifaktElement Font
 *
 * CDN: https://fonts.autodesk.com/ArtifaktElement/WOFF2/
 * Local fallback: /fonts/*.woff2 (bundled in this repo)
 *
 * Available weights (no italic variants exist):
 *   200 → Light
 *   300 → Book
 *   400 → Regular   ← Weave token: fontWeight.regular
 *   500 → Medium    ← Weave token: fontWeight.medium (used at CSS weight 600)
 *   700 → Bold      ← Weave token: fontWeight.bold
 *   900 → Black
 *
 * Note: Weave 3 uses 400/600/700. We map:
 *   400 → Regular, 600 → Medium, 700 → Bold
 */

const CDN_BASE = 'https://fonts.autodesk.com/ArtifaktElement/WOFF2';

export const artifaktFontFace = `
  @font-face {
    font-family: 'ArtifaktElement';
    src: url('${CDN_BASE}/Artifakt%20Element%20Light.woff2') format('woff2');
    font-weight: 200;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'ArtifaktElement';
    src: url('${CDN_BASE}/Artifakt%20Element%20Book.woff2') format('woff2');
    font-weight: 300;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'ArtifaktElement';
    src: url('${CDN_BASE}/Artifakt%20Element%20Regular.woff2') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'ArtifaktElement';
    src: url('${CDN_BASE}/Artifakt%20Element%20Medium.woff2') format('woff2');
    font-weight: 600;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'ArtifaktElement';
    src: url('${CDN_BASE}/Artifakt%20Element%20Bold.woff2') format('woff2');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'ArtifaktElement';
    src: url('${CDN_BASE}/Artifakt%20Element%20Black.woff2') format('woff2');
    font-weight: 900;
    font-style: normal;
    font-display: swap;
  }
`;

/**
 * MUI GlobalStyles usage:
 *
 *   import { GlobalStyles } from '@mui/material';
 *   import { artifaktFontFace } from './fonts';
 *
 *   <GlobalStyles styles={artifaktFontFace} />
 *
 * Or inject directly in createTheme via MuiCssBaseline:
 *
 *   components: {
 *     MuiCssBaseline: {
 *       styleOverrides: artifaktFontFace
 *     }
 *   }
 */
