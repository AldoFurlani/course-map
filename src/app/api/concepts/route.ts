import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireCourseOwner } from "@/lib/auth";
import type { CreateConceptInput } from "@/lib/types/database";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");

  if (!courseId) {
    return NextResponse.json({ error: "course_id is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const [{ data: concepts, error: cErr }, { data: edges, error: eErr }] =
    await Promise.all([
      supabase.from("concepts").select("*").eq("course_id", courseId).order("name"),
      supabase.from("concept_edges").select("*").eq("course_id", courseId),
    ]);

  if (cErr || eErr) {
    return NextResponse.json(
      { error: cErr?.message || eErr?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ concepts: concepts ?? [], edges: edges ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateConceptInput & { course_id: string };

  if (!body.course_id) {
    return NextResponse.json({ error: "course_id is required" }, { status: 400 });
  }

  const auth = await requireCourseOwner(body.course_id);
  if (auth instanceof NextResponse) return auth;

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("concepts")
    .insert({
      course_id: body.course_id,
      name: body.name.trim(),
      description: body.description?.trim() ?? "",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
