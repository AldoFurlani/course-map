import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET: check embedding progress */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

const BATCH_SIZE = 10;
const PARALLEL_CALLS = 3;

/** POST: embed the next batch of unembedded chunks */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Fetch a larger set of unembedded chunks to process in parallel
  const fetchSize = BATCH_SIZE * PARALLEL_CALLS;
  const { data: chunks, error } = await supabase
    .from("course_material_chunks")
    .select("id, chunk_text, chunk_index")
    .eq("material_id", id)
    .is("embedding", null)
    .order("chunk_index")
    .limit(fetchSize);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!chunks || chunks.length === 0) {
    return NextResponse.json({ embedded: 0, done: true });
  }

  // Split into sub-batches and call edge function in parallel
  const batches: (typeof chunks)[] = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    batches.push(chunks.slice(i, i + BATCH_SIZE));
  }

  let embeddedCount = 0;

  try {
    const results = await Promise.allSettled(
      batches.map(async (batch) => {
        const res = await fetch(`${supabaseUrl}/functions/v1/embed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: batch.map((c) => c.chunk_text) }),
        });

        if (!res.ok) return null;

        const { embeddings } = (await res.json()) as {
          embeddings: number[][];
        };
        return { batch, embeddings };
      })
    );

    // Collect all successful updates
    const updates: { id: string; embedding: string }[] = [];
    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { batch, embeddings } = result.value;
      for (let i = 0; i < batch.length; i++) {
        if (embeddings[i]) {
          updates.push({
            id: batch[i].id,
            embedding: JSON.stringify(embeddings[i]),
          });
        }
      }
    }

    // Batch update via parallel DB calls (groups of 10)
    const DB_BATCH = 10;
    for (let i = 0; i < updates.length; i += DB_BATCH) {
      const group = updates.slice(i, i + DB_BATCH);
      await Promise.all(
        group.map(({ id: chunkId, embedding }) =>
          supabase
            .from("course_material_chunks")
            .update({ embedding })
            .eq("id", chunkId)
        )
      );
      embeddedCount += group.length;
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Embedding error: ${(err as Error).message}` },
      { status: 500 }
    );
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
