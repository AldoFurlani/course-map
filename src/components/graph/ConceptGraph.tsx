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

interface ConceptGraphProps {
  nodes: Node<ConceptNodeData>[];
  edges: Edge[];
  interactive?: boolean;
  onConceptClick?: (conceptName: string) => void;
}

export function ConceptGraph({
  nodes,
  edges,
  interactive = false,
  onConceptClick,
}: ConceptGraphProps) {
  const handleNodeClick: NodeMouseHandler<Node<ConceptNodeData>> = useCallback(
    (_event, node) => {
      onConceptClick?.(node.data.label);
    },
    [onConceptClick]
  );

  return (
    <div className="h-[600px] w-full rounded-lg border bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={interactive}
        nodesConnectable={false}
        elementsSelectable={interactive || !!onConceptClick}
        onNodeClick={onConceptClick ? handleNodeClick : undefined}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
