import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateAnswer } from "@/lib/ai/evaluate-answer";
import type { Question } from "@/lib/types/database";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const answer = body.answer as string;

  if (!answer?.trim()) {
    return NextResponse.json(
      { error: "answer is required" },
      { status: 400 }
    );
  }

  // Fetch the question
  const { data: question, error: fetchError } = await supabase
    .from("questions")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  try {
    const { isCorrect, feedback } = await evaluateAnswer(
      question as Question,
      answer.trim()
    );

    // Insert student response (without self_assessment yet)
    const { data: response, error: insertError } = await supabase
      .from("student_responses")
      .insert({
        student_id: user.id,
        question_id: id,
        concept_id: question.concept_id,
        answer_text: answer.trim(),
        is_correct: isCorrect,
        ai_feedback: feedback,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      response_id: response.id,
      is_correct: isCorrect,
      feedback,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
