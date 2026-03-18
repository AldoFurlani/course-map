import { createClient } from "@/lib/supabase/server";
import { layoutGraph } from "@/lib/graph/layout";
import { computeEffectiveScores } from "@/lib/graph/readiness";
import StudentGraph from "./StudentGraph";
import type { Concept, ConceptEdge } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function GraphPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: concepts }, { data: edges }, { data: scores }] =
    await Promise.all([
      supabase.from("concepts").select("*").eq("course_id", courseId).order("name"),
      supabase.from("concept_edges").select("*").eq("course_id", courseId),
      user
        ? supabase
            .from("readiness_scores")
            .select("concept_id, raw_score")
            .eq("student_id", user.id)
            .eq("course_id", courseId)
        : Promise.resolve({ data: [] }),
    ]);

  const { nodes, edges: flowEdges } = layoutGraph(
    (concepts as Concept[]) ?? [],
    (edges as ConceptEdge[]) ?? []
  );

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
    <div className="relative flex h-screen flex-col">
      {/* Noise texture overlay for paper feel */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.03] dark:opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Title area */}
      <div className="relative z-[2] flex items-end justify-between border-b border-border px-5 py-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">
            Concept Graph
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {totalConcepts} concepts &middot; {mastered} mastered &middot; {inProgress} in progress
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-success" />
            Mastered
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-warning" />
            In progress
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-destructive" />
            Needs work
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-muted-foreground/25" />
            Not started
          </span>
        </div>
      </div>

      {/* Graph canvas */}
      <div className="relative z-0 flex-1">
        <StudentGraph courseId={courseId} nodes={nodes} edges={flowEdges} />
      </div>
    </div>
  );
}
