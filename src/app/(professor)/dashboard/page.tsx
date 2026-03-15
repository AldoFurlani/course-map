import { createClient } from "@/lib/supabase/server";
import ClassDashboard from "./ClassDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: concepts },
    { data: students },
    { data: scores },
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
  ]);

  // Compute aggregates per concept
  const conceptAgg = new Map<
    string,
    { sum: number; count: number; totalResponses: number }
  >();
  for (const s of scores ?? []) {
    const existing = conceptAgg.get(s.concept_id) ?? {
      sum: 0,
      count: 0,
      totalResponses: 0,
    };
    existing.sum += s.raw_score;
    existing.count++;
    existing.totalResponses += s.response_count;
    conceptAgg.set(s.concept_id, existing);
  }

  const aggregates = Array.from(conceptAgg.entries()).map(
    ([concept_id, data]) => ({
      concept_id,
      avg_score: data.count > 0 ? data.sum / data.count : 0,
      student_count: data.count,
      total_responses: data.totalResponses,
    })
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Class Dashboard</h1>
      <p className="mt-2 mb-6 text-muted-foreground">
        View aggregate readiness scores and identify concepts that need review.
      </p>
      <ClassDashboard
        concepts={concepts ?? []}
        students={students ?? []}
        scores={(scores ?? []).map((s) => ({
          student_id: s.student_id,
          concept_id: s.concept_id,
          raw_score: s.raw_score,
          response_count: s.response_count,
        }))}
        aggregates={aggregates}
      />
    </div>
  );
}
