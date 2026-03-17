/**
 * Text chunking for RAG pipeline.
 * PDF chunking is page-aware and splits on paragraph/sentence boundaries.
 * Produces variable-size chunks that respect semantic boundaries.
 */

const MAX_CHUNK_SIZE = 1000;
const MIN_CHUNK_SIZE = 50;

export interface TextChunk {
  text: string;
  index: number;
  /** 1-based page number (PDF only, null for text/markdown) */
  pageNumber: number | null;
}

/**
 * Split text into chunks by paragraph and sentence boundaries.
 * Used for plain text and markdown (no page tracking).
 */
export function chunkText(text: string): TextChunk[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: TextChunk[] = [];
  let index = 0;
  let buffer = "";

  for (const para of paragraphs) {
    // If adding this paragraph exceeds max, flush buffer first
    if (buffer && buffer.length + para.length + 2 > MAX_CHUNK_SIZE) {
      chunks.push({ text: buffer, index, pageNumber: null });
      index++;
      buffer = "";
    }

    // If a single paragraph exceeds max, split on sentences
    if (para.length > MAX_CHUNK_SIZE) {
      if (buffer) {
        chunks.push({ text: buffer, index, pageNumber: null });
        index++;
        buffer = "";
      }
      for (const chunk of splitOnSentences(para)) {
        chunks.push({ text: chunk, index, pageNumber: null });
        index++;
      }
      continue;
    }

    buffer = buffer ? buffer + "\n\n" + para : para;
  }

  if (buffer && buffer.length >= MIN_CHUNK_SIZE) {
    chunks.push({ text: buffer, index, pageNumber: null });
  }

  return chunks;
}

/**
 * Split a long text block on sentence boundaries to stay under MAX_CHUNK_SIZE.
 */
function splitOnSentences(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  const chunks: string[] = [];
  let buffer = "";

  for (const sentence of sentences) {
    if (buffer && buffer.length + sentence.length > MAX_CHUNK_SIZE) {
      if (buffer.trim()) chunks.push(buffer.trim());
      buffer = "";
    }
    buffer += sentence;
  }

  if (buffer.trim() && buffer.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push(buffer.trim());
  }

  return chunks;
}

/**
 * Detect and strip repeated header/footer lines from slide decks.
 * Beamer/LaTeX slides repeat the author, title, and page number on every page.
 * These add noise to chunks and inflate similarity for title-like queries.
 *
 * Normalizes digits before comparing so "1 / 31" and "2 / 31" match.
 * Only applies to documents with >6 pages, and only strips lines >30 chars.
 */
function stripRepeatedLines(pages: string[]): string[] {
  if (pages.length <= 6) return pages;

  const lineFrequency = new Map<string, number>();
  const pageLines = pages.map((page) => page.split("\n"));

  for (const lines of pageLines) {
    const seen = new Set<string>();
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length <= 30) continue;
      const normalized = trimmed.replace(/\d+/g, "#");
      if (!seen.has(normalized)) {
        seen.add(normalized);
        lineFrequency.set(normalized, (lineFrequency.get(normalized) ?? 0) + 1);
      }
    }
  }

  const threshold = pages.length * 0.5;
  const repeatedPatterns = new Set<string>();
  for (const [pattern, count] of lineFrequency) {
    if (count > threshold) {
      repeatedPatterns.add(pattern);
    }
  }

  if (repeatedPatterns.size === 0) return pages;

  return pages.map((page) =>
    page
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        if (trimmed.length <= 30) return true;
        const normalized = trimmed.replace(/\d+/g, "#");
        return !repeatedPatterns.has(normalized);
      })
      .join("\n")
  );
}

/** Detect junk page text (base64 images, embedded fonts, binary data from PDF extraction) */
function isJunkPage(text: string): boolean {
  if (text.length < 50) return false;
  const spaces = (text.match(/ /g) || []).length;
  if (text.length > 100 && spaces / text.length < 0.05) return true;
  const nonReadable = text.replace(/[\x20-\x7E\n\r\t]/g, "").length;
  if (nonReadable / text.length > 0.3) return true;
  if (/[A-Za-z0-9+/=]{80,}/.test(text)) return true;
  return false;
}

/**
 * Chunk PDF text with page-aware, paragraph-based splitting.
 * Each page is chunked independently — chunks never span page boundaries.
 * Within a page, splits on paragraph boundaries (\n\n), merging short
 * paragraphs together and splitting long ones on sentence boundaries.
 */
export function chunkPdfPages(pages: string[]): TextChunk[] {
  // Strip repeated headers/footers (e.g. beamer slide footers)
  const cleanedPages = stripRepeatedLines(pages);

  const chunks: TextChunk[] = [];
  let index = 0;

  for (let i = 0; i < cleanedPages.length; i++) {
    const pageText = cleanedPages[i].replace(/\r\n/g, "\n").trim();
    if (!pageText || pageText.length < MIN_CHUNK_SIZE || isJunkPage(pageText)) continue;

    const pageNumber = i + 1; // 1-based
    const paragraphs = pageText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

    // If the entire page is short enough, it's one chunk
    if (pageText.length <= MAX_CHUNK_SIZE) {
      chunks.push({ text: pageText, index, pageNumber });
      index++;
      continue;
    }

    // Otherwise, group paragraphs into chunks
    let buffer = "";

    for (const para of paragraphs) {
      if (buffer && buffer.length + para.length + 2 > MAX_CHUNK_SIZE) {
        chunks.push({ text: buffer, index, pageNumber });
        index++;
        buffer = "";
      }

      // Single paragraph exceeds max — split on sentences
      if (para.length > MAX_CHUNK_SIZE) {
        if (buffer) {
          chunks.push({ text: buffer, index, pageNumber });
          index++;
          buffer = "";
        }
        for (const sentenceChunk of splitOnSentences(para)) {
          chunks.push({ text: sentenceChunk, index, pageNumber });
          index++;
        }
        continue;
      }

      buffer = buffer ? buffer + "\n\n" + para : para;
    }

    if (buffer && buffer.length >= MIN_CHUNK_SIZE) {
      chunks.push({ text: buffer, index, pageNumber });
      index++;
    }
  }

  return chunks;
}

/**
 * Extract plain text from markdown by stripping common syntax.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")       // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")    // bold
    .replace(/\*(.+?)\*/g, "$1")        // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, "")) // inline code
    .replace(/^\s*[-*+]\s+/gm, "")      // unordered lists
    .replace(/^\s*\d+\.\s+/gm, "")      // ordered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // images
    .trim();
}
