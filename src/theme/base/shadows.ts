import type { Theme } from '@mui/material/styles';
import type { WeaveColorScheme } from '../types';
import { themeTokens } from '../tokens/theme';

export function createShadows(scheme: WeaveColorScheme): Theme['shadows'] {
  const t = themeTokens[scheme];
  const low = (t['semantic/shadow/shadow-one'] as string) || '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)';
  const high = (t['semantic/shadow/shadow-two'] as string) || '0 4px 12px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1)';
  return [
    'none', low, low, low, low,
    high, high, high, high, high, high, high, high, high, high,
    high, high, high, high, high, high, high, high, high, high,
  ] as Theme['shadows'];
}
