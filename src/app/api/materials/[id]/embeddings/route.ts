import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireProfessor } from "@/lib/auth";

/** GET: check embedding progress */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();

  const [{ count: total }, { count: embedded }] = await Promise.all([
    supabase
      .from("course_material_chunks")
      .select("id", { count: "exact", head: true })
      .eq("material_id", id),
    supabase
      .from("course_material_chunks")
      .select("id", { count: "exact", head: true })
      .eq("material_id", id)
      .not("embedding", "is", null),
  ]);

  const t = total ?? 0;
  const e = embedded ?? 0;

  return NextResponse.json({
    total: t,
    embedded: e,
    done: t > 0 && e === t,
  });
}

const BATCH_SIZE = 5;

/** Detect base64/binary junk */
function isJunkText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length < 50) return false;
  const spaces = (trimmed.match(/ /g) || []).length;
  if (trimmed.length > 100 && spaces / trimmed.length < 0.05) return true;
  const nonReadable = trimmed.replace(/[\x20-\x7E\n\r\t]/g, "").length;
  if (nonReadable / trimmed.length > 0.3) return true;
  if (/[A-Za-z0-9+/=]{80,}/.test(trimmed)) return true;
  return false;
}

/** POST: embed the next batch of unembedded chunks */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProfessor();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const { data: chunks, error } = await supabase
    .from("course_material_chunks")
    .select("id, chunk_text")
    .eq("material_id", id)
    .is("embedding", null)
    .order("chunk_index")
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!chunks || chunks.length === 0) {
    return NextResponse.json({ embedded: 0, remaining: 0, done: true });
  }

  let embeddedCount = 0;
  const zeroVector = JSON.stringify(Array(384).fill(0));

  // Separate junk from valid
  const junkIds: string[] = [];
  const valid: typeof chunks = [];
  for (const c of chunks) {
    if (isJunkText(c.chunk_text)) junkIds.push(c.id);
    else valid.push(c);
  }

  // Mark junk with zero vectors
  if (junkIds.length > 0) {
    await Promise.all(
      junkIds.map((chunkId) =>
        supabase
          .from("course_material_chunks")
          .update({ embedding: zeroVector })
          .eq("id", chunkId)
      )
    );
    embeddedCount += junkIds.length;
  }

  // Embed valid chunks via the embed edge function
  if (valid.length > 0) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: valid.map((c) => c.chunk_text) }),
      });

      if (res.ok) {
        const { embeddings } = (await res.json()) as { embeddings: number[][] };
        const updateResults = await Promise.all(
          valid.map((chunk, i) => {
            if (!embeddings[i]) return Promise.resolve(null);
            return supabase
              .from("course_material_chunks")
              .update({ embedding: JSON.stringify(embeddings[i]) })
              .eq("id", chunk.id);
          })
        );
        embeddedCount += valid.length;
      }
    } catch (err) {
      return NextResponse.json(
        { error: `Embedding error: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  // Check remaining
  const { count } = await supabase
    .from("course_material_chunks")
    .select("id", { count: "exact", head: true })
    .eq("material_id", id)
    .is("embedding", null);

  return NextResponse.json({
    embedded: embeddedCount,
    remaining: count ?? 0,
    done: (count ?? 0) === 0,
  });
}
