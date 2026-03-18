import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();

  const body = await request.json();
  const {
    concept_id,
    question_type,
    difficulty,
    question_text,
    options,
    correct_answer,
    explanation,
  } = body;

  if (!concept_id || !question_type || !difficulty || !question_text || !correct_answer || !explanation) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (question_type === "multiple_choice" && (!options || options.length !== 4)) {
    return NextResponse.json(
      { error: "Multiple choice questions require exactly 4 options" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("questions")
    .insert({
      course_id: body.course_id,
      concept_id,
      question_type,
      difficulty,
      question_text,
      options: question_type === "multiple_choice" ? options : null,
      correct_answer,
      explanation,
      generated_by: null,
    })
    .select("*, concepts(name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
