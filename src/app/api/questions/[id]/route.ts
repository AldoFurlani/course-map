import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfessor } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProfessor();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.question_text !== undefined) updates.question_text = body.question_text;
  if (body.options !== undefined) updates.options = body.options;
  if (body.correct_answer !== undefined) updates.correct_answer = body.correct_answer;
  if (body.explanation !== undefined) updates.explanation = body.explanation;
  if (body.difficulty !== undefined) updates.difficulty = body.difficulty;
  if (body.curated !== undefined) updates.curated = body.curated;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("questions")
    .update(updates)
    .eq("id", id)
    .select("*, concepts(name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProfessor();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();

  const { error } = await supabase.from("questions").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
