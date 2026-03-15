import { createClient } from "@/lib/supabase/server";
import { layoutGraph } from "@/lib/graph/layout";
import { computeEffectiveScores } from "@/lib/graph/readiness";
import { ConceptGraph } from "@/components/graph/ConceptGraph";
import type { Concept, ConceptEdge } from "@/lib/types/database";

export const dynamic = "force-dynamic";

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

  return (
    <div>
      <h1 className="text-2xl font-bold">Concept Graph</h1>
      <p className="mt-2 mb-4 text-muted-foreground">
        Explore course concepts and their prerequisites.
      </p>
      <ConceptGraph nodes={nodes} edges={flowEdges} />
    </div>
  );
}
