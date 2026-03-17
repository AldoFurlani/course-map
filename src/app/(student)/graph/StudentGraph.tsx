"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useMemo } from "react";
import { ConceptGraph } from "@/components/graph/ConceptGraph";
import { MaterialPanel } from "@/components/graph/MaterialPanel";
import type { ConceptNodeData } from "@/lib/graph/layout";
import type { Node, Edge } from "@xyflow/react";

interface Props {
  nodes: Node<ConceptNodeData>[];
  edges: Edge[];
}

export default function StudentGraph({ nodes, edges }: Props) {
  const router = useRouter();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<{
    conceptId: string;
    conceptName: string;
    conceptDescription: string | null;
  } | null>(null);

  const handleConceptClick = useCallback(
    (conceptName: string) => {
      const node = nodes.find((n) => n.data.label === conceptName);
      if (node) {
        setSelectedNode({
          conceptId: node.data.conceptId,
          conceptName: node.data.label,
          conceptDescription: node.data.description ?? null,
        });
      }
    },
    [nodes]
  );

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handlePractice = useCallback(
    (conceptName: string) => {
      router.push(`/practice?concept=${encodeURIComponent(conceptName)}`);
    },
    [router]
  );

  // Style edges based on hover — only change edge styles, never mutate node data
  const styledEdges = useMemo(() => {
    if (!hoveredNodeId) return edges;
    return edges.map((edge) => {
      const isConnected =
        edge.source === hoveredNodeId || edge.target === hoveredNodeId;
      return {
        ...edge,
        style: {
          ...edge.style,
          stroke: isConnected ? "var(--primary)" : "var(--muted-foreground)",
          strokeWidth: isConnected ? 2 : 1.5,
          opacity: isConnected ? 0.7 : 0.1,
        },
        markerEnd: isConnected && typeof edge.markerEnd === "object"
          ? { ...edge.markerEnd, color: "var(--primary)" }
          : edge.markerEnd,
      };
    });
  }, [hoveredNodeId, edges]);

  return (
    <>
      <ConceptGraph
        nodes={nodes}
        edges={styledEdges}
        onConceptClick={handleConceptClick}
        onNodeHover={setHoveredNodeId}
        className="h-full"
        fullBleed
      />

      <MaterialPanel
        conceptId={selectedNode?.conceptId ?? null}
        conceptName={selectedNode?.conceptName ?? null}
        conceptDescription={selectedNode?.conceptDescription ?? null}
        onClose={handleClosePanel}
        onPractice={handlePractice}
      />
    </>
  );
}
