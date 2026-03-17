import { createClient } from "@/lib/supabase/server";
import type { Concept } from "@/lib/types/database";

/**
 * Embed a text string via the Supabase edge function.
 */
export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [text] }),
    }
  );

  if (!res.ok) {
    throw new Error(`Embedding failed: ${res.statusText}`);
  }

  const { embeddings } = await res.json();
  return embeddings[0];
}

/**
 * Get the embedding for a concept, using the cached value if available.
 * Caches the result on the concept row for future use.
 */
export async function getConceptEmbedding(concept: Concept): Promise<number[]> {
  if (concept.cached_embedding) {
    return concept.cached_embedding;
  }

  const queryText = `${concept.name}: ${concept.description}`;
  const embedding = await embedText(queryText);

  // Cache for future use (fire-and-forget)
  const supabase = await createClient();
  supabase
    .from("concepts")
    .update({ cached_embedding: JSON.stringify(embedding) })
    .eq("id", concept.id)
    .then();

  return embedding;
}
