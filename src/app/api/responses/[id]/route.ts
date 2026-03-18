import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json();

  if (typeof body.favorited !== "boolean") {
    return NextResponse.json(
      { error: "favorited must be a boolean" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("student_responses")
    .update({ favorited: body.favorited })
    .eq("id", id)
    .eq("student_id", auth.user.id)
    .select("id, favorited")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Response not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
