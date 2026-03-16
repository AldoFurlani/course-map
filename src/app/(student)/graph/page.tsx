import { createClient } from "@/lib/supabase/server";
import { layoutGraph } from "@/lib/graph/layout";
import { computeEffectiveScores } from "@/lib/graph/readiness";
import StudentGraph from "./StudentGraph";
import type { Concept, ConceptEdge } from "@/lib/types/database";

export const dynamic = "force-dynamic";

function FloatingLegend() {
  return (
    <div className="absolute bottom-20 left-4 z-10 flex items-center gap-3 rounded-2xl border border-border/40 bg-card/70 px-4 py-2.5 text-xs backdrop-blur-2xl shadow-lg ring-1 ring-white/[0.05]">
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
        <span className="text-muted-foreground">Mastered</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-full bg-warning shadow-[0_0_6px_var(--warning)]" />
        <span className="text-muted-foreground">In progress</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-full bg-destructive shadow-[0_0_6px_var(--destructive)]" />
        <span className="text-muted-foreground">Needs work</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-full bg-muted-foreground/30" />
        <span className="text-muted-foreground">Not started</span>
      </div>
    </div>
  );
}

function FloatingStats({
  total,
  mastered,
  inProgress,
}: {
  total: number;
  mastered: number;
  inProgress: number;
}) {
  const masteredPct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return (
    <div className="absolute top-4 right-4 z-10 flex items-stretch gap-3 rounded-2xl border border-border/40 bg-card/70 px-4 py-3 backdrop-blur-2xl shadow-lg ring-1 ring-white/[0.05]">
      {/* Overall progress ring */}
      <div className="flex items-center gap-3">
        <div className="relative size-10">
          <svg className="size-10 -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${masteredPct * 0.88} 88`}
              className="transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-medium">
            {masteredPct}%
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium">Course Progress</span>
          <span className="text-[11px] text-muted-foreground">
            {mastered} of {total} mastered
          </span>
        </div>
      </div>

      <div className="w-px bg-border/40 mx-1" />

      <div className="flex flex-col justify-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-1.5 rounded-full bg-warning" />
          <span className="text-[11px] text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{inProgress}</span> in progress
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-1.5 rounded-full bg-muted-foreground/30" />
          <span className="text-[11px] text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{total - mastered - inProgress}</span> not started
          </span>
        </div>
      </div>
    </div>
  );
}

export default async function GraphPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: concepts }, { data: edges }, { data: scores }] =
    await Promise.all([
      supabase.from("concepts").select("*").order("name"),
      supabase.from("concept_edges").select("*"),
      user
        ? supabase
            .from("readiness_scores")
            .select("concept_id, raw_score")
            .eq("student_id", user.id)
        : Promise.resolve({ data: [] }),
    ]);

  const { nodes, edges: flowEdges } = layoutGraph(
    (concepts as Concept[]) ?? [],
    (edges as ConceptEdge[]) ?? []
  );

  // Enrich nodes with readiness scores
  if (scores && scores.length > 0) {
    const rawMap = new Map(
      scores.map((s) => [s.concept_id as string, s.raw_score as number])
    );
    const effectiveMap = computeEffectiveScores(
      rawMap,
      (edges as ConceptEdge[]) ?? []
    );

    for (const node of nodes) {
      node.data.readinessScore = rawMap.get(node.data.conceptId);
      node.data.effectiveScore = effectiveMap.get(node.data.conceptId);
    }
  }

  const totalConcepts = concepts?.length ?? 0;
  const mastered =
    scores?.filter((s) => (s.raw_score as number) >= 0.7).length ?? 0;
  const inProgress =
    scores?.filter((s) => {
      const score = s.raw_score as number;
      return score >= 0.4 && score < 0.7;
    }).length ?? 0;

  return (
    <div className="relative h-screen w-full">
      <FloatingStats
        total={totalConcepts}
        mastered={mastered}
        inProgress={inProgress}
      />
      <FloatingLegend />
      <StudentGraph nodes={nodes} edges={flowEdges} />
    </div>
  );
}
