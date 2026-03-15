"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import type { ConceptNodeData } from "@/lib/graph/layout";

type ConceptNodeType = Node<ConceptNodeData, "conceptNode">;

export function ConceptNode({ data }: NodeProps<ConceptNodeType>) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-sm w-[200px] text-center">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground !w-2 !h-2"
      />
      <div className="font-medium text-sm">{data.label}</div>
      {data.description && (
        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {data.description}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground !w-2 !h-2"
      />
    </div>
  );
}
