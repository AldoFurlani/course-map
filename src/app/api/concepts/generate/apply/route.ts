import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { wouldCreateCycle } from "@/lib/graph/cycle-detection";
import type {
  GeneratedConcept,
  GeneratedEdge,
  Concept,
  ConceptEdge,
} from "@/lib/types/database";

interface ApplyPayload {
  concepts: GeneratedConcept[];
  edges: GeneratedEdge[];
}

export async function POST(request: NextRequest) {
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

  const body = (await request.json()) as ApplyPayload;

  if (!body.concepts || !body.edges) {
    return NextResponse.json(
      { error: "concepts and edges are required" },
      { status: 400 }
    );
  }

  // Build a name -> id map for resolving edge references
  const nameToId = new Map<string, string>();

  // First, map existing concepts
  for (const concept of body.concepts) {
    if (concept.status === "existing" && concept.existing_id) {
      nameToId.set(concept.name.toLowerCase().trim(), concept.existing_id);
    }
  }

  // Insert new concepts
  const newConcepts = body.concepts.filter((c) => c.status === "new");
  if (newConcepts.length > 0) {
    const { data: created, error: insertError } = await supabase
      .from("concepts")
      .insert(
        newConcepts.map((c) => ({
          name: c.name.trim(),
          description: c.description.trim(),
        }))
      )
      .select();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    for (const concept of created as Concept[]) {
      nameToId.set(concept.name.toLowerCase().trim(), concept.id);
    }
  }

  // Save concept-chunk mappings for all concepts that have source_chunk_ids
  const chunkMappings: { concept_id: string; chunk_id: string }[] = [];
  for (const concept of body.concepts) {
    const conceptId = nameToId.get(concept.name.toLowerCase().trim());
    if (!conceptId || !concept.source_chunk_ids?.length) continue;

    for (const chunkId of concept.source_chunk_ids) {
      chunkMappings.push({ concept_id: conceptId, chunk_id: chunkId });
    }
  }

  if (chunkMappings.length > 0) {
    // Delete existing mappings for these concepts so re-generation replaces them
    const conceptIds = [...new Set(chunkMappings.map((m) => m.concept_id))];
    await supabase
      .from("concept_chunks")
      .delete()
      .in("concept_id", conceptIds);

    const { error: mappingError } = await supabase
      .from("concept_chunks")
      .insert(chunkMappings);

    if (mappingError) {
      console.error("Failed to save concept-chunk mappings:", mappingError);
      // Non-fatal: continue even if mappings fail
    }
  }

  // Fetch existing edges for cycle detection
  const { data: existingEdges } = await supabase
    .from("concept_edges")
    .select("*");

  const allEdges: ConceptEdge[] = existingEdges ?? [];
  const createdEdges: ConceptEdge[] = [];

  // Insert edges one by one with cycle detection
  for (const edge of body.edges) {
    const sourceId = nameToId.get(edge.source_name.toLowerCase().trim());
    const targetId = nameToId.get(edge.target_name.toLowerCase().trim());

    if (!sourceId || !targetId || sourceId === targetId) continue;

    // Check cycle with all edges (existing + newly created)
    if (wouldCreateCycle(allEdges, sourceId, targetId)) continue;

    const { data, error } = await supabase
      .from("concept_edges")
      .insert({ source_id: sourceId, target_id: targetId })
      .select()
      .single();

    if (error) {
      // Skip duplicate edges (unique constraint violation)
      continue;
    }

    const created = data as ConceptEdge;
    allEdges.push(created);
    createdEdges.push(created);
  }

  // Return full updated graph
  const { data: allConcepts } = await supabase
    .from("concepts")
    .select("*")
    .order("name");

  const { data: allEdgesFinal } = await supabase
    .from("concept_edges")
    .select("*");

  return NextResponse.json({
    concepts: allConcepts ?? [],
    edges: allEdgesFinal ?? [],
    created_concepts: newConcepts.length,
    created_edges: createdEdges.length,
  });
}
