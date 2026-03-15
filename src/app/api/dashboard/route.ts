import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["professor", "ta"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    { data: concepts },
    { data: students },
    { data: scores },
    { data: responses },
  ] = await Promise.all([
    supabase.from("concepts").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "student")
      .order("full_name"),
    supabase
      .from("readiness_scores")
      .select("student_id, concept_id, raw_score, response_count"),
    supabase
      .from("student_responses")
      .select("concept_id, student_id"),
  ]);

  // Compute aggregates per concept
  const conceptScores = new Map<
    string,
    { total: number; sum: number; studentCount: number; totalResponses: number }
  >();

  for (const s of scores ?? []) {
    const existing = conceptScores.get(s.concept_id) ?? {
      total: 0,
      sum: 0,
      studentCount: 0,
      totalResponses: 0,
    };
    existing.total++;
    existing.sum += s.raw_score;
    existing.studentCount++;
    existing.totalResponses += s.response_count;
    conceptScores.set(s.concept_id, existing);
  }

  // Count responses per concept for concepts with no readiness score
  for (const r of responses ?? []) {
    if (!conceptScores.has(r.concept_id)) {
      conceptScores.set(r.concept_id, {
        total: 0,
        sum: 0,
        studentCount: 0,
        totalResponses: 0,
      });
    }
  }

  const aggregates = Array.from(conceptScores.entries()).map(
    ([concept_id, data]) => ({
      concept_id,
      avg_score: data.total > 0 ? data.sum / data.total : 0,
      student_count: data.studentCount,
      total_responses: data.totalResponses,
    })
  );

  return NextResponse.json({
    concepts: concepts ?? [],
    students: students ?? [],
    scores: (scores ?? []).map((s) => ({
      student_id: s.student_id,
      concept_id: s.concept_id,
      raw_score: s.raw_score,
      response_count: s.response_count,
    })),
    aggregates,
  });
}
