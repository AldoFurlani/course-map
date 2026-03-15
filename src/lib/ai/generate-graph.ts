import { generateText, Output } from "ai";
import { z } from "zod";
import { model } from "./client";
import type { Concept } from "@/lib/types/database";

const MAX_CHARS = 120_000;

export interface ChunkInput {
  id: string;
  material_id: string;
  chunk_text: string;
  chunk_index: number;
}

const graphSchema = z.object({
  concepts: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      source_chunks: z
        .array(z.number())
        .describe("Indices of chunks (from the numbered list) that cover this concept"),
    })
  ),
  edges: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
    })
  ),
});

export type GeneratedGraph = z.infer<typeof graphSchema>;

/** Maps LLM chunk indices back to chunk DB IDs */
export interface GeneratedGraphWithMappings {
  graph: GeneratedGraph;
  chunkIdByIndex: Map<number, string>;
}

/**
 * Sample chunks to fit within the character budget.
 * Returns the selected ChunkInput objects so we can track their IDs.
 */
function sampleChunks(chunks: ChunkInput[]): ChunkInput[] {
  const byMaterial = new Map<string, ChunkInput[]>();
  for (const chunk of chunks) {
    const group = byMaterial.get(chunk.material_id) ?? [];
    group.push(chunk);
    byMaterial.set(chunk.material_id, group);
  }

  const selected: ChunkInput[] = [];
  const remaining: ChunkInput[] = [];
  let selectedChars = 0;

  for (const [, materialChunks] of byMaterial) {
    const sorted = materialChunks.sort((a, b) => a.chunk_index - b.chunk_index);
    selected.push(sorted[0]);
    selectedChars += sorted[0].chunk_text.length;
    if (sorted.length > 1) {
      selected.push(sorted[sorted.length - 1]);
      selectedChars += sorted[sorted.length - 1].chunk_text.length;
    }
    for (let i = 1; i < sorted.length - 1; i++) {
      remaining.push(sorted[i]);
    }
  }

  if (remaining.length > 0 && selectedChars < MAX_CHARS) {
    const budget = MAX_CHARS - selectedChars;
    const step = Math.max(
      1,
      Math.floor(remaining.length / Math.ceil(budget / 512))
    );
    for (let i = 0; i < remaining.length && selectedChars < MAX_CHARS; i += step) {
      selected.push(remaining[i]);
      selectedChars += remaining[i].chunk_text.length;
    }
  }

  return selected;
}

export async function generateConceptGraph(
  chunks: ChunkInput[],
  existingConcepts: Concept[]
): Promise<GeneratedGraphWithMappings> {
  const totalChars = chunks.reduce((sum, c) => sum + c.chunk_text.length, 0);

  const selectedChunks =
    totalChars <= MAX_CHARS
      ? chunks.sort((a, b) =>
          a.material_id === b.material_id
            ? a.chunk_index - b.chunk_index
            : a.material_id.localeCompare(b.material_id)
        )
      : sampleChunks(chunks);

  // Build index→ID mapping and numbered text
  const chunkIdByIndex = new Map<number, string>();
  const numberedTexts = selectedChunks.map((c, i) => {
    chunkIdByIndex.set(i, c.id);
    return `[Chunk ${i}]\n${c.chunk_text}`;
  });

  const materialText = numberedTexts.join("\n\n---\n\n");

  const existingSection =
    existingConcepts.length > 0
      ? `\nThe following concepts already exist in the course. Reuse these exact names where they match the material content. You may add new concepts that are missing.\n\nExisting concepts:\n${existingConcepts.map((c) => `- ${c.name}: ${c.description}`).join("\n")}\n`
      : "";

  const prompt = `You are an expert curriculum designer. Analyze the following course materials and extract the key concepts and their prerequisite relationships to form a concept dependency graph (DAG).

## Instructions

1. Extract concepts that represent distinct, teachable topics.
2. Keep concept names concise (2-5 words) and descriptions to 1-2 sentences.
3. Determine prerequisite relationships: an edge from concept A to concept B means A must be understood before B.
4. The graph MUST be a directed acyclic graph (DAG) — no cycles allowed.
5. Only include edges where there is a genuine prerequisite dependency, not just topical similarity.
6. For each concept, list the chunk indices (the numbers in [Chunk N] headers) that directly teach or explain that concept. Each concept should reference 4-6 chunks. If a topic spans significantly more material, split it into more specific sub-concepts (e.g. "Continuous Optimization" covering 20 chunks should become "Gradient Descent", "Convexity", "Second-Order Methods", etc.).
${existingSection}
## Course Materials

${materialText}`;

  const { output } = await generateText({
    model,
    prompt,
    output: Output.object({ schema: graphSchema }),
  });

  if (!output) {
    throw new Error("Failed to generate concept graph: no output from model");
  }

  return { graph: output, chunkIdByIndex };
}
