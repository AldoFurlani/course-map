"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import type { ConceptNodeData } from "@/lib/graph/layout";
import { useEffect, useState } from "react";

type ConceptNodeType = Node<ConceptNodeData, "conceptNode">;

function getAccent(score: number | undefined) {
  if (score === undefined)
    return { border: "border-border", bar: "bg-border", text: "text-muted-foreground" };
  if (score >= 0.7)
    return { border: "border-success", bar: "bg-success", text: "text-success" };
  if (score >= 0.4)
    return { border: "border-warning", bar: "bg-warning", text: "text-warning" };
  return { border: "border-destructive", bar: "bg-destructive", text: "text-destructive" };
}

export function ConceptNode({ data }: NodeProps<ConceptNodeType>) {
  const accent = getAccent(data.effectiveScore);
  const pct =
    data.effectiveScore !== undefined
      ? Math.round(data.effectiveScore * 100)
      : null;

  // Depth-based sizing: roots are larger, leaves are smaller
  const isRoot = data.depth === 0;
  const isDeep = data.maxDepth > 0 && data.depth >= data.maxDepth * 0.7;
  const width = isRoot ? "w-[240px]" : isDeep ? "w-[190px]" : "w-[215px]";
  const titleSize = isRoot ? "text-[14px]" : isDeep ? "text-[12px]" : "text-[13px]";
  const borderWidth = isRoot ? "border-l-[4px]" : "border-l-[3px]";

  // Staggered entrance animation
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const delay = data.depth * 80 + Math.random() * 60;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [data.depth]);

  return (
    <div
      className={`
        group relative ${width} ${borderWidth} ${accent.border}
        rounded-sm bg-card overflow-visible
        border border-l-0 border-border/60
        shadow-[0_1px_4px_rgba(0,0,0,0.08)]
        cursor-pointer
        transition-all duration-200 ease-out
        hover:shadow-[0_3px_12px_rgba(0,0,0,0.1)]
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}
      style={{
        transitionProperty: "opacity, transform, box-shadow",
        transitionDuration: visible ? "400ms, 400ms, 200ms" : "0ms",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground/25 !border-none !w-1.5 !h-1.5"
      />

      <div className={`${isRoot ? "px-3.5 py-2.5" : "px-2.5 py-2"}`}>
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className={`font-serif ${titleSize} font-semibold leading-snug tracking-tight`}>
            {data.label}
          </h3>
          {pct !== null && (
            <span className={`shrink-0 font-mono text-[10px] font-medium tabular-nums ${accent.text}`}>
              {pct}%
            </span>
          )}
        </div>

        {/* Description */}
        {data.description && (
          <p
            className={`
              mt-0.5 text-muted-foreground leading-relaxed
              ${isRoot ? "text-[11px] line-clamp-2" : "text-[10px] line-clamp-1"}
            `}
          >
            {data.description}
          </p>
        )}

        {/* Progress underline */}
        {data.effectiveScore !== undefined && (
          <div className="mt-2 h-px w-full bg-border">
            <div
              className={`h-full ${accent.bar} transition-all duration-500`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground/25 !border-none !w-1.5 !h-1.5"
      />

      {/* Hover tooltip — floats below the node, pointer-events-none prevents jitter */}
      {data.description && (
        <div
          className="absolute left-0 right-0 top-full z-50 hidden group-hover:block pointer-events-none"
        >
          <div className={`mt-1 ${isRoot ? "px-3.5" : "px-2.5"} py-1.5 rounded-sm bg-card border border-border/60 shadow-[0_3px_12px_rgba(0,0,0,0.1)]`}>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {data.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
