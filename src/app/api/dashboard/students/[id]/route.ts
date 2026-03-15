import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["professor", "ta"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch student info, readiness scores, and recent responses
  const [{ data: student }, { data: scores }, { data: responses }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", studentId)
        .single(),
      supabase
        .from("readiness_scores")
        .select("concept_id, raw_score, quiz_ewma, self_assessment_avg, response_count, updated_at")
        .eq("student_id", studentId),
      supabase
        .from("student_responses")
        .select("id, concept_id, answer_text, is_correct, ai_feedback, self_assessment, created_at, question_id")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Fetch question texts for the responses
  const questionIds = [
    ...new Set((responses ?? []).map((r) => r.question_id)),
  ];
  const { data: questions } = questionIds.length > 0
    ? await supabase
        .from("questions")
        .select("id, question_text, question_type, difficulty, concept_id")
        .in("id", questionIds)
    : { data: [] };

  const questionMap = new Map(
    (questions ?? []).map((q) => [q.id, q])
  );

  return NextResponse.json({
    student,
    scores: scores ?? [],
    responses: (responses ?? []).map((r) => ({
      ...r,
      question: questionMap.get(r.question_id) ?? null,
    })),
  });
}
