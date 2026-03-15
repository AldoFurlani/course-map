import { createClient } from "@/lib/supabase/server";
import { layoutGraph } from "@/lib/graph/layout";
import { ConceptGraph } from "@/components/graph/ConceptGraph";
import type { Concept, ConceptEdge } from "@/lib/types/database";

export default async function GraphPage() {
  const supabase = await createClient();

  const [{ data: concepts }, { data: edges }] = await Promise.all([
    supabase.from("concepts").select("*").order("name"),
    supabase.from("concept_edges").select("*"),
  ]);

  const { nodes, edges: flowEdges } = layoutGraph(
    (concepts as Concept[]) ?? [],
    (edges as ConceptEdge[]) ?? []
  );

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
