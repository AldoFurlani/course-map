/**
 * Text chunking for RAG pipeline.
 * Splits documents into overlapping chunks suitable for embedding.
 */

const DEFAULT_CHUNK_SIZE = 512;
const DEFAULT_CHUNK_OVERLAP = 64;

export interface TextChunk {
  text: string;
  index: number;
}

/**
 * Split text into overlapping chunks by character count,
 * preferring to break on paragraph/sentence boundaries.
 */
export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  chunkOverlap = DEFAULT_CHUNK_OVERLAP
): TextChunk[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    // Try to break on a paragraph boundary (\n\n)
    if (end < cleaned.length) {
      const paraBreak = cleaned.lastIndexOf("\n\n", end);
      if (paraBreak > start + chunkSize * 0.3) {
        end = paraBreak + 2;
      } else {
        // Fall back to sentence boundary
        const sentenceBreak = cleaned.lastIndexOf(". ", end);
        if (sentenceBreak > start + chunkSize * 0.3) {
          end = sentenceBreak + 2;
        }
      }
    }

    const chunkText = cleaned.slice(start, end).trim();
    if (chunkText) {
      chunks.push({ text: chunkText, index });
      index++;
    }

    // Move start forward, keeping overlap
    const nextStart = end - chunkOverlap;
    start = nextStart <= start ? end : nextStart;
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
