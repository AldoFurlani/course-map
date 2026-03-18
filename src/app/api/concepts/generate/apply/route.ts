import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCourseOwner } from "@/lib/auth";
import { wouldCreateCycle } from "@/lib/graph/cycle-detection";
import type {
  GeneratedConcept,
  GeneratedEdge,
  Concept,
  ConceptEdge,
} from "@/lib/types/database";

interface ApplyPayload {
  course_id: string;
  concepts: GeneratedConcept[];
  edges: GeneratedEdge[];
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ApplyPayload;

  if (!body.course_id) {
    return NextResponse.json({ error: "course_id is required" }, { status: 400 });
  }

  const auth = await requireCourseOwner(body.course_id);
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();

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
          course_id: body.course_id,
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

  // Fetch existing edges for cycle detection (scoped to course)
  const { data: existingEdges } = await supabase
    .from("concept_edges")
    .select("*")
    .eq("course_id", body.course_id);

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
      .insert({
        course_id: body.course_id,
        source_id: sourceId,
        target_id: targetId,
      })
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
    .eq("course_id", body.course_id)
    .order("name");

  const { data: allEdgesFinal } = await supabase
    .from("concept_edges")
    .select("*")
    .eq("course_id", body.course_id);

  return NextResponse.json({
    concepts: allConcepts ?? [],
    edges: allEdgesFinal ?? [],
    created_concepts: newConcepts.length,
    created_edges: createdEdges.length,
  });
}
