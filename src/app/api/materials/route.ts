import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chunkText, stripMarkdown } from "@/lib/rag/chunker";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("course_materials")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = formData.get("title") as string | null;
  const conceptId = formData.get("concept_id") as string | null;

  if (!file || !title?.trim()) {
    return NextResponse.json(
      { error: "File and title are required" },
      { status: 400 }
    );
  }

  // Determine file type
  const ext = file.name.split(".").pop()?.toLowerCase();
  let fileType: "pdf" | "text" | "markdown";
  if (ext === "pdf") fileType = "pdf";
  else if (ext === "md" || ext === "markdown") fileType = "markdown";
  else fileType = "text";

  // Read file buffer once (File stream can only be consumed once)
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // Upload file to Supabase Storage
  const filePath = `${user.id}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("course-materials")
    .upload(filePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Insert material record
  const { data: material, error: insertError } = await supabase
    .from("course_materials")
    .insert({
      title: title.trim(),
      file_name: file.name,
      file_type: fileType,
      file_path: filePath,
      uploaded_by: user.id,
      concept_id: conceptId || null,
    })
    .select()
    .single();

  if (insertError) {
    // Clean up uploaded file on failure
    await supabase.storage.from("course-materials").remove([filePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Extract text content from the already-read buffer
  let textContent: string;
  try {
    textContent = await extractText(fileBuffer, fileType);
  } catch (err) {
    return NextResponse.json({
      ...material,
      warning: `File saved but text extraction failed: ${(err as Error).message}`,
    }, { status: 201 });
  }

  // Strip null bytes and other characters Postgres text columns reject
  const sanitized = textContent.replace(/\0/g, "");

  // Chunk the text
  const chunks = chunkText(sanitized);

  if (chunks.length === 0) {
    return NextResponse.json(material, { status: 201 });
  }

  // Save chunks to database (without embeddings — those are generated async)
  const chunkRows = chunks.map((c) => ({
    material_id: material.id,
    chunk_text: c.text,
    chunk_index: c.index,
  }));
  const { error: chunkError } = await supabase
    .from("course_material_chunks")
    .insert(chunkRows);

  if (chunkError) {
    return NextResponse.json({
      ...material,
      warning: `File saved but chunking failed: ${chunkError.message}`,
    }, { status: 201 });
  }

  return NextResponse.json({
    ...material,
    chunks_count: chunks.length,
  }, { status: 201 });
}

async function extractText(
  buffer: Buffer,
  fileType: "pdf" | "text" | "markdown"
): Promise<string> {
  if (fileType === "pdf") {
    const { extractText: extractPdf } = await import("unpdf");
    const { text } = await extractPdf(new Uint8Array(buffer));
    return text.join("\n");
  }

  const raw = buffer.toString("utf-8");
  if (fileType === "markdown") {
    return stripMarkdown(raw);
  }
  return raw;
}
