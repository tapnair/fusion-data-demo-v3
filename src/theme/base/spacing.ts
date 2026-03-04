import type { WeaveDensity } from '../types';
import { densityTokens } from '../tokens/density';

export function createSpacing(density: WeaveDensity) {
  const d = densityTokens[density];
  const steps = [
    0,
    (d['semantic/spacing/variable/xxs'] as number) || 4,
    (d['semantic/spacing/variable/xs'] as number) || 8,
    (d['semantic/spacing/variable/s'] as number) || 12,
    (d['semantic/spacing/variable/m'] as number) || 16,
    (d['semantic/spacing/variable/l'] as number) || 24,
    (d['semantic/spacing/variable/xl'] as number) || 32,
    (d['semantic/spacing/variable/xxl'] as number) || 48,
  ];
  return (factor: number) => `${steps[factor] ?? factor * 8}px`;
}
