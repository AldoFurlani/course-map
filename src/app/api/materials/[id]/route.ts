import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Get the material to find its file path
  const { data: material, error: fetchError } = await supabase
    .from("course_materials")
    .select("file_path")
    .eq("id", id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 });
  }

  // Delete from storage
  if (material?.file_path) {
    await supabase.storage
      .from("course-materials")
      .remove([material.file_path]);
  }

  // Delete material record (cascades to chunks)
  const { error } = await supabase
    .from("course_materials")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
