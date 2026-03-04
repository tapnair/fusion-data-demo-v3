import type { WeaveDensity } from '../types';
import { densityTokens } from '../tokens/density';

export function createShape(density: WeaveDensity) {
  const d = densityTokens[density];
  return { borderRadius: (d['semantic/border-radius/variable/s'] as number) || 4 };
}
