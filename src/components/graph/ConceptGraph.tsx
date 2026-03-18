"use client";

import {
  ReactFlow,
  Background,
  Controls,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type Connection,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef } from "react";
import { ConceptNode } from "./ConceptNode";
import type { ConceptNodeData } from "@/lib/graph/layout";

const nodeTypes = { conceptNode: ConceptNode };

const defaultEdgeOptions = {
  type: "default",
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
  editable?: boolean;
  onConceptClick?: (conceptName: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
  onConnect?: (connection: Connection) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
  onPaneClick?: () => void;
  className?: string;
  fullBleed?: boolean;
}

export function ConceptGraph({
  nodes,
  edges: edgesProp,
  interactive = false,
  editable = false,
  onConceptClick,
  onNodeHover,
  onConnect,
  onEdgeDelete,
  onNodeDelete,
  onEdgeClick,
  onPaneClick,
  className,
  fullBleed = false,
}: ConceptGraphProps) {
  const [edges, setEdges, onEdgesChange] = useEdgesState(edgesProp);
  const selectedEdgeRef = useRef<string | null>(null);
  const selectedNodeRef = useRef<string | null>(null);

  // Sync local edges when props change (e.g. after router.refresh())
  useEffect(() => {
    setEdges(edgesProp);
  }, [edgesProp, setEdges]);

  // Handle Backspace/Delete key to remove selected edge
  useEffect(() => {
    if (!editable) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      // Don't intercept if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (selectedEdgeRef.current) {
        e.preventDefault();
        const edgeId = selectedEdgeRef.current;
        selectedEdgeRef.current = null;
        setEdges((prev) => prev.filter((edge) => edge.id !== edgeId));
        onEdgeDelete?.(edgeId);
      } else if (selectedNodeRef.current) {
        e.preventDefault();
        const nodeId = selectedNodeRef.current;
        selectedNodeRef.current = null;
        onNodeDelete?.(nodeId);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editable, onEdgeDelete, onNodeDelete, setEdges]);

  const handleNodeClick: NodeMouseHandler<Node<ConceptNodeData>> = useCallback(
    (_event, node) => {
      selectedNodeRef.current = node.id;
      selectedEdgeRef.current = null;
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

  const handleConnect = useCallback(
    (connection: Connection) => {
      onConnect?.(connection);
    },
    [onConnect]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Track selection in ref for keyboard delete
      for (const change of changes) {
        if (change.type === "select") {
          selectedEdgeRef.current = change.selected ? change.id : null;
        }
      }

      // Filter out remove changes — we handle deletion ourselves via keydown
      const nonRemoveChanges = changes.filter((c) => c.type !== "remove");
      if (nonRemoveChanges.length > 0) {
        onEdgesChange(nonRemoveChanges);
      }
    },
    [onEdgesChange]
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
        nodesDraggable={false}
        nodesConnectable={editable}
        edgesReconnectable={editable}
        elementsSelectable={interactive || editable || !!onConceptClick}
        deleteKeyCode={null}
        onNodeClick={onConceptClick || editable ? handleNodeClick : undefined}
        onNodeMouseEnter={onNodeHover ? handleNodeMouseEnter : undefined}
        onNodeMouseLeave={onNodeHover ? handleNodeMouseLeave : undefined}
        onConnect={editable ? handleConnect : undefined}
        onEdgesChange={editable ? handleEdgesChange : undefined}
        onEdgeClick={(event, edge) => {
          selectedEdgeRef.current = edge.id;
          selectedNodeRef.current = null;
          onEdgeClick?.(event, edge);
        }}
        onPaneClick={() => {
          selectedEdgeRef.current = null;
          selectedNodeRef.current = null;
          onPaneClick?.();
        }}
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
