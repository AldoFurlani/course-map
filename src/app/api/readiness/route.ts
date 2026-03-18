import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeEffectiveScores } from "@/lib/graph/readiness";
import type { ConceptEdge } from "@/lib/types/database";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");

  // Fetch raw scores and edges in parallel
  let scoresQuery = supabase
    .from("readiness_scores")
    .select("concept_id, raw_score")
    .eq("student_id", user.id);

  let edgesQuery = supabase.from("concept_edges").select("*");

  if (courseId) {
    scoresQuery = scoresQuery.eq("course_id", courseId);
    edgesQuery = edgesQuery.eq("course_id", courseId);
  }

  const [{ data: rawScores }, { data: edges }] = await Promise.all([
    scoresQuery,
    edgesQuery,
  ]);

  const rawMap = new Map(
    (rawScores ?? []).map((s) => [s.concept_id as string, s.raw_score as number])
  );
  const effectiveMap = computeEffectiveScores(
    rawMap,
    (edges ?? []) as ConceptEdge[]
  );

  const scores = Array.from(rawMap.entries()).map(
    ([concept_id, raw_score]) => ({
      concept_id,
      raw_score,
      effective_score: effectiveMap.get(concept_id) ?? 0,
    })
  );

  return NextResponse.json({ scores });
}
