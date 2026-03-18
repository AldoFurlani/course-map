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
  const courseId = searchParams.get("course_id");
  const limit = Math.max(1, Math.min(parseInt(searchParams.get("limit") ?? "50") || 50, 100));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0") || 0);

  let query = supabase
    .from("student_responses")
    .select(
      "id, concept_id, answer_text, is_correct, ai_feedback, self_assessment, favorited, created_at, question_id"
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (courseId) {
    query = query.eq("course_id", courseId);
  }

  if (conceptId) {
    query = query.eq("concept_id", conceptId);
  }

  const favorited = searchParams.get("favorited");
  if (favorited === "true") {
    query = query.eq("favorited", true);
  }

  const { data: responses, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Fetch associated questions
  const questionIds = [
    ...new Set((responses ?? []).map((r) => r.question_id)),
  ];
  const { data: questions } =
    questionIds.length > 0
      ? await supabase
          .from("questions")
          .select(
            "id, question_text, question_type, difficulty, options, correct_answer, explanation"
          )
          .in("id", questionIds)
      : { data: [] };

  const questionMap = new Map(
    (questions ?? []).map((q) => [q.id, q])
  );

  // Fetch concept names
  const conceptIds = [
    ...new Set((responses ?? []).map((r) => r.concept_id)),
  ];
  const { data: concepts } =
    conceptIds.length > 0
      ? await supabase
          .from("concepts")
          .select("id, name")
          .in("id", conceptIds)
      : { data: [] };

  const conceptMap = new Map(
    (concepts ?? []).map((c) => [c.id, c.name])
  );

  return NextResponse.json({
    responses: (responses ?? []).map((r) => ({
      ...r,
      question: questionMap.get(r.question_id) ?? null,
      concept_name: conceptMap.get(r.concept_id) ?? "Unknown",
    })),
    has_more: (responses ?? []).length === limit,
  });
}
