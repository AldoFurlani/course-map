"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Trash2,
  FileText,
  File,
  FileCode,
  Loader2,
  CheckCircle2,
  PackageOpen,
  Zap,
} from "lucide-react";
import type { CourseMaterial } from "@/lib/types/database";

interface MaterialManagerProps {
  initialMaterials: CourseMaterial[];
  courseId: string;
}

interface EmbeddingStatus {
  total: number;
  embedded: number;
  done: boolean;
}

const FILE_TYPE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  text: File,
  markdown: FileCode,
};

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  text: "TXT",
  markdown: "MD",
};

const ACCEPTED_EXTENSIONS = ".pdf,.txt,.md,.markdown";

export function MaterialManager({
  initialMaterials,
  courseId,
}: MaterialManagerProps) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [title, setTitle] = useState("");
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

          if (result.done && result.embedded === 0) {
            const statusRes = await fetch(
              `/api/materials/${materialId}/embeddings`
            );
            if (statusRes.ok) {
              const status = (await statusRes.json()) as EmbeddingStatus;
              setEmbeddingStatus((prev) => ({ ...prev, [materialId]: status }));
            }
            pollingIds.current.delete(materialId);
            return;
          }

          const statusRes = await fetch(
            `/api/materials/${materialId}/embeddings`
          );
          if (statusRes.ok) {
            const status = (await statusRes.json()) as EmbeddingStatus;
            setEmbeddingStatus((prev) => ({ ...prev, [materialId]: status }));

            if (status.done) {
              pollingIds.current.delete(materialId);
              return;
            }
          }

          setTimeout(processNext, 50);
        } catch {
          pollingIds.current.delete(materialId);
        }
      };

      processNext();
    },
    []
  );

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
    formData.append("course_id", courseId);

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

      const fileInput = document.getElementById(
        "file-input"
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";

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

  const embeddedCount = materials.filter((m) => embeddingStatus[m.id]?.done).length;
  const inProgressCount = materials.filter(
    (m) => embeddingStatus[m.id] && !embeddingStatus[m.id].done && embeddingStatus[m.id].total > 0
  ).length;

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="size-4 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Materials</p>
          </div>
          <p className="text-2xl font-semibold font-mono">{materials.length}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="size-4 text-success" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Embedded</p>
          </div>
          <p className="text-2xl font-semibold font-mono">
            {embeddedCount}
            <span className="text-sm font-normal text-muted-foreground">/{materials.length}</span>
          </p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="size-4 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Processing</p>
          </div>
          <p className="text-2xl font-semibold font-mono">{inProgressCount}</p>
        </div>
      </div>

      {/* Upload section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Upload className="size-4 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="font-serif text-xl font-semibold tracking-tight">
            Upload Material
          </h2>
        </div>
        <div className="rounded-xl ring-1 ring-foreground/10 px-5 py-4">
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
                <Label htmlFor="file-input">File (PDF, TXT, or Markdown)</Label>
                <input
                  id="file-input"
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm file:mr-2 file:inline-flex file:h-6 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-2 file:text-sm file:font-medium file:text-foreground"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {warning && (
              <p className="text-sm text-warning">{warning}</p>
            )}

            <Button type="submit" disabled={uploading || !file || !title.trim()}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Uploading & Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 size-4" />
                  Upload
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Materials list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PackageOpen className="size-4 text-muted-foreground" strokeWidth={1.5} />
            <h2 className="font-serif text-xl font-semibold tracking-tight">
              Uploaded Materials
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {materials.length} file{materials.length !== 1 ? "s" : ""}
          </p>
        </div>

        {materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="size-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">
              No materials uploaded yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload PDF, text, or markdown files to enable RAG-powered question generation.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {materials.map((m, idx) => {
              const Icon = FILE_TYPE_ICONS[m.file_type] ?? File;
              const typeLabel = FILE_TYPE_LABELS[m.file_type] ?? m.file_type.toUpperCase();
              const status = embeddingStatus[m.id];
              const isEmbedding = status && !status.done && status.total > 0;
              const isDone = status?.done;
              const progressPct = status && status.total > 0
                ? Math.round((status.embedded / status.total) * 100)
                : 0;

              return (
                <div
                  key={m.id}
                  className={`rounded-xl ring-1 ring-foreground/10 overflow-hidden border-l-[3px] transition-colors ${
                    isDone
                      ? "border-l-success"
                      : isEmbedding
                        ? "border-l-warning"
                        : "border-l-muted-foreground/20"
                  }`}
                  style={{
                    animation: `auth-field-enter 0.3s ease-out ${idx * 40}ms both`,
                  }}
                >
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="size-5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{m.title}</p>
                          <Badge variant="outline" className="text-[11px] shrink-0">
                            {typeLabel}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.file_name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Embedding status */}
                      {isEmbedding && (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="size-3.5 animate-spin text-warning" />
                          <span className="text-xs text-muted-foreground font-mono">
                            {status.embedded}/{status.total}
                          </span>
                        </div>
                      )}
                      {isDone && (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-success" />
                          <span className="text-xs text-muted-foreground font-mono">
                            {status.total} chunks
                          </span>
                        </div>
                      )}
                      {!status && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => startEmbedding(m.id)}
                        >
                          <Zap className="mr-1 size-3" />
                          Embed
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDelete(m.id)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Embedding progress bar */}
                  {isEmbedding && (
                    <div className="h-1 w-full bg-muted">
                      <div
                        className="h-1 bg-warning transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  )}
                  {isDone && (
                    <div className="h-1 w-full bg-success" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
