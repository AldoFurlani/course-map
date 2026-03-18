"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const pdfjsOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
};

interface PdfViewerInnerProps {
  url: string;
  initialPage?: number;
  title: string;
  onClose: () => void;
}

export default function PdfViewerInner({
  url,
  initialPage = 1,
  title,
  onClose,
}: PdfViewerInnerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [scale, setScale] = useState(1.2);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(
    async (pdf: { numPages: number; getPage: (n: number) => Promise<{ getViewport: (opts: { scale: number }) => { width: number; height: number } }> }) => {
      setNumPages(pdf.numPages);
      setPageNumber(Math.min(initialPage, pdf.numPages));

      // Detect aspect ratio from first page to set default zoom
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const isLandscape = viewport.width > viewport.height;
      setScale(isLandscape ? 2.8 : 1.2);
    },
    [initialPage]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setPageNumber((p) => Math.max(1, p - 1));
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setPageNumber((p) => Math.min(numPages, p + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [numPages, onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background/95 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b border-border px-4 h-12 shrink-0">
        {/* Back button */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back</span>
        </button>

        <div className="h-4 w-px bg-border" />

        <h2 className="font-serif text-sm font-semibold tracking-tight truncate flex-1">
          {title}
        </h2>

        {/* Controls cluster */}
        <div className="flex items-center gap-1">
          {/* Zoom */}
          <button
            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
          >
            <Minus className="size-3" />
          </button>
          <span className="text-[11px] font-mono text-muted-foreground w-8 text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
          >
            <Plus className="size-3" />
          </button>

          <div className="mx-1.5 h-4 w-px bg-border" />

          {/* Page navigation */}
          <button
            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-[11px] font-mono text-muted-foreground tabular-nums px-1">
            {pageNumber}
            <span className="text-muted-foreground/50 mx-0.5">/</span>
            {numPages || "–"}
          </span>
          <button
            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* PDF canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/40 flex justify-center items-start py-8 px-4"
      >
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          options={pdfjsOptions}
          loading={
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="size-6 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Loading document...
                </p>
              </div>
            </div>
          }
          error={
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-destructive">Failed to load PDF</p>
            </div>
          }
        >
          <div className="rounded-sm shadow-[0_2px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_20px_rgba(0,0,0,0.3)] ring-1 ring-foreground/5 overflow-hidden">
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </div>
        </Document>
      </div>
    </div>
  );
}
