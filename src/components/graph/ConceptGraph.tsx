"use client";

import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback } from "react";
import { ConceptNode } from "./ConceptNode";
import type { ConceptNodeData } from "@/lib/graph/layout";

const nodeTypes = { conceptNode: ConceptNode };

const defaultEdgeOptions = {
  type: "bezier",
  style: {
    stroke: "var(--muted-foreground)",
    strokeWidth: 1.5,
    opacity: 0.35,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  },
  markerEnd: {
    type: "arrow" as const,
    color: "var(--muted-foreground)",
    width: 12,
    height: 12,
  },
};

interface ConceptGraphProps {
  nodes: Node<ConceptNodeData>[];
  edges: Edge[];
  interactive?: boolean;
  onConceptClick?: (conceptName: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
  className?: string;
  fullBleed?: boolean;
}

export function ConceptGraph({
  nodes,
  edges,
  interactive = false,
  onConceptClick,
  onNodeHover,
  className,
  fullBleed = false,
}: ConceptGraphProps) {
  const handleNodeClick: NodeMouseHandler<Node<ConceptNodeData>> = useCallback(
    (_event, node) => {
      onConceptClick?.(node.data.label);
    },
    [onConceptClick]
  );

  const handleNodeMouseEnter: NodeMouseHandler<Node<ConceptNodeData>> = useCallback(
    (_event, node) => {
      onNodeHover?.(node.id);
    },
    [onNodeHover]
  );

  const handleNodeMouseLeave: NodeMouseHandler<Node<ConceptNodeData>> = useCallback(
    () => {
      onNodeHover?.(null);
    },
    [onNodeHover]
  );

  return (
    <div
      className={`h-full w-full ${
        fullBleed ? "" : "rounded-lg border bg-card"
      } ${className ?? ""}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={interactive}
        nodesConnectable={false}
        elementsSelectable={interactive || !!onConceptClick}
        onNodeClick={onConceptClick ? handleNodeClick : undefined}
        onNodeMouseEnter={onNodeHover ? handleNodeMouseEnter : undefined}
        onNodeMouseLeave={onNodeHover ? handleNodeMouseLeave : undefined}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          gap={20}
          size={0.8}
          color="var(--border)"
        />
        <Controls
          showInteractive={false}
          position="bottom-left"
        />
      </ReactFlow>
    </div>
  );
}
