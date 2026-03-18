import { NextRequest, NextResponse } from "next/server";
import { requireCourseOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const auth = await requireCourseOwner(courseId);
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const { data: course, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(course);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const auth = await requireCourseOwner(courseId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { name, description } = body;

  const supabase = await createClient();
  const { data: course, error } = await supabase
    .from("courses")
    .update({
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description.trim() }),
    })
    .eq("id", courseId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(course);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const auth = await requireCourseOwner(courseId);
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("id", courseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
