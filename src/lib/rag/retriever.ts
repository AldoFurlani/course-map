import { createClient } from "@/lib/supabase/server";
import type { MatchedChunk } from "@/lib/types/database";

/**
 * Retrieve relevant chunks via vector similarity search.
 * Calls the match_chunks Postgres function which uses pgvector cosine distance.
 */
export async function retrieveChunks(
  queryEmbedding: number[],
  courseId: string,
  matchCount = 5,
  matchThreshold = 0.7
): Promise<MatchedChunk[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    p_course_id: courseId,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    throw new Error(`Failed to retrieve chunks: ${error.message}`);
  }

  return (data ?? []) as MatchedChunk[];
}

/**
 * Compute a similarity threshold to filter false positives.
 *
 * gte-small (384d) cosine similarity scores cluster in a narrow band — even
 * unrelated text can score 0.5–0.7 against a large corpus.
 *
 * Empirically, unrelated concepts (e.g. "Aerodynamics" against ML notes)
 * top out at ~0.80, while related concepts score 0.85+. A fixed floor of
 * 0.80 cleanly separates the two clusters without over-filtering borderline
 * real matches.
 */
export function filterByRelativeScore(
  chunks: { similarity: number }[],
  absoluteFloor = 0.80
): number {
  if (chunks.length < 2) return absoluteFloor;
  return absoluteFloor;
}

/**
 * Build a context string from retrieved chunks for LLM prompting.
 */
export function buildContext(chunks: MatchedChunk[]): string {
  if (chunks.length === 0) return "";

  return chunks
    .map(
      (chunk, i) =>
        `[Source ${i + 1} (similarity: ${chunk.similarity.toFixed(2)})]:\n${chunk.chunk_text}`
    )
    .join("\n\n---\n\n");
}
