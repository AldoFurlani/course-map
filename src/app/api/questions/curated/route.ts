import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conceptId = searchParams.get("concept_id");

  let query = supabase
    .from("questions")
    .select("*, concepts(name)")
    .eq("curated", true)
    .order("concept_id")
    .order("difficulty");

  if (conceptId) {
    query = query.eq("concept_id", conceptId);
  }

  const { data: questions, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Check which questions this student has already answered
  const questionIds = (questions ?? []).map((q) => q.id);
  const { data: responses } =
    questionIds.length > 0
      ? await supabase
          .from("student_responses")
          .select("question_id")
          .eq("student_id", user.id)
          .in("question_id", questionIds)
      : { data: [] };

  const answeredIds = new Set((responses ?? []).map((r) => r.question_id));

  return NextResponse.json({
    questions: (questions ?? []).map((q) => ({
      ...q,
      answered: answeredIds.has(q.id),
    })),
  });
}
