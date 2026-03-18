import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireCourseOwner } from "@/lib/auth";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";
import { chunkText, chunkPdfPages, stripMarkdown } from "@/lib/rag/chunker";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");

  if (!courseId) {
    return NextResponse.json({ error: "course_id is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("course_materials")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const courseId = formData.get("course_id") as string | null;

  if (!courseId) {
    return NextResponse.json({ error: "course_id is required" }, { status: 400 });
  }

  const auth = await requireCourseOwner(courseId);
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const userId = auth.user.id;

  try {
    await checkRateLimit(supabase, "course_materials", "uploaded_by", userId, 20);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    throw err;
  }

  const file = formData.get("file") as File | null;
  const title = formData.get("title") as string | null;

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
  const filePath = `${userId}/${Date.now()}_${file.name}`;
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
      course_id: courseId,
      title: title.trim(),
      file_name: file.name,
      file_type: fileType,
      file_path: filePath,
      uploaded_by: userId,
    })
    .select()
    .single();

  if (insertError) {
    // Clean up uploaded file on failure
    await supabase.storage.from("course-materials").remove([filePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Extract text content from the already-read buffer
  let textContent: string | string[];
  try {
    textContent = await extractText(fileBuffer, fileType);
  } catch (err) {
    return NextResponse.json({
      ...material,
      warning: `File saved but text extraction failed: ${(err as Error).message}`,
    }, { status: 201 });
  }

  // Chunk the text (page-aware for PDFs, flat for text/markdown)
  const chunks = Array.isArray(textContent)
    ? chunkPdfPages(textContent.map((p) => p.replace(/\0/g, "")))
    : chunkText(textContent.replace(/\0/g, ""));

  if (chunks.length === 0) {
    return NextResponse.json(material, { status: 201 });
  }

  // Save chunks to database (without embeddings — those are generated async)
  const chunkRows = chunks.map((c) => ({
    course_id: courseId,
    material_id: material.id,
    chunk_text: c.text,
    chunk_index: c.index,
    page_number: c.pageNumber,
  }));
  const { error: chunkError } = await supabase
    .from("course_material_chunks")
    .insert(chunkRows);

  if (chunkError) {
    console.error("Chunk insert failed:", chunkError);
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
): Promise<string | string[]> {
  if (fileType === "pdf") {
    const { extractText: extractPdf } = await import("unpdf");
    // mergePages: false returns one string per page for page tracking
    const { text } = await extractPdf(new Uint8Array(buffer), { mergePages: false });
    return text as string[];
  }

  const raw = buffer.toString("utf-8");
  if (fileType === "markdown") {
    return stripMarkdown(raw);
  }
  return raw;
}
