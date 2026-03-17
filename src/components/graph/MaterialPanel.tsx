"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, BookOpen, ArrowRight, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PdfViewer } from "./PdfViewer";

interface MaterialResult {
  materialId: string;
  materialTitle: string;
  fileName: string;
  fileType: string;
  filePath: string;
  pageNumber: number | null;
  similarity: number;
}

interface MaterialPanelProps {
  conceptId: string | null;
  conceptName: string | null;
  conceptDescription: string | null;
  onClose: () => void;
  onPractice: (conceptName: string) => void;
}

export function MaterialPanel({
  conceptId,
  conceptName,
  conceptDescription,
  onClose,
  onPractice,
}: MaterialPanelProps) {
  const [results, setResults] = useState<MaterialResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfView, setPdfView] = useState<{
    materialId: string;
    title: string;
    page: number;
  } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const fetchMaterials = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/concepts/${id}/materials`);
      if (!res.ok) throw new Error("Failed to search materials");
      const data = await res.json();
      setResults(data.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (conceptId) {
      fetchMaterials(conceptId);
      setPdfView(null);
      setPdfUrl(null);
    }
  }, [conceptId, fetchMaterials]);

  // Close on Escape (only when PDF viewer is not open)
  useEffect(() => {
    if (pdfView) return; // PDF viewer handles its own Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, pdfView]);

  const openPdf = useCallback(async (result: MaterialResult) => {
    setPdfView({
      materialId: result.materialId,
      title: result.materialTitle,
      page: result.pageNumber ?? 1,
    });

    try {
      const res = await fetch(`/api/materials/${result.materialId}/url`);
      if (!res.ok) throw new Error("Failed to get file URL");
      const data = await res.json();
      setPdfUrl(data.url);
    } catch {
      setPdfUrl(null);
      setPdfView(null);
    }
  }, []);

  const closePdf = useCallback(() => {
    setPdfView(null);
    setPdfUrl(null);
  }, []);

  if (!conceptId || !conceptName) return null;

  // Deduplicate: group by material, keep the best match per material
  const deduped = Object.values(
    results.reduce<Record<string, MaterialResult>>((acc, r) => {
      if (!acc[r.materialId] || r.similarity > acc[r.materialId].similarity) {
        acc[r.materialId] = r;
      }
      return acc;
    }, {})
  ).sort((a, b) => b.similarity - a.similarity);

  return createPortal(
    <>
      {/* PDF Viewer overlay */}
      {pdfView && pdfUrl && (
        <PdfViewer
          url={pdfUrl}
          initialPage={pdfView.page}
          title={pdfView.title}
          onClose={closePdf}
        />
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-background shadow-lg animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 shrink-0 text-muted-foreground" />
              <h2 className="font-serif text-lg font-semibold tracking-tight truncate">
                {conceptName}
              </h2>
            </div>
            {conceptDescription && (
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {conceptDescription}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h3 className="font-serif text-sm font-semibold tracking-tight mb-3">
            Course Materials
          </h3>

          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {!loading && !error && deduped.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText className="size-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No matching materials found
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Materials need to be uploaded and embedded before they can be searched.
              </p>
            </div>
          )}

          {!loading && !error && deduped.length > 0 && (
            <div className="space-y-2">
              {deduped.map((result) => (
                <button
                  key={`${result.materialId}-${result.pageNumber}`}
                  onClick={() => {
                    if (result.fileType === "pdf") {
                      openPdf(result);
                    }
                  }}
                  disabled={result.fileType !== "pdf"}
                  className="group w-full text-left rounded-xl ring-1 ring-foreground/10 bg-card px-4 py-3 transition-all hover:ring-foreground/20 hover:shadow-sm disabled:opacity-60 disabled:cursor-default"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">
                        {result.materialTitle}
                      </span>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{result.fileName}</span>
                        {result.pageNumber && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="font-mono shrink-0">
                              p. {result.pageNumber}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {result.fileType === "pdf" && (
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/50"
                        style={{ width: `${Math.round(result.similarity * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0 tabular-nums">
                      {Math.round(result.similarity * 100)}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3">
          <Button
            onClick={() => onPractice(conceptName)}
            className="w-full"
          >
            Practice this concept
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
}
