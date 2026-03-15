import { createClient } from "@/lib/supabase/server";
import type { MatchedChunk } from "@/lib/types/database";

/**
 * Retrieve relevant chunks via vector similarity search.
 * Calls the match_chunks Postgres function which uses pgvector cosine distance.
 */
export async function retrieveChunks(
  queryEmbedding: number[],
  matchCount = 5,
  matchThreshold = 0.7
): Promise<MatchedChunk[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    throw new Error(`Failed to retrieve chunks: ${error.message}`);
  }

  return (data ?? []) as MatchedChunk[];
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
