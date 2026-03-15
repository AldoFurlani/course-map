import dagre from "@dagrejs/dagre";
import type { Node, Edge, MarkerType } from "@xyflow/react";
import type { Concept, ConceptEdge } from "@/lib/types/database";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

export interface ConceptNodeData {
  label: string;
  description: string;
  conceptId: string;
  readinessScore?: number;
  effectiveScore?: number;
  [key: string]: unknown;
}

export function layoutGraph(
  concepts: Concept[],
  edges: ConceptEdge[]
): { nodes: Node<ConceptNodeData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });

  for (const concept of concepts) {
    g.setNode(concept.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    g.setEdge(edge.source_id, edge.target_id);
  }

  dagre.layout(g);

  const flowNodes: Node<ConceptNodeData>[] = concepts.map((concept) => {
    const pos = g.node(concept.id);
    return {
      id: concept.id,
      type: "conceptNode",
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
      data: {
        label: concept.name,
        description: concept.description,
        conceptId: concept.id,
      },
    };
  });

  const flowEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    markerEnd: { type: "arrowclosed" as MarkerType },
  }));

  return { nodes: flowNodes, edges: flowEdges };
}
