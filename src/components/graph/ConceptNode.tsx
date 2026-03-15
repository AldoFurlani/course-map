"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import type { ConceptNodeData } from "@/lib/graph/layout";

type ConceptNodeType = Node<ConceptNodeData, "conceptNode">;

function getScoreColor(score: number | undefined): string {
  if (score === undefined) return "bg-card";
  if (score >= 0.7)
    return "bg-green-100 border-green-400 dark:bg-green-950 dark:border-green-700";
  if (score >= 0.4)
    return "bg-yellow-100 border-yellow-400 dark:bg-yellow-950 dark:border-yellow-700";
  return "bg-red-100 border-red-400 dark:bg-red-950 dark:border-red-700";
}

export function ConceptNode({ data }: NodeProps<ConceptNodeType>) {
  const colorClass = getScoreColor(data.effectiveScore);

  return (
    <div className={`rounded-lg border ${colorClass} px-4 py-3 shadow-sm w-[200px] text-center`}>
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
      {data.effectiveScore !== undefined && (
        <div className="mt-1 text-xs font-semibold">
          {Math.round(data.effectiveScore * 100)}%
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
