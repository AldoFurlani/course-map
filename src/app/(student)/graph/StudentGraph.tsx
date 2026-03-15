"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { ConceptGraph } from "@/components/graph/ConceptGraph";
import type { ConceptNodeData } from "@/lib/graph/layout";
import type { Node, Edge } from "@xyflow/react";

interface Props {
  nodes: Node<ConceptNodeData>[];
  edges: Edge[];
}

export default function StudentGraph({ nodes, edges }: Props) {
  const router = useRouter();

  const handleConceptClick = useCallback(
    (conceptName: string) => {
      router.push(`/practice?concept=${encodeURIComponent(conceptName)}`);
    },
    [router]
  );

  return <ConceptGraph nodes={nodes} edges={edges} onConceptClick={handleConceptClick} />;
}
