/**
 * Pure ranking math — no dependencies, unit-testable with `node --test`.
 * NOTE: demo/index.html mirrors FIELD_WEIGHTS; keep them in sync.
 */

/** Cosine similarity. Vectors from `embed` are normalized, so this is the dot product. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

export interface FieldVectors {
  title: number[];
  url: number[];
  content: number[];
}

/** Field weights: the title matters most, the URL least. Must sum to 1. */
export const FIELD_WEIGHTS = { title: 0.5, url: 0.15, content: 0.35 } as const;

export function weightedScore(query: number[], fields: FieldVectors): number {
  return (
    FIELD_WEIGHTS.title * cosineSimilarity(query, fields.title) +
    FIELD_WEIGHTS.url * cosineSimilarity(query, fields.url) +
    FIELD_WEIGHTS.content * cosineSimilarity(query, fields.content)
  );
}

const FIVE_MINUTES = 5 * 60_000;
const ONE_HOUR = 60 * 60_000;

/** Small boost for recently-used tabs so fresh context wins ties. */
export function recencyBoost(lastActiveMs: number, nowMs: number): number {
  const age = nowMs - lastActiveMs;
  if (age < FIVE_MINUTES) return 0.08;
  if (age < ONE_HOUR) return 0.04;
  return 0;
}
