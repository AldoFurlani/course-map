"use client";

import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ConceptNode } from "./ConceptNode";
import type { ConceptNodeData } from "@/lib/graph/layout";

const nodeTypes = { conceptNode: ConceptNode };

interface ConceptGraphProps {
  nodes: Node<ConceptNodeData>[];
  edges: Edge[];
  interactive?: boolean;
}

export function ConceptGraph({
  nodes,
  edges,
  interactive = false,
}: ConceptGraphProps) {
  return (
    <div className="h-[600px] w-full rounded-lg border bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={interactive}
        nodesConnectable={false}
        elementsSelectable={interactive}
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
