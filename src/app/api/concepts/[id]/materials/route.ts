import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConceptEmbedding } from "@/lib/rag/embed";
import type { Concept } from "@/lib/types/database";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get concept details
  const { data: concept, error: conceptError } = await supabase
    .from("concepts")
    .select("*")
    .eq("id", id)
    .single();

  if (conceptError || !concept) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  // Get embedding (cached or computed)
  let embedding: number[];
  try {
    embedding = await getConceptEmbedding(concept as Concept);
  } catch (err) {
    console.error("Embedding failed:", err);
    return NextResponse.json({ error: "Embedding failed" }, { status: 500 });
  }

  // Fetch more chunks to ensure we get results from every material
  const { data: matches, error: matchError } = await supabase.rpc("match_chunks", {
    query_embedding: JSON.stringify(embedding),
    match_count: 30,
    match_threshold: 0.3,
  });

  if (matchError) {
    console.error("match_chunks failed:", matchError);
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  }

  if (!matches || matches.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // Pick the best match per material (highest similarity)
  const bestByMaterial = new Map<string, {
    material_id: string;
    page_number: number | null;
    similarity: number;
  }>();

  for (const match of matches as {
    id: string;
    material_id: string;
    chunk_text: string;
    chunk_index: number;
    page_number: number | null;
    similarity: number;
  }[]) {
    const existing = bestByMaterial.get(match.material_id);
    if (!existing || match.similarity > existing.similarity) {
      bestByMaterial.set(match.material_id, {
        material_id: match.material_id,
        page_number: match.page_number,
        similarity: match.similarity,
      });
    }
  }

  // Get material metadata
  const materialIds = [...bestByMaterial.keys()];
  const { data: materials } = await supabase
    .from("course_materials")
    .select("id, title, file_name, file_type, file_path")
    .in("id", materialIds);

  const materialMap = new Map(
    materials?.map((m) => [m.id, m]) ?? []
  );

  const DISPLAY_THRESHOLD = 0.55;

  const results = [...bestByMaterial.values()]
    .filter((match) => match.similarity >= DISPLAY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .map((match) => {
      const material = materialMap.get(match.material_id);
      return {
        materialId: match.material_id,
        materialTitle: material?.title ?? "Unknown",
        fileName: material?.file_name ?? "",
        fileType: material?.file_type ?? "text",
        filePath: material?.file_path ?? "",
        pageNumber: match.page_number,
        similarity: match.similarity,
      };
    });

  return NextResponse.json({ results });
}
