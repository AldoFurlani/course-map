import { createClient } from "@/lib/supabase/server";
import { computeEffectiveScores } from "@/lib/graph/readiness";
import type { Concept, ConceptEdge } from "@/lib/types/database";

export const dynamic = "force-dynamic";

function getScoreColor(score: number): string {
  if (score >= 0.7) return "bg-green-500";
  if (score >= 0.4) return "bg-yellow-500";
  return "bg-red-500";
}

function getScoreBgColor(score: number): string {
  if (score >= 0.7) return "bg-green-100 dark:bg-green-950";
  if (score >= 0.4) return "bg-yellow-100 dark:bg-yellow-950";
  return "bg-red-100 dark:bg-red-950";
}

export default async function ProgressPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: concepts }, { data: edges }, { data: scores }, { data: responses }] =
    await Promise.all([
      supabase.from("concepts").select("*").order("name"),
      supabase.from("concept_edges").select("*"),
      user
        ? supabase
            .from("readiness_scores")
            .select("*")
            .eq("student_id", user.id)
        : Promise.resolve({ data: [] }),
      user
        ? supabase
            .from("student_responses")
            .select("concept_id, is_correct")
            .eq("student_id", user.id)
        : Promise.resolve({ data: [] }),
    ]);

  const typedConcepts = (concepts as Concept[]) ?? [];
  const typedEdges = (edges as ConceptEdge[]) ?? [];

  // Build score maps
  const scoreMap = new Map(
    (scores ?? []).map((s) => [s.concept_id, s])
  );
  const rawMap = new Map(
    (scores ?? []).map((s) => [s.concept_id as string, s.raw_score as number])
  );
  const effectiveMap = computeEffectiveScores(rawMap, typedEdges);

  // Build response stats per concept
  const responseStats = new Map<string, { total: number; correct: number }>();
  for (const r of responses ?? []) {
    const existing = responseStats.get(r.concept_id) ?? { total: 0, correct: 0 };
    existing.total++;
    if (r.is_correct) existing.correct++;
    responseStats.set(r.concept_id, existing);
  }

  // Build prerequisite map for recommendations
  const prereqs = new Map<string, string[]>();
  for (const edge of typedEdges) {
    const existing = prereqs.get(edge.target_id) ?? [];
    existing.push(edge.source_id);
    prereqs.set(edge.target_id, existing);
  }

  // Find concepts to work on: low effective score but prerequisites are ok
  const recommendations: { concept: Concept; reason: string }[] = [];
  for (const concept of typedConcepts) {
    const effective = effectiveMap.get(concept.id) ?? 0;
    const raw = rawMap.get(concept.id) ?? 0;
    const deps = prereqs.get(concept.id) ?? [];

    if (effective < 0.7) {
      if (deps.length > 0 && raw > effective) {
        const weakPrereqs = deps
          .filter((d) => (effectiveMap.get(d) ?? 0) < 0.7)
          .map((d) => typedConcepts.find((c) => c.id === d)?.name)
          .filter(Boolean);
        if (weakPrereqs.length > 0) {
          recommendations.push({
            concept,
            reason: `Work on ${weakPrereqs.join(", ")} first`,
          });
          continue;
        }
      }
      recommendations.push({
        concept,
        reason: scoreMap.has(concept.id) ? "Keep practicing" : "Not started yet",
      });
    }
  }

  const totalConcepts = typedConcepts.length;
  const practicedCount = scoreMap.size;
  const masteredCount = Array.from(effectiveMap.values()).filter((s) => s >= 0.7).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Your Progress</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Track your readiness across all course concepts.
      </p>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">Concepts Practiced</p>
          <p className="text-2xl font-semibold font-mono">{practicedCount}/{totalConcepts}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">Mastered (≥70%)</p>
          <p className="text-2xl font-semibold font-mono">{masteredCount}/{totalConcepts}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">Total Questions</p>
          <p className="text-2xl font-semibold font-mono">
            {(responses ?? []).length}
          </p>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 font-serif text-xl font-semibold tracking-tight">Recommendations</h2>
          <div className="space-y-2">
            {recommendations.slice(0, 5).map(({ concept, reason }) => (
              <div
                key={concept.id}
                className="flex items-center justify-between rounded-lg bg-card px-4 py-3 ring-1 ring-foreground/10"
              >
                <div>
                  <p className="font-medium text-sm">{concept.name}</p>
                  <p className="text-xs text-muted-foreground">{reason}</p>
                </div>
                <p className="text-sm font-semibold">
                  {Math.round((effectiveMap.get(concept.id) ?? 0) * 100)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All concepts */}
      <h2 className="mb-3 font-serif text-xl font-semibold tracking-tight">All Concepts</h2>
      <div className="space-y-2">
        {typedConcepts.map((concept) => {
          const raw = rawMap.get(concept.id) ?? 0;
          const effective = effectiveMap.get(concept.id) ?? 0;
          const stats = responseStats.get(concept.id);
          const score = scoreMap.get(concept.id);
          const isCapped = score && raw > effective;

          return (
            <div
              key={concept.id}
              className={`rounded-lg px-4 py-3 ring-1 ring-foreground/10 ${score ? getScoreBgColor(effective) : "bg-card"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-sm">{concept.name}</p>
                  {stats && (
                    <p className="text-xs text-muted-foreground">
                      {stats.correct}/{stats.total} correct
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {score ? `${Math.round(effective * 100)}%` : "—"}
                  </p>
                  {isCapped && (
                    <p className="text-xs text-muted-foreground">
                      raw: {Math.round(raw * 100)}%
                    </p>
                  )}
                </div>
              </div>
              {score && (
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full transition-all ${getScoreColor(effective)}`}
                    style={{ width: `${Math.round(effective * 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
