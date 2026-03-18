"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useMemo } from "react";
import { ConceptGraph } from "@/components/graph/ConceptGraph";
import { MaterialPanel } from "@/components/graph/MaterialPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConceptNodeData } from "@/lib/graph/layout";
import type { Node, Edge, Connection } from "@xyflow/react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Sparkles,
  Loader2,
  X,
  Eye,
} from "lucide-react";

interface Props {
  courseId: string;
  nodes: Node<ConceptNodeData>[];
  edges: Edge[];
}

export default function StudentGraph({ courseId, nodes, edges }: Props) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // View mode: material panel
  const [selectedNode, setSelectedNode] = useState<{
    conceptId: string;
    conceptName: string;
    conceptDescription: string | null;
  } | null>(null);

  // Edit mode: add concept form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  function handleToggleEdit() {
    setEditMode((prev) => !prev);
    setSelectedNode(null);
    setSelectedEdgeId(null);
    setShowAddForm(false);
  }

  // --- View mode handlers ---

  const handleConceptClick = useCallback(
    (conceptName: string) => {
      const node = nodes.find((n) => n.data.label === conceptName);
      if (node) {
        setSelectedNode({
          conceptId: node.data.conceptId,
          conceptName: node.data.label,
          conceptDescription: node.data.description ?? null,
        });
      }
    },
    [nodes]
  );

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handlePractice = useCallback(
    (conceptName: string) => {
      router.push(`/course/${courseId}/practice?concept=${encodeURIComponent(conceptName)}`);
    },
    [router, courseId]
  );

  // --- Edit mode handlers ---

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      try {
        const res = await fetch("/api/concept-edges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: courseId,
            source_id: connection.source,
            target_id: connection.target,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || "Failed to create edge");
          return;
        }
        router.refresh();
      } catch {
        toast.error("Failed to create edge");
      }
    },
    [courseId, router]
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId((prev) => (prev === edge.id ? null : edge.id));
    },
    []
  );

  const handlePaneClick = useCallback(() => {
    setSelectedEdgeId(null);
  }, []);

  const handleEdgeDelete = useCallback(
    async (edgeId: string) => {
      try {
        const res = await fetch(`/api/concept-edges?id=${edgeId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          toast.error("Failed to delete edge");
          return;
        }
        toast.success("Edge deleted");
        setSelectedEdgeId(null);
        router.refresh();
      } catch {
        toast.error("Failed to delete edge");
      }
    },
    [router]
  );

  const handleNodeDelete = useCallback(
    async (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      const name = node?.data.label ?? "this concept";
      if (!confirm(`Delete "${name}"? This will also remove its edges, questions, and scores.`)) return;
      try {
        const res = await fetch(`/api/concepts/${nodeId}`, { method: "DELETE" });
        if (!res.ok) {
          toast.error("Failed to delete concept");
          return;
        }
        toast.success("Concept deleted");
        router.refresh();
      } catch {
        toast.error("Failed to delete concept");
      }
    },
    [nodes, router]
  );

  async function handleAddConcept(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          name: addName.trim(),
          description: addDescription.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to add concept");
        return;
      }
      toast.success("Concept added");
      setAddName("");
      setAddDescription("");
      setShowAddForm(false);
      router.refresh();
    } catch {
      toast.error("Failed to add concept");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateFromMaterials() {
    setGenerating(true);
    try {
      const res = await fetch("/api/concepts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to generate concepts");
        return;
      }
      const preview = await res.json();
      const newCount = preview.concepts.filter((c: { status: string }) => c.status === "new").length;
      const edgeCount = preview.edges.length;
      if (newCount === 0) {
        toast.info("No new concepts found in materials");
        return;
      }
      if (!confirm(`Found ${newCount} new concept${newCount !== 1 ? "s" : ""} and ${edgeCount} edge${edgeCount !== 1 ? "s" : ""}. Apply to your graph?`)) return;
      const applyRes = await fetch("/api/concepts/generate/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          concepts: preview.concepts,
          edges: preview.edges,
        }),
      });
      if (!applyRes.ok) {
        const data = await applyRes.json();
        toast.error(data.error || "Failed to apply concepts");
        return;
      }
      const result = await applyRes.json();
      toast.success(`Added ${result.created_concepts} concepts and ${result.created_edges} edges`);
      router.refresh();
    } catch {
      toast.error("Failed to generate concepts");
    } finally {
      setGenerating(false);
    }
  }

  // Style edges based on hover and selection
  const styledEdges = useMemo(() => {
    return edges.map((edge) => {
      const isSelected = editMode && edge.id === selectedEdgeId;
      const isConnected = hoveredNodeId
        ? edge.source === hoveredNodeId || edge.target === hoveredNodeId
        : false;

      if (isSelected) {
        return {
          ...edge,
          style: {
            ...edge.style,
            stroke: "var(--destructive)",
            strokeWidth: 3,
            opacity: 0.9,
          },
          markerEnd: typeof edge.markerEnd === "object"
            ? { ...edge.markerEnd, color: "var(--destructive)" }
            : edge.markerEnd,
        };
      }

      if (hoveredNodeId) {
        return {
          ...edge,
          style: {
            ...edge.style,
            stroke: isConnected ? "var(--primary)" : "var(--muted-foreground)",
            strokeWidth: isConnected ? 2 : 1.5,
            opacity: isConnected ? 0.7 : 0.1,
          },
          markerEnd: isConnected && typeof edge.markerEnd === "object"
            ? { ...edge.markerEnd, color: "var(--primary)" }
            : edge.markerEnd,
        };
      }

      return edge;
    });
  }, [hoveredNodeId, edges, selectedEdgeId, editMode]);

  return (
    <>
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        {editMode ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowAddForm(!showAddForm); }}
              className="bg-background/80 backdrop-blur-sm"
            >
              <Plus className="mr-1.5 size-3.5" />
              Add Concept
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleToggleEdit}
            >
              <Eye className="mr-1.5 size-3.5" />
              Done
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateFromMaterials}
              disabled={generating}
              className="bg-background/80 backdrop-blur-sm"
            >
              {generating ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 size-3.5" />
              )}
              {generating ? "Generating..." : "Generate from Materials"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleEdit}
              className="bg-background/80 backdrop-blur-sm"
            >
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Button>
          </>
        )}
      </div>

      {/* Edit mode hint */}
      {editMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-lg bg-background/90 backdrop-blur-sm px-4 py-2 ring-1 ring-foreground/10 text-xs text-muted-foreground">
          Click a concept or edge, then press <kbd className="mx-0.5 rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">Backspace</kbd> to delete. Drag between handles to connect.
        </div>
      )}

      {/* Add concept form */}
      {showAddForm && editMode && (
        <div className="absolute top-12 right-2 z-10 w-80 rounded-xl ring-1 ring-foreground/10 bg-card p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-sm font-semibold">New Concept</h3>
            <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <form onSubmit={handleAddConcept} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Linear Regression"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Input
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                placeholder="Brief description"
              />
            </div>
            <Button type="submit" size="sm" className="w-full" disabled={saving || !addName.trim()}>
              {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Add Concept
            </Button>
          </form>
        </div>
      )}

      <ConceptGraph
        nodes={nodes}
        edges={styledEdges}
        interactive
        editable={editMode}
        onConceptClick={editMode ? undefined : handleConceptClick}
        onNodeHover={setHoveredNodeId}
        onConnect={editMode ? handleConnect : undefined}
        onEdgeDelete={editMode ? handleEdgeDelete : undefined}
        onNodeDelete={editMode ? handleNodeDelete : undefined}
        onEdgeClick={editMode ? handleEdgeClick : undefined}
        onPaneClick={editMode ? handlePaneClick : undefined}
        className="h-full"
        fullBleed
      />

      {!editMode && (
        <MaterialPanel
          conceptId={selectedNode?.conceptId ?? null}
          conceptName={selectedNode?.conceptName ?? null}
          conceptDescription={selectedNode?.conceptDescription ?? null}
          onClose={handleClosePanel}
          onPractice={handlePractice}
        />
      )}
    </>
  );
}
