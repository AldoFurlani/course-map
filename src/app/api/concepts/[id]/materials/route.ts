import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConceptEmbedding } from "@/lib/rag/embed";
import { filterByRelativeScore } from "@/lib/rag/retriever";
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
    p_course_id: concept.course_id,
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

  // Adaptive threshold: filters out unrelated concepts that score high in
  // absolute terms due to gte-small's narrow similarity range.
  const typedMatches = matches as { similarity: number; material_id: string; page_number: number | null }[];
  const adaptiveThreshold = filterByRelativeScore(typedMatches);

  if (process.env.DEBUG_AI) {
    const sims = typedMatches.map((m) => m.similarity);
    const sortedSims = [...sims].sort((a, b) => a - b);
    console.log(
      `[MATERIALS] concept=${concept.name} | chunks=${sims.length} | ` +
      `min=${Math.min(...sims).toFixed(3)} median=${sortedSims[Math.floor(sortedSims.length / 2)]?.toFixed(3) ?? "N/A"} ` +
      `max=${Math.max(...sims).toFixed(3)} | threshold=${adaptiveThreshold.toFixed(3)}`
    );
    // Log best score per material
    for (const [matId, best] of bestByMaterial) {
      const mat = materialMap.get(matId);
      const status = best.similarity >= adaptiveThreshold ? "PASS" : "FAIL";
      console.log(
        `  [${status}] ${mat?.title ?? matId} best=${best.similarity.toFixed(3)}`
      );
    }
  }

  const passing = [...bestByMaterial.values()]
    .filter((match) => match.similarity >= adaptiveThreshold)
    .sort((a, b) => b.similarity - a.similarity);

  // Normalize best-chunk score per material to a 0–1 relevance scale.
  // Floor maps to 0, best overall chunk maps to 1. Everything that passed
  // the adaptive threshold is shown — the score is purely for ranking.
  const topChunkScore = typedMatches.length > 0
    ? Math.max(...typedMatches.map((m) => m.similarity))
    : 1;
  const floorScore = 0.80;
  const displayRange = topChunkScore - floorScore;

  const results = passing.map((match) => {
    const material = materialMap.get(match.material_id);
    const relevance =
      displayRange > 0.001
        ? (match.similarity - floorScore) / displayRange
        : 1;

    return {
      materialId: match.material_id,
      materialTitle: material?.title ?? "Unknown",
      fileName: material?.file_name ?? "",
      fileType: material?.file_type ?? "text",
      filePath: material?.file_path ?? "",
      pageNumber: match.page_number,
      similarity: Math.max(relevance, 0.05),
    };
  });

  return NextResponse.json({ results });
}
