import { pipeline } from "@xenova/transformers";

type Extractor = (
  text: string,
  options?: Record<string, unknown>,
) => Promise<{ data: Float32Array }>;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let extractorPromise: Promise<Extractor> | null = null;

function getExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      "feature-extraction",
      MODEL_ID,
    ) as unknown as Promise<Extractor>;
  }
  return extractorPromise;
}

/** Start downloading/loading the model in the background. */
export function warmup(): void {
  void getExtractor().catch((err) => console.error("Model warmup failed:", err));
}

/** Embed text into a normalized vector (mean pooling). */
export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/** Cosine similarity. Vectors from `embed` are normalized, so this is the dot product. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}
