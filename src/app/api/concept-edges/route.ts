import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { wouldCreateCycle } from "@/lib/graph/cycle-detection";
import type { CreateEdgeInput } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const body = (await request.json()) as CreateEdgeInput & { course_id: string };

  if (!body.source_id || !body.target_id) {
    return NextResponse.json(
      { error: "source_id and target_id are required" },
      { status: 400 }
    );
  }

  if (!body.course_id) {
    return NextResponse.json(
      { error: "course_id is required" },
      { status: 400 }
    );
  }

  if (body.source_id === body.target_id) {
    return NextResponse.json(
      { error: "Cannot create self-loop" },
      { status: 400 }
    );
  }

  // Fetch existing edges for cycle detection (scoped to course)
  const { data: existingEdges, error: fetchErr } = await supabase
    .from("concept_edges")
    .select("*")
    .eq("course_id", body.course_id);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (wouldCreateCycle(existingEdges ?? [], body.source_id, body.target_id)) {
    return NextResponse.json(
      { error: "Adding this edge would create a cycle" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("concept_edges")
    .insert({
      course_id: body.course_id,
      source_id: body.source_id,
      target_id: body.target_id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("concept_edges").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
