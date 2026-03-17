import { createClient } from "@/lib/supabase/server";
import { computeEffectiveScores } from "@/lib/graph/readiness";
import type { Concept, ConceptEdge } from "@/lib/types/database";
import {
  Target,
  CheckCircle2,
  BookOpen,
  MessageSquare,
  ArrowRight,
  Lightbulb,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

function scoreBarColor(score: number): string {
  if (score >= 0.7) return "bg-success";
  if (score >= 0.4) return "bg-warning";
  return "bg-destructive";
}

function scoreBorderColor(score: number): string {
  if (score >= 0.7) return "border-l-success";
  if (score >= 0.4) return "border-l-warning";
  return "border-l-destructive";
}

function scoreLabel(score: number): string {
  if (score >= 0.7) return "Mastered";
  if (score >= 0.4) return "In Progress";
  return "Needs Work";
}

function scoreLabelColor(score: number): string {
  if (score >= 0.7) return "text-success";
  if (score >= 0.4) return "text-warning";
  return "text-destructive";
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

  const scoreMap = new Map(
    (scores ?? []).map((s) => [s.concept_id, s])
  );
  const rawMap = new Map(
    (scores ?? []).map((s) => [s.concept_id as string, s.raw_score as number])
  );
  const effectiveMap = computeEffectiveScores(rawMap, typedEdges);

  const responseStats = new Map<string, { total: number; correct: number }>();
  for (const r of responses ?? []) {
    const existing = responseStats.get(r.concept_id) ?? { total: 0, correct: 0 };
    existing.total++;
    if (r.is_correct) existing.correct++;
    responseStats.set(r.concept_id, existing);
  }

  const prereqs = new Map<string, string[]>();
  for (const edge of typedEdges) {
    const existing = prereqs.get(edge.target_id) ?? [];
    existing.push(edge.source_id);
    prereqs.set(edge.target_id, existing);
  }

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
  const totalQuestions = (responses ?? []).length;
  const allScores = Array.from(effectiveMap.values());
  const avgReadiness = allScores.length > 0
    ? Math.round((allScores.reduce((a, b) => a + b, 0) / totalConcepts) * 100)
    : 0;

  // SVG ring progress
  const ringRadius = 36;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (avgReadiness / 100) * ringCircumference;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        Your Progress
      </h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Track your readiness across all course concepts.
      </p>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Overall readiness — featured card with ring */}
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 flex items-center gap-4">
          <div className="relative shrink-0">
            <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
              <circle
                cx="42" cy="42" r={ringRadius}
                fill="none"
                stroke="currentColor"
                className="text-muted/60"
                strokeWidth="6"
              />
              <circle
                cx="42" cy="42" r={ringRadius}
                fill="none"
                stroke="currentColor"
                className="text-primary"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-mono text-lg font-semibold">
              {avgReadiness}%
            </span>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Overall Readiness</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Avg across all concepts
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="size-4 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Practiced</p>
          </div>
          <p className="text-2xl font-semibold font-mono">
            {practicedCount}
            <span className="text-sm font-normal text-muted-foreground">/{totalConcepts}</span>
          </p>
        </div>

        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="size-4 text-success" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Mastered</p>
          </div>
          <p className="text-2xl font-semibold font-mono">
            {masteredCount}
            <span className="text-sm font-normal text-muted-foreground">/{totalConcepts}</span>
          </p>
        </div>

        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="size-4 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Questions</p>
          </div>
          <p className="text-2xl font-semibold font-mono">{totalQuestions}</p>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="size-4 text-warning" strokeWidth={1.5} />
            <h2 className="font-serif text-xl font-semibold tracking-tight">
              Recommendations
            </h2>
          </div>
          <div className="space-y-2">
            {recommendations.slice(0, 5).map(({ concept, reason }) => {
              const effective = effectiveMap.get(concept.id) ?? 0;
              const pct = Math.round(effective * 100);
              const isNotStarted = !scoreMap.has(concept.id);
              return (
                <Link
                  key={concept.id}
                  href={`/practice?concept=${encodeURIComponent(concept.name)}`}
                  className={`group flex items-center gap-4 rounded-xl px-4 py-3 ring-1 ring-foreground/10 border-l-[3px] transition-colors hover:bg-accent/50 ${
                    isNotStarted ? "border-l-muted-foreground/30" : scoreBorderColor(effective)
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{concept.name}</p>
                    <p className="text-xs text-muted-foreground">{reason}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm font-semibold font-mono ${
                      isNotStarted ? "text-muted-foreground" : scoreLabelColor(effective)
                    }`}>
                      {isNotStarted ? "—" : `${pct}%`}
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* All Concepts */}
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="size-4 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="font-serif text-xl font-semibold tracking-tight">
          All Concepts
        </h2>
      </div>

      {typedConcepts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="size-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">
            No concepts available yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {typedConcepts.map((concept) => {
            const raw = rawMap.get(concept.id) ?? 0;
            const effective = effectiveMap.get(concept.id) ?? 0;
            const stats = responseStats.get(concept.id);
            const score = scoreMap.get(concept.id);
            const pct = Math.round(effective * 100);
            const isCapped = score && raw > effective;

            return (
              <div
                key={concept.id}
                className={`rounded-xl px-4 py-3 ring-1 ring-foreground/10 border-l-[3px] ${
                  score ? scoreBorderColor(effective) : "border-l-muted-foreground/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{concept.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {stats ? (
                        <span className="text-xs text-muted-foreground">
                          {stats.correct}/{stats.total} correct
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not started</span>
                      )}
                      {score && (
                        <span className={`text-xs font-medium ${scoreLabelColor(effective)}`}>
                          {scoreLabel(effective)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold font-mono">
                      {score ? `${pct}%` : "—"}
                    </p>
                    {isCapped && (
                      <p className="text-[11px] text-muted-foreground">
                        raw {Math.round(raw * 100)}%
                      </p>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      score ? scoreBarColor(effective) : ""
                    }`}
                    style={{ width: score ? `${pct}%` : "0%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
