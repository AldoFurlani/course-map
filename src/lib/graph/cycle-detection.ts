import type { ConceptEdge } from "@/lib/types/database";

/**
 * Check if adding a new edge would create a cycle in the DAG.
 * Uses BFS from newTargetId: if we can reach newSourceId,
 * adding newSourceId -> newTargetId would create a cycle.
 */
export function wouldCreateCycle(
  edges: ConceptEdge[],
  newSourceId: string,
  newTargetId: string
): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.source_id) ?? [];
    targets.push(edge.target_id);
    adjacency.set(edge.source_id, targets);
  }

  const visited = new Set<string>();
  const queue = [newTargetId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === newSourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      queue.push(neighbor);
    }
  }
  return false;
}

/**
 * Validate that a set of edges forms a DAG.
 * Returns any back-edges that would need to be removed to make it acyclic.
 */
export function validateDAG(
  edges: { source: string; target: string }[]
): { valid: boolean; backEdges: { source: string; target: string }[] } {
  const adjacency = new Map<string, string[]>();
  const nodes = new Set<string>();

  for (const edge of edges) {
    nodes.add(edge.source);
    nodes.add(edge.target);
    const targets = adjacency.get(edge.source) ?? [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const node of nodes) color.set(node, WHITE);

  const backEdges: { source: string; target: string }[] = [];

  function dfs(u: string): void {
    color.set(u, GRAY);
    for (const v of adjacency.get(u) ?? []) {
      if (color.get(v) === GRAY) {
        backEdges.push({ source: u, target: v });
      } else if (color.get(v) === WHITE) {
        dfs(v);
      }
    }
    color.set(u, BLACK);
  }

  for (const node of nodes) {
    if (color.get(node) === WHITE) {
      dfs(node);
    }
  }

  return { valid: backEdges.length === 0, backEdges };
}
