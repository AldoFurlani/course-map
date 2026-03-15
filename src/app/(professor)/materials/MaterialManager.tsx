"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { Upload, Trash2, FileText, File, FileCode, Loader2, CheckCircle2 } from "lucide-react";
import type { CourseMaterial, Concept } from "@/lib/types/database";

interface MaterialManagerProps {
  initialMaterials: CourseMaterial[];
  concepts: Concept[];
}

interface EmbeddingStatus {
  total: number;
  embedded: number;
  done: boolean;
}

const FILE_TYPE_ICONS = {
  pdf: FileText,
  text: File,
  markdown: FileCode,
} as const;

const ACCEPTED_EXTENSIONS = ".pdf,.txt,.md,.markdown";

export function MaterialManager({
  initialMaterials,
  concepts,
}: MaterialManagerProps) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [title, setTitle] = useState("");
  const [conceptId, setConceptId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  // Track embedding progress per material
  const [embeddingStatus, setEmbeddingStatus] = useState<
    Record<string, EmbeddingStatus>
  >({});
  const pollingIds = useRef<Set<string>>(new Set());

  const startEmbedding = useCallback(
    (materialId: string) => {
      if (pollingIds.current.has(materialId)) return;
      pollingIds.current.add(materialId);

      const processNext = async () => {
        try {
          // First get current status
          const statusRes = await fetch(
            `/api/materials/${materialId}/embeddings`
          );
          if (!statusRes.ok) { pollingIds.current.delete(materialId); return; }
          const status = (await statusRes.json()) as EmbeddingStatus;
          setEmbeddingStatus((prev) => ({ ...prev, [materialId]: status }));

          if (status.done || status.total === 0) {
            pollingIds.current.delete(materialId);
            return;
          }

          // Process next batch
          const res = await fetch(
            `/api/materials/${materialId}/embeddings`,
            { method: "POST" }
          );

          const result = await res.json();

          if (!res.ok) {
            console.error("Embedding batch error:", result);
            setError(`Embedding error: ${result.error || "Unknown"}`);
            pollingIds.current.delete(materialId);
            return;
          }

          // Update status with new counts
          setEmbeddingStatus((prev) => ({
            ...prev,
            [materialId]: {
              total: status.total,
              embedded: status.total - result.remaining,
              done: result.done,
            },
          }));

          if (!result.done) {
            processNext();
          } else {
            pollingIds.current.delete(materialId);
          }
        } catch {
          pollingIds.current.delete(materialId);
        }
      };
      processNext();
    },
    []
  );

  // On mount, check embedding status for all materials and auto-resume incomplete ones
  useEffect(() => {
    async function checkAll() {
      for (const m of initialMaterials) {
        try {
          const res = await fetch(`/api/materials/${m.id}/embeddings`);
          if (!res.ok) continue;
          const status = (await res.json()) as EmbeddingStatus;
          setEmbeddingStatus((prev) => ({ ...prev, [m.id]: status }));
          if (!status.done && status.total > 0) {
            startEmbedding(m.id);
          }
        } catch {
          // ignore
        }
      }
    }
    checkAll();
    return () => {
      pollingIds.current.clear();
    };
  }, [initialMaterials, startEmbedding]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;

    setUploading(true);
    setError("");
    setWarning("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    if (conceptId && conceptId !== "none") {
      formData.append("concept_id", conceptId);
    }

    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      if (data.warning) {
        setWarning(data.warning);
      }

      setMaterials((prev) => [data, ...prev]);
      setTitle("");
      setFile(null);
      setConceptId("");

      // Reset file input
      const fileInput = document.getElementById(
        "file-input"
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      // Start embedding process
      if (data.chunks_count > 0) {
        startEmbedding(data.id);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/materials/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Delete failed");
        return;
      }
      pollingIds.current.delete(id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      setEmbeddingStatus((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {
      setError("Network error. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Material</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Lecture 3 — Gradient Descent"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="concept">Related Concept (optional)</Label>
                <Select value={conceptId} onValueChange={(val) => setConceptId(val ?? "")}>
                  <SelectTrigger id="concept">
                    <SelectValue placeholder="Select concept..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {concepts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-input">File (PDF, TXT, or Markdown)</Label>
              <input
                id="file-input"
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm file:mr-2 file:inline-flex file:h-6 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-2 file:text-sm file:font-medium file:text-foreground"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {warning && (
              <p className="text-sm text-yellow-600">{warning}</p>
            )}

            <Button type="submit" disabled={uploading || !file || !title.trim()}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading & Processing..." : "Upload"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Materials list */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Materials ({materials.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No materials uploaded yet. Upload PDF, text, or markdown files to
              enable RAG-powered question generation.
            </p>
          ) : (
            <div className="space-y-2">
              {materials.map((m) => {
                const Icon = FILE_TYPE_ICONS[m.file_type];
                const concept = concepts.find((c) => c.id === m.concept_id);
                const status = embeddingStatus[m.id];
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.file_name}
                          {concept && (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5">
                              {concept.name}
                            </span>
                          )}
                        </p>
                        {status && !status.done && status.total > 0 && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Embedding: {status.embedded}/{status.total} chunks
                          </p>
                        )}
                        {status?.done && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {status.total} chunks embedded
                          </p>
                        )}
                        {!status && (
                          <button
                            type="button"
                            className="mt-1 text-xs text-blue-600 hover:underline"
                            onClick={() => startEmbedding(m.id)}
                          >
                            Generate embeddings
                          </button>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(m.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
