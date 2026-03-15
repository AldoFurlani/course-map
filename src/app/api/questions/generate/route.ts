import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuestion } from "@/lib/ai/generate-question";
import { RateLimitError } from "@/lib/rate-limit";
import type { QuestionType, Difficulty } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const conceptId = body.concept_id as string;
  const questionType = (body.question_type ?? "multiple_choice") as QuestionType;
  const difficulty = (body.difficulty ?? "medium") as Difficulty;

  if (!conceptId) {
    return NextResponse.json(
      { error: "concept_id is required" },
      { status: 400 }
    );
  }

  try {
    const question = await generateQuestion(
      conceptId,
      questionType,
      difficulty,
      user.id
    );
    return NextResponse.json(question, { status: 201 });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
