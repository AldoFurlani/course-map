import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateReadinessAfterResponse } from "@/lib/graph/readiness";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _questionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const responseId = body.response_id as string;
  const selfAssessment = body.self_assessment as number;

  if (!responseId || !selfAssessment || selfAssessment < 1 || selfAssessment > 5) {
    return NextResponse.json(
      { error: "response_id and self_assessment (1-5) are required" },
      { status: 400 }
    );
  }

  // Fetch the response to get concept_id and is_correct
  const { data: response, error: fetchError } = await supabase
    .from("student_responses")
    .select("*")
    .eq("id", responseId)
    .eq("student_id", user.id)
    .single();

  if (fetchError || !response) {
    return NextResponse.json({ error: "Response not found" }, { status: 404 });
  }

  // Update self_assessment on the response
  const { error: updateError } = await supabase
    .from("student_responses")
    .update({ self_assessment: selfAssessment })
    .eq("id", responseId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  // Update readiness score
  try {
    const readiness = await updateReadinessAfterResponse(
      supabase,
      user.id,
      response.concept_id,
      response.is_correct,
      selfAssessment
    );

    return NextResponse.json({ readiness });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
