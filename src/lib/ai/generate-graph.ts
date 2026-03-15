import { generateText, Output } from "ai";
import { z } from "zod";
import { model } from "./client";
import type { Concept } from "@/lib/types/database";

const MAX_CHARS = 120_000;

const graphSchema = z.object({
  concepts: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
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

/**
 * Sample chunks to fit within the character budget.
 * Strategy: first + last chunk per material, then fill evenly.
 */
function sampleChunks(
  chunks: { material_id: string; chunk_text: string; chunk_index: number }[]
): string[] {
  // Group by material
  const byMaterial = new Map<string, typeof chunks>();
  for (const chunk of chunks) {
    const group = byMaterial.get(chunk.material_id) ?? [];
    group.push(chunk);
    byMaterial.set(chunk.material_id, group);
  }

  // First pass: first + last chunk per material
  const selected: string[] = [];
  const remaining: string[] = [];
  let selectedChars = 0;

  for (const [, materialChunks] of byMaterial) {
    const sorted = materialChunks.sort((a, b) => a.chunk_index - b.chunk_index);
    // Always include first and last
    selected.push(sorted[0].chunk_text);
    selectedChars += sorted[0].chunk_text.length;
    if (sorted.length > 1) {
      selected.push(sorted[sorted.length - 1].chunk_text);
      selectedChars += sorted[sorted.length - 1].chunk_text.length;
    }
    // Middle chunks go to remaining pool
    for (let i = 1; i < sorted.length - 1; i++) {
      remaining.push(sorted[i].chunk_text);
    }
  }

  // Fill remaining budget evenly
  if (remaining.length > 0 && selectedChars < MAX_CHARS) {
    const budget = MAX_CHARS - selectedChars;
    const step = Math.max(1, Math.floor(remaining.length / Math.ceil(budget / 512)));
    for (let i = 0; i < remaining.length && selectedChars < MAX_CHARS; i += step) {
      selected.push(remaining[i]);
      selectedChars += remaining[i].length;
    }
  }

  return selected;
}

export async function generateConceptGraph(
  chunks: { material_id: string; chunk_text: string; chunk_index: number }[],
  existingConcepts: Concept[]
): Promise<GeneratedGraph> {
  // Concatenate chunk texts, sampling if needed
  const totalChars = chunks.reduce((sum, c) => sum + c.chunk_text.length, 0);
  const texts =
    totalChars <= MAX_CHARS
      ? chunks
          .sort((a, b) =>
            a.material_id === b.material_id
              ? a.chunk_index - b.chunk_index
              : a.material_id.localeCompare(b.material_id)
          )
          .map((c) => c.chunk_text)
      : sampleChunks(chunks);

  const materialText = texts.join("\n\n---\n\n");

  const existingSection =
    existingConcepts.length > 0
      ? `\nThe following concepts already exist in the course. Reuse these exact names where they match the material content. You may add new concepts that are missing.\n\nExisting concepts:\n${existingConcepts.map((c) => `- ${c.name}: ${c.description}`).join("\n")}\n`
      : "";

  const prompt = `You are an expert curriculum designer. Analyze the following course materials and extract the key concepts and their prerequisite relationships to form a concept dependency graph (DAG).

## Instructions

1. Extract concepts that represent distinct, teachable topics — each roughly 1-3 lectures worth of content.
2. Keep concept names concise (2-5 words) and descriptions to 1-2 sentences.
3. Determine prerequisite relationships: an edge from concept A to concept B means A must be understood before B.
4. The graph MUST be a directed acyclic graph (DAG) — no cycles allowed.
5. Only include edges where there is a genuine prerequisite dependency, not just topical similarity.
6. Aim for 8-25 concepts depending on the breadth of the material.
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

  return output;
}
