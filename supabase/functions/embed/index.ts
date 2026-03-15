import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { texts } = await req.json();

    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(
        JSON.stringify({ error: "texts (string[]) required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate embeddings using Supabase AI (gte-small, 384 dimensions)
    const model = new Supabase.ai.Session("gte-small");
    const embeddings: number[][] = [];

    for (const text of texts) {
      const output = await model.run(text, {
        mean_pool: true,
        normalize: true,
      });
      embeddings.push(Array.from(output as Float32Array));
    }

    return new Response(
      JSON.stringify({ embeddings }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
