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
  /** 0 = root (no prerequisites), higher = deeper in the DAG */
  depth: number;
  /** Maximum depth in the entire graph, for normalization */
  maxDepth: number;
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

  // Compute depth for each node (BFS from roots)
  const childrenMap = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const concept of concepts) {
    childrenMap.set(concept.id, []);
    inDegree.set(concept.id, 0);
  }
  for (const edge of edges) {
    childrenMap.get(edge.source_id)?.push(edge.target_id);
    inDegree.set(edge.target_id, (inDegree.get(edge.target_id) ?? 0) + 1);
  }

  const depthMap = new Map<string, number>();
  const queue: string[] = [];
  for (const concept of concepts) {
    if ((inDegree.get(concept.id) ?? 0) === 0) {
      depthMap.set(concept.id, 0);
      queue.push(concept.id);
    }
  }

  // Build parent map for O(1) lookups
  const parentMap = new Map<string, string[]>();
  for (const edge of edges) {
    const parents = parentMap.get(edge.target_id) ?? [];
    parents.push(edge.source_id);
    parentMap.set(edge.target_id, parents);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depthMap.get(current) ?? 0;
    for (const child of childrenMap.get(current) ?? []) {
      const existing = depthMap.get(child) ?? -1;
      if (currentDepth + 1 > existing) {
        depthMap.set(child, currentDepth + 1);
      }
      // Only enqueue when all parents have been processed
      const parents = parentMap.get(child) ?? [];
      const processedParents = parents.filter((p) => depthMap.has(p)).length;
      if (processedParents >= parents.length) {
        queue.push(child);
      }
    }
  }

  const maxDepth = Math.max(...Array.from(depthMap.values()), 0);

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
        depth: depthMap.get(concept.id) ?? 0,
        maxDepth,
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
