import { TypographyVariantsOptions } from '@mui/material/styles';
import type { WeaveDensity } from '../types';
import { densityTokens } from '../tokens/density';

export function createTypography(density: WeaveDensity): TypographyVariantsOptions {
  const d = densityTokens[density];
  const fs = (key: string, fallback: number) => (d[key] as number) || fallback;
  const lh = (key: string, fallback: number) => `${(d[key] as number) || fallback}px`;
  return {
    fontFamily: 'ArtifaktElement, -apple-system, BlinkMacSystemFont, sans-serif',
    // Align MUI's weight constants to the Weave 3 / ArtifaktElement weight set.
    // Without these, fontWeightMedium defaults to 500 which has no @font-face,
    // causing the browser to synthesize it from the nearest loaded weight.
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 600,
    fontWeightBold: 700,
    h1: { fontSize: fs('semantic/font-size/variable/xxl', 28), lineHeight: lh('semantic/line-height/variable/xxl', 36), fontWeight: 700 },
    h2: { fontSize: fs('semantic/font-size/variable/xl', 24), lineHeight: lh('semantic/line-height/variable/xl', 32), fontWeight: 700 },
    h3: { fontSize: fs('semantic/font-size/variable/l', 18), lineHeight: lh('semantic/line-height/variable/l', 24), fontWeight: 700 },
    h4: { fontSize: fs('semantic/font-size/variable/l', 18), lineHeight: lh('semantic/line-height/variable/l', 24), fontWeight: 600 },
    h5: { fontSize: fs('semantic/font-size/variable/m', 14), lineHeight: lh('semantic/line-height/variable/m', 20), fontWeight: 600 },
    h6: { fontSize: fs('semantic/font-size/variable/s', 12), lineHeight: lh('semantic/line-height/variable/s', 16), fontWeight: 600 },
    body1: { fontSize: fs('semantic/font-size/variable/m', 14), lineHeight: lh('semantic/line-height/variable/m', 20) },
    body2: { fontSize: fs('semantic/font-size/variable/s', 12), lineHeight: lh('semantic/line-height/variable/s', 16) },
    button: { fontSize: fs('semantic/font-size/variable/m', 14), fontWeight: 600, textTransform: 'none' as const },
    caption: { fontSize: 11, lineHeight: '16px' },
    overline: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
    subtitle1: { fontSize: fs('semantic/font-size/variable/m', 14), fontWeight: 600 },
    subtitle2: { fontSize: fs('semantic/font-size/variable/s', 12), fontWeight: 600 },
  };
}
