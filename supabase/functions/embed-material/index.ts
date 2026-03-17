import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BATCH_SIZE = 10;

/** Detect base64/binary junk extracted from PDF images/fonts */
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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { material_id } = await req.json();

    if (!material_id) {
      return new Response(
        JSON.stringify({ error: "material_id required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch one batch of unembedded chunks
    const { data: chunks, error: fetchError } = await supabase
      .from("course_material_chunks")
      .select("id, chunk_text")
      .eq("material_id", material_id)
      .is("embedding", null)
      .order("chunk_index")
      .limit(BATCH_SIZE);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({ embedded: 0, done: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const zeroVector = JSON.stringify(Array(384).fill(0));
    let embeddedCount = 0;

    // Separate junk from valid chunks
    const junkChunks: typeof chunks = [];
    const validChunks: typeof chunks = [];
    for (const chunk of chunks) {
      if (isJunkText(chunk.chunk_text)) {
        junkChunks.push(chunk);
      } else {
        validChunks.push(chunk);
      }
    }

    // Mark junk with zero vectors
    if (junkChunks.length > 0) {
      await Promise.all(
        junkChunks.map((c) =>
          supabase
            .from("course_material_chunks")
            .update({ embedding: zeroVector })
            .eq("id", c.id)
        )
      );
      embeddedCount += junkChunks.length;
    }

    // Embed valid chunks by calling the existing embed function
    if (validChunks.length > 0) {
      const embedRes = await fetch(`${supabaseUrl}/functions/v1/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: validChunks.map((c) => c.chunk_text) }),
      });

      if (!embedRes.ok) {
        const errBody = await embedRes.text();
        return new Response(
          JSON.stringify({ error: `embed function failed: ${embedRes.status} ${errBody}` }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      {
        const { embeddings } = await embedRes.json() as { embeddings: number[][] };

        await Promise.all(
          validChunks.map((chunk, i) => {
            if (!embeddings[i]) return Promise.resolve();
            return supabase
              .from("course_material_chunks")
              .update({ embedding: JSON.stringify(embeddings[i]) })
              .eq("id", chunk.id);
          })
        );
        embeddedCount += validChunks.length;
      }
    }

    // Check remaining
    const { count } = await supabase
      .from("course_material_chunks")
      .select("id", { count: "exact", head: true })
      .eq("material_id", material_id)
      .is("embedding", null);

    return new Response(
      JSON.stringify({
        embedded: embeddedCount,
        remaining: count ?? 0,
        done: (count ?? 0) === 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
