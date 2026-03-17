import { createClient } from "@/lib/supabase/server";
import { layoutGraph } from "@/lib/graph/layout";
import { ConceptManager } from "./ConceptManager";
import type { Concept, ConceptEdge } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function ConceptsPage() {
  const supabase = await createClient();

  const [{ data: concepts }, { data: edges }] = await Promise.all([
    supabase.from("concepts").select("*").order("name"),
    supabase.from("concept_edges").select("*"),
  ]);

  const conceptList = (concepts as Concept[]) ?? [];
  const edgeList = (edges as ConceptEdge[]) ?? [];
  const { nodes, edges: flowEdges } = layoutGraph(conceptList, edgeList);

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Manage Concepts</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Add, edit, and organize course concepts and their dependencies.
      </p>
      <ConceptManager
        initialConcepts={conceptList}
        initialEdges={edgeList}
        initialNodes={nodes}
        initialFlowEdges={flowEdges}
      />
    </div>
  );
}
