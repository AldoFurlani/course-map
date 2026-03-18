import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCourseOwner } from "@/lib/auth";
import { generateConceptGraph } from "@/lib/ai/generate-graph";
import { validateDAG } from "@/lib/graph/cycle-detection";
import type { GeneratedConcept, GeneratedEdge } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const courseId = body.course_id as string;

  if (!courseId) {
    return NextResponse.json({ error: "course_id is required" }, { status: 400 });
  }

  const auth = await requireCourseOwner(courseId);
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();

  // Rate limit: 50 concepts created per hour globally (across all user's courses)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: userCourses } = await supabase
    .from("courses")
    .select("id")
    .eq("user_id", auth.user.id);

  const userCourseIds = (userCourses ?? []).map((c) => c.id);

  if (userCourseIds.length > 0) {
    const { count } = await supabase
      .from("concepts")
      .select("*", { count: "exact", head: true })
      .in("course_id", userCourseIds)
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= 50) {
      return NextResponse.json(
        { error: "Graph generation rate limit exceeded (50 concepts/hr). Please wait before generating again." },
        { status: 429 }
      );
    }
  }

  // Fetch all chunks for this course (include id for mapping)
  const { data: chunks, error: chunksError } = await supabase
    .from("course_material_chunks")
    .select("id, material_id, chunk_text, chunk_index")
    .eq("course_id", courseId)
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

  // Fetch existing concepts for this course
  const { data: existingConcepts } = await supabase
    .from("concepts")
    .select("*")
    .eq("course_id", courseId)
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
              (be: { source: string; target: string }) =>
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
