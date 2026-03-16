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
  type: "smoothstep",
  style: {
    stroke: "var(--border)",
    strokeWidth: 1.5,
  },
  markerEnd: {
    type: "arrowclosed" as const,
    color: "var(--border)",
    width: 16,
    height: 16,
  },
};

interface ConceptGraphProps {
  nodes: Node<ConceptNodeData>[];
  edges: Edge[];
  interactive?: boolean;
  onConceptClick?: (conceptName: string) => void;
  className?: string;
  /** When true, renders without border/rounding for full-bleed use */
  fullBleed?: boolean;
}

export function ConceptGraph({
  nodes,
  edges,
  interactive = false,
  onConceptClick,
  className,
  fullBleed = false,
}: ConceptGraphProps) {
  const handleNodeClick: NodeMouseHandler<Node<ConceptNodeData>> = useCallback(
    (_event, node) => {
      onConceptClick?.(node.data.label);
    },
    [onConceptClick]
  );

  return (
    <div
      className={`h-full w-full ${
        fullBleed ? "bg-background" : "rounded-lg border bg-card"
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
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          gap={24}
          size={1}
          color="var(--border)"
        />
        <Controls
          showInteractive={false}
          position="top-left"
          className="!rounded-xl !border !border-border/40 !bg-card/70 !shadow-lg !backdrop-blur-2xl !ring-1 !ring-white/[0.05] [&>button]:!border-border/30 [&>button]:!bg-transparent [&>button]:!fill-muted-foreground hover:[&>button]:!bg-muted/50 hover:[&>button]:!fill-foreground"
        />
      </ReactFlow>
    </div>
  );
}
