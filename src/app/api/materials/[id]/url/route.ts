import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET: return a signed URL for the material file (valid 1 hour) */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: material, error } = await supabase
    .from("course_materials")
    .select("file_path")
    .eq("id", id)
    .single();

  if (error || !material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  const { data: signedUrl, error: urlError } = await supabase.storage
    .from("course-materials")
    .createSignedUrl(material.file_path, 3600); // 1 hour

  if (urlError || !signedUrl) {
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrl.signedUrl });
}
