"use client";

import dynamic from "next/dynamic";

const PdfViewerInner = dynamic(() => import("./PdfViewerInner"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Loading PDF viewer...</p>
    </div>
  ),
});

interface PdfViewerProps {
  url: string;
  initialPage?: number;
  title: string;
  onClose: () => void;
}

export function PdfViewer(props: PdfViewerProps) {
  return <PdfViewerInner {...props} />;
}
