import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReadinessScore, ConceptEdge } from "@/lib/types/database";

const DECAY = 0.85;
const QUIZ_WEIGHT = 0.6;
const SELF_WEIGHT = 0.4;

export function computeEWMA(prevEWMA: number, newScore: number): number {
  return DECAY * prevEWMA + (1 - DECAY) * newScore;
}

export function computeRawScore(
  quizEWMA: number,
  selfAssessmentAvg: number
): number {
  return QUIZ_WEIGHT * quizEWMA + SELF_WEIGHT * (selfAssessmentAvg / 5);
}

/**
 * Returns raw scores as-is. Prerequisites are used only for
 * navigation guidance, not for capping scores.
 */
export function computeEffectiveScores(
  rawScores: Map<string, number>,
  _edges: ConceptEdge[]
): Map<string, number> {
  return new Map(rawScores);
}

/**
 * Update readiness score after a student response + self-assessment.
 */
export async function updateReadinessAfterResponse(
  supabase: SupabaseClient,
  studentId: string,
  conceptId: string,
  courseId: string,
  isCorrect: boolean,
  selfAssessment: number
): Promise<ReadinessScore> {
  // Fetch existing readiness score
  const { data: existing } = await supabase
    .from("readiness_scores")
    .select("*")
    .eq("student_id", studentId)
    .eq("concept_id", conceptId)
    .single();

  const prevEWMA = existing?.quiz_ewma ?? 0;
  const prevSelfAvg = existing?.self_assessment_avg ?? 0;
  const prevCount = existing?.response_count ?? 0;

  // Compute new values
  const quizEWMA = computeEWMA(prevEWMA, isCorrect ? 1 : 0);
  const selfAssessmentAvg =
    (prevSelfAvg * prevCount + selfAssessment) / (prevCount + 1);
  const rawScore = computeRawScore(quizEWMA, selfAssessmentAvg);
  const responseCount = prevCount + 1;

  const { data, error } = await supabase
    .from("readiness_scores")
    .upsert(
      {
        student_id: studentId,
        concept_id: conceptId,
        course_id: courseId,
        quiz_ewma: quizEWMA,
        self_assessment_avg: selfAssessmentAvg,
        raw_score: rawScore,
        response_count: responseCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,concept_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert readiness: ${error.message}`);
  return data as ReadinessScore;
}
