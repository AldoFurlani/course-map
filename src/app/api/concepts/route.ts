import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireProfessor } from "@/lib/auth";
import type { CreateConceptInput } from "@/lib/types/database";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();

  const [{ data: concepts, error: cErr }, { data: edges, error: eErr }] =
    await Promise.all([
      supabase.from("concepts").select("*").order("name"),
      supabase.from("concept_edges").select("*"),
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
  const auth = await requireProfessor();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const body = (await request.json()) as CreateConceptInput;

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("concepts")
    .insert({ name: body.name.trim(), description: body.description?.trim() ?? "" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
