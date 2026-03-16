"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import type { ConceptNodeData } from "@/lib/graph/layout";

type ConceptNodeType = Node<ConceptNodeData, "conceptNode">;

function getScoreStyles(score: number | undefined) {
  if (score === undefined)
    return {
      ring: "ring-border",
      glow: "",
      bar: "",
      badge: null,
      accent: "bg-muted-foreground/20",
    };
  if (score >= 0.7)
    return {
      ring: "ring-success/50",
      glow: "shadow-[0_0_12px_-3px_var(--success)]",
      bar: "bg-success",
      badge: "bg-success/15 text-success",
      accent: "bg-success",
    };
  if (score >= 0.4)
    return {
      ring: "ring-warning/50",
      glow: "shadow-[0_0_12px_-3px_var(--warning)]",
      bar: "bg-warning",
      badge: "bg-warning/15 text-warning",
      accent: "bg-warning",
    };
  return {
    ring: "ring-destructive/50",
    glow: "shadow-[0_0_12px_-3px_var(--destructive)]",
    bar: "bg-destructive",
    badge: "bg-destructive/15 text-destructive",
    accent: "bg-destructive",
  };
}

export function ConceptNode({ data }: NodeProps<ConceptNodeType>) {
  const styles = getScoreStyles(data.effectiveScore);
  const pct =
    data.effectiveScore !== undefined
      ? Math.round(data.effectiveScore * 100)
      : null;

  return (
    <div
      className={`
        group relative w-[210px] overflow-hidden rounded-xl
        bg-card/90 backdrop-blur-sm
        ring-1 ${styles.ring} ${styles.glow}
        cursor-pointer transition-all duration-200
        hover:scale-[1.03] hover:shadow-lg hover:ring-primary/60
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground/40 !border-none !w-2 !h-2"
      />

      {/* Top accent bar */}
      <div className={`h-0.5 w-full ${styles.accent}`} />

      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium text-sm leading-snug">{data.label}</div>
          {pct !== null && styles.badge && (
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-mono font-medium ${styles.badge}`}
            >
              {pct}%
            </span>
          )}
        </div>

        {data.description && (
          <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {data.description}
          </div>
        )}

        {/* Progress bar */}
        {data.effectiveScore !== undefined && (
          <div className="mt-2 h-1 w-full rounded-full bg-muted/50 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${styles.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground/40 !border-none !w-2 !h-2"
      />
    </div>
  );
}
