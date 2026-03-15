import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateConceptGraph } from "@/lib/ai/generate-graph";
import { validateDAG } from "@/lib/graph/cycle-detection";
import type { GeneratedConcept, GeneratedEdge } from "@/lib/types/database";

export async function POST() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = user.user_metadata?.role;
  if (role !== "professor" && role !== "ta") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all chunks (include id for mapping)
  const { data: chunks, error: chunksError } = await supabase
    .from("course_material_chunks")
    .select("id, material_id, chunk_text, chunk_index")
    .order("material_id")
    .order("chunk_index");

  if (chunksError) {
    return NextResponse.json({ error: chunksError.message }, { status: 500 });
  }

  if (!chunks || chunks.length === 0) {
    return NextResponse.json(
      { error: "No course materials found. Upload materials first." },
      { status: 400 }
    );
  }

  // Fetch existing concepts
  const { data: existingConcepts } = await supabase
    .from("concepts")
    .select("*")
    .order("name");

  try {
    const { graph: result, chunkIdByIndex } = await generateConceptGraph(
      chunks,
      existingConcepts ?? []
    );

    // Build a lookup of existing concepts (case-insensitive)
    const existingMap = new Map(
      (existingConcepts ?? []).map((c) => [c.name.toLowerCase().trim(), c])
    );

    // Deduplicate and match concepts
    const seenNames = new Set<string>();
    const concepts: GeneratedConcept[] = [];

    for (const concept of result.concepts) {
      const key = concept.name.toLowerCase().trim();
      if (seenNames.has(key)) continue;
      seenNames.add(key);

      const existing = existingMap.get(key);

      // Map LLM chunk indices back to DB chunk IDs
      const sourceChunkIds = (concept.source_chunks ?? [])
        .map((idx) => chunkIdByIndex.get(idx))
        .filter((id): id is string => id !== undefined);

      concepts.push({
        name: existing ? existing.name : concept.name,
        description: existing ? existing.description : concept.description,
        status: existing ? "existing" : "new",
        existing_id: existing?.id,
        source_chunk_ids: sourceChunkIds,
      });
    }

    // Validate edges: remove invalid references and self-loops
    const validNames = new Set(concepts.map((c) => c.name.toLowerCase().trim()));
    const edges: GeneratedEdge[] = [];
    const seenEdges = new Set<string>();

    for (const edge of result.edges) {
      const sourceKey = edge.source.toLowerCase().trim();
      const targetKey = edge.target.toLowerCase().trim();

      if (sourceKey === targetKey) continue;
      if (!validNames.has(sourceKey) || !validNames.has(targetKey)) continue;

      const edgeKey = `${sourceKey}->${targetKey}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);

      // Use the canonical name from our concepts list
      const sourceConcept = concepts.find(
        (c) => c.name.toLowerCase().trim() === sourceKey
      )!;
      const targetConcept = concepts.find(
        (c) => c.name.toLowerCase().trim() === targetKey
      )!;

      edges.push({
        source_name: sourceConcept.name,
        target_name: targetConcept.name,
      });
    }

    // Validate DAG and strip back-edges
    const dagResult = validateDAG(
      edges.map((e) => ({ source: e.source_name, target: e.target_name }))
    );

    const finalEdges = dagResult.valid
      ? edges
      : edges.filter(
          (e) =>
            !dagResult.backEdges.some(
              (be) =>
                be.source === e.source_name && be.target === e.target_name
            )
        );

    return NextResponse.json({ concepts, edges: finalEdges });
  } catch (err) {
    console.error("Graph generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate concept graph. Please try again." },
      { status: 500 }
    );
  }
}
