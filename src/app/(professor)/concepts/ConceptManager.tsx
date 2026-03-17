"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConceptGraph } from "@/components/graph/ConceptGraph";
import { layoutGraph } from "@/lib/graph/layout";
import type {
  Concept,
  ConceptEdge,
  GeneratedConcept,
  GeneratedEdge,
  GeneratedGraphPreview,
} from "@/lib/types/database";
import type { Node, Edge } from "@xyflow/react";
import type { ConceptNodeData } from "@/lib/graph/layout";
import { Pencil, Trash2, X, Check, Sparkles, Loader2 } from "lucide-react";

interface ConceptManagerProps {
  initialConcepts: Concept[];
  initialEdges: ConceptEdge[];
  initialNodes: Node<ConceptNodeData>[];
  initialFlowEdges: Edge[];
}

export function ConceptManager({
  initialConcepts,
  initialEdges,
  initialNodes,
  initialFlowEdges,
}: ConceptManagerProps) {
  const [concepts, setConcepts] = useState(initialConcepts);
  const [edges, setEdges] = useState(initialEdges);
  const [flowNodes, setFlowNodes] = useState(initialNodes);
  const [flowEdges, setFlowEdges] = useState(initialFlowEdges);

  // Add concept form
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Edit concept
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Add edge form
  const [edgeSource, setEdgeSource] = useState("");
  const [edgeTarget, setEdgeTarget] = useState("");
  const [edgeLoading, setEdgeLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Generate from materials
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<GeneratedGraphPreview | null>(null);
  const [previewConcepts, setPreviewConcepts] = useState<
    (GeneratedConcept & { included: boolean })[]
  >([]);
  const [previewEdges, setPreviewEdges] = useState<
    (GeneratedEdge & { included: boolean })[]
  >([]);
  const [applying, setApplying] = useState(false);

  const recomputeLayout = useCallback(
    (c: Concept[], e: ConceptEdge[]) => {
      const { nodes, edges: fe } = layoutGraph(c, e);
      setFlowNodes(nodes);
      setFlowEdges(fe);
    },
    []
  );

  // Compute preview graph for the generated concepts/edges
  function computePreviewGraph() {
    const includedConcepts = previewConcepts.filter((c) => c.included);
    const includedEdges = previewEdges.filter((e) => e.included);

    const pseudoConcepts: Concept[] = includedConcepts.map((c, i) => ({
      id: c.existing_id ?? `preview-${i}`,
      name: c.name,
      description: c.description,
      cached_embedding: null,
      created_at: "",
      updated_at: "",
    }));

    const nameToId = new Map(
      pseudoConcepts.map((c) => [c.name.toLowerCase().trim(), c.id])
    );

    const pseudoEdges: ConceptEdge[] = includedEdges
      .map((e, i) => ({
        id: `preview-edge-${i}`,
        source_id: nameToId.get(e.source_name.toLowerCase().trim()) ?? "",
        target_id: nameToId.get(e.target_name.toLowerCase().trim()) ?? "",
        created_at: "",
      }))
      .filter((e) => e.source_id && e.target_id);

    return layoutGraph(pseudoConcepts, pseudoEdges);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/concepts/generate", { method: "POST" });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to generate concept graph");
        setGenerating(false);
        return;
      }

      const data: GeneratedGraphPreview = await res.json();
      setPreview(data);
      setPreviewConcepts(
        data.concepts.map((c) => ({ ...c, included: true }))
      );
      setPreviewEdges(
        data.edges.map((e) => ({ ...e, included: true }))
      );
    } catch {
      setError("Failed to generate concept graph. Please try again.");
    }

    setGenerating(false);
  }

  async function handleApply() {
    setApplying(true);
    setError(null);

    const conceptsToApply = previewConcepts.filter((c) => c.included);
    const edgesToApply = previewEdges.filter((e) => e.included);

    // Only include edges whose concepts are both included
    const includedNames = new Set(
      conceptsToApply.map((c) => c.name.toLowerCase().trim())
    );
    const validEdges = edgesToApply.filter(
      (e) =>
        includedNames.has(e.source_name.toLowerCase().trim()) &&
        includedNames.has(e.target_name.toLowerCase().trim())
    );

    try {
      const res = await fetch("/api/concepts/generate/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          concepts: conceptsToApply.map(({ included, ...c }) => c),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          edges: validEdges.map(({ included, ...e }) => e),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to apply generated graph");
        setApplying(false);
        return;
      }

      const data = await res.json();
      setConcepts(data.concepts);
      setEdges(data.edges);
      recomputeLayout(data.concepts, data.edges);
      setPreview(null);
      setPreviewConcepts([]);
      setPreviewEdges([]);
    } catch {
      setError("Failed to apply generated graph. Please try again.");
    }

    setApplying(false);
  }

  function handleCancelPreview() {
    setPreview(null);
    setPreviewConcepts([]);
    setPreviewEdges([]);
  }

  function togglePreviewConcept(index: number) {
    setPreviewConcepts((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, included: !c.included } : c
      )
    );
  }

  function togglePreviewEdge(index: number) {
    setPreviewEdges((prev) =>
      prev.map((e, i) =>
        i === index ? { ...e, included: !e.included } : e
      )
    );
  }

  function updatePreviewConceptName(index: number, name: string) {
    setPreviewConcepts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, name } : c))
    );
  }

  function updatePreviewConceptDescription(index: number, description: string) {
    setPreviewConcepts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, description } : c))
    );
  }

  async function handleAddConcept(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddLoading(true);
    setError(null);

    const res = await fetch("/api/concepts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to add concept");
      setAddLoading(false);
      return;
    }

    const created: Concept = await res.json();
    const updated = [...concepts, created];
    setConcepts(updated);
    recomputeLayout(updated, edges);
    setNewName("");
    setNewDescription("");
    setAddLoading(false);
  }

  async function handleDeleteConcept(id: string) {
    setError(null);
    const res = await fetch(`/api/concepts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to delete concept");
      return;
    }

    const updatedConcepts = concepts.filter((c) => c.id !== id);
    const updatedEdges = edges.filter(
      (e) => e.source_id !== id && e.target_id !== id
    );
    setConcepts(updatedConcepts);
    setEdges(updatedEdges);
    recomputeLayout(updatedConcepts, updatedEdges);
  }

  function startEdit(concept: Concept) {
    setEditId(concept.id);
    setEditName(concept.name);
    setEditDescription(concept.description);
  }

  async function handleSaveEdit() {
    if (!editId || !editName.trim()) return;
    setEditLoading(true);
    setError(null);

    const res = await fetch(`/api/concepts/${editId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to update concept");
      setEditLoading(false);
      return;
    }

    const updated: Concept = await res.json();
    const updatedConcepts = concepts.map((c) =>
      c.id === editId ? updated : c
    );
    setConcepts(updatedConcepts);
    recomputeLayout(updatedConcepts, edges);
    setEditId(null);
    setEditLoading(false);
  }

  async function handleAddEdge(e: React.FormEvent) {
    e.preventDefault();
    if (!edgeSource || !edgeTarget) return;
    setEdgeLoading(true);
    setError(null);

    // Resolve names to IDs
    const sourceId = concepts.find((c) => c.name === edgeSource)?.id;
    const targetId = concepts.find((c) => c.name === edgeTarget)?.id;
    if (!sourceId || !targetId) {
      setError("Could not resolve concept names");
      setEdgeLoading(false);
      return;
    }

    const res = await fetch("/api/concept-edges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to add edge");
      setEdgeLoading(false);
      return;
    }

    const created: ConceptEdge = await res.json();
    const updatedEdges = [...edges, created];
    setEdges(updatedEdges);
    recomputeLayout(concepts, updatedEdges);
    setEdgeSource("");
    setEdgeTarget("");
    setEdgeLoading(false);
  }

  async function handleDeleteEdge(id: string) {
    setError(null);
    const res = await fetch(`/api/concept-edges?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to delete edge");
      return;
    }

    const updatedEdges = edges.filter((e) => e.id !== id);
    setEdges(updatedEdges);
    recomputeLayout(concepts, updatedEdges);
  }

  const conceptName = (id: string) =>
    concepts.find((c) => c.id === id)?.name ?? id;

  // Preview mode: show review UI
  if (preview) {
    const previewLayout = computePreviewGraph();

    return (
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
        <div className="space-y-6">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold tracking-tight">Review Generated Graph</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelPreview}
                disabled={applying}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={applying}
              >
                {applying ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  "Apply"
                )}
              </Button>
            </div>
          </div>

          {/* Preview concepts */}
          <Card>
            <CardHeader>
              <CardTitle>
                Concepts ({previewConcepts.filter((c) => c.included).length}/
                {previewConcepts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {previewConcepts.map((concept, i) => (
                  <li
                    key={i}
                    className={`rounded-md border px-3 py-2 ${
                      concept.included ? "" : "opacity-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={concept.included}
                        onChange={() => togglePreviewConcept(i)}
                        className="mt-1.5 shrink-0"
                      />
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Input
                            value={concept.name}
                            onChange={(e) =>
                              updatePreviewConceptName(i, e.target.value)
                            }
                            className="h-7 text-sm"
                            disabled={concept.status === "existing"}
                          />
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                              concept.status === "existing"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                            }`}
                          >
                            {concept.status === "existing"
                              ? "Existing"
                              : "New"}
                          </span>
                        </div>
                        <Input
                          value={concept.description}
                          onChange={(e) =>
                            updatePreviewConceptDescription(
                              i,
                              e.target.value
                            )
                          }
                          placeholder="Description..."
                          className="h-7 text-sm"
                          disabled={concept.status === "existing"}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Preview edges */}
          <Card>
            <CardHeader>
              <CardTitle>
                Edges ({previewEdges.filter((e) => e.included).length}/
                {previewEdges.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {previewEdges.map((edge, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      edge.included ? "" : "opacity-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={edge.included}
                      onChange={() => togglePreviewEdge(i)}
                      className="shrink-0"
                    />
                    <span>
                      {edge.source_name}{" "}
                      <span className="text-muted-foreground">→</span>{" "}
                      {edge.target_name}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Right panel: preview graph */}
        <div className="sticky top-6 self-start">
          <h2 className="font-serif text-lg font-semibold tracking-tight mb-3">Preview</h2>
          <div className="h-[calc(100vh-10rem)]">
            <ConceptGraph
              nodes={previewLayout.nodes}
              edges={previewLayout.edges}
              interactive
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
      {/* Left panel: forms + lists */}
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Generate from materials */}
        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={handleGenerate}
              disabled={generating}
              variant="outline"
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Analyzing materials...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  Generate from Materials
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Uses AI to extract concepts and prerequisites from uploaded course
              materials.
            </p>
          </CardContent>
        </Card>

        {/* Add concept form */}
        <Card>
          <CardHeader>
            <CardTitle>Add Concept</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddConcept} className="space-y-3">
              <div>
                <Label htmlFor="concept-name">Name</Label>
                <Input
                  id="concept-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Neural Networks"
                  required
                />
              </div>
              <div>
                <Label htmlFor="concept-desc">Description</Label>
                <Input
                  id="concept-desc"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief description..."
                />
              </div>
              <Button type="submit" disabled={addLoading || !newName.trim()}>
                {addLoading ? "Adding..." : "Add Concept"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Add edge form */}
        <Card>
          <CardHeader>
            <CardTitle>Add Prerequisite Edge</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddEdge} className="space-y-3">
              <div>
                <Label>Prerequisite (source)</Label>
                <Select value={edgeSource} onValueChange={(v) => setEdgeSource(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select prerequisite..." />
                  </SelectTrigger>
                  <SelectContent>
                    {concepts.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dependent (target)</Label>
                <Select value={edgeTarget} onValueChange={(v) => setEdgeTarget(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select dependent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {concepts.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                disabled={edgeLoading || !edgeSource || !edgeTarget}
              >
                {edgeLoading ? "Adding..." : "Add Edge"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Concept list */}
        <Card>
          <CardHeader>
            <CardTitle>Concepts ({concepts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {concepts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No concepts yet.</p>
            ) : (
              <ul className="space-y-2">
                {concepts.map((concept) => (
                  <li
                    key={concept.id}
                    className="flex items-start justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    {editId === concept.id ? (
                      <div className="flex-1 space-y-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-sm"
                        />
                        <Input
                          value={editDescription}
                          onChange={(e) =>
                            setEditDescription(e.target.value)
                          }
                          placeholder="Description..."
                          className="h-7 text-sm"
                        />
                        <div className="flex gap-1">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={handleSaveEdit}
                            disabled={editLoading}
                          >
                            <Check className="size-3" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => setEditId(null)}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            {concept.name}
                          </div>
                          {concept.description && (
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {concept.description}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => startEdit(concept)}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="destructive"
                            onClick={() => handleDeleteConcept(concept.id)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Edge list */}
        <Card>
          <CardHeader>
            <CardTitle>Edges ({edges.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {edges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No edges yet.</p>
            ) : (
              <ul className="space-y-2">
                {edges.map((edge) => (
                  <li
                    key={edge.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span>
                      {conceptName(edge.source_id)}{" "}
                      <span className="text-muted-foreground">→</span>{" "}
                      {conceptName(edge.target_id)}
                    </span>
                    <Button
                      size="icon-xs"
                      variant="destructive"
                      onClick={() => handleDeleteEdge(edge.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right panel: graph preview */}
      <div className="sticky top-6 self-start">
        <h2 className="font-serif text-lg font-semibold tracking-tight mb-3">Graph Preview</h2>
        <div className="h-[calc(100vh-10rem)]">
          <ConceptGraph nodes={flowNodes} edges={flowEdges} interactive />
        </div>
      </div>
    </div>
  );
}
