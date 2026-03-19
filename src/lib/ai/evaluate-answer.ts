import { generateText, Output } from "ai";
import { z } from "zod";
import { model } from "./client";
import type { Question } from "@/lib/types/database";

const feedbackSchema = z.object({
  feedback: z.string(),
});

const freeResponseSchema = z.object({
  is_correct: z.boolean(),
  feedback: z.string(),
});

export async function evaluateAnswer(
  question: Question,
  studentAnswer: string,
  courseName: string = "this course"
): Promise<{ isCorrect: boolean; feedback: string }> {
  if (question.question_type === "multiple_choice") {
    const isCorrect =
      studentAnswer.trim().toUpperCase() ===
      question.correct_answer.trim().toUpperCase();

    const { output } = await generateText({
      model,
      output: Output.object({ schema: feedbackSchema }),
      prompt: `You are grading a student's answer to a "${courseName}" exam question.

Question: ${question.question_text}
Options: ${JSON.stringify(question.options)}
Correct answer: ${question.correct_answer}
Student's answer: ${studentAnswer}
The student was ${isCorrect ? "CORRECT" : "INCORRECT"}.

Provide 2-3 sentences of feedback explaining why the correct answer is right${!isCorrect ? " and why the student's choice was wrong" : ""}. Be encouraging and educational.
Use LaTeX notation with $...$ for inline math and $$...$$ for display math in your feedback.`,
    });

    if (!output) {
      throw new Error("Failed to evaluate answer: no output from model");
    }

    return { isCorrect, feedback: output.feedback };
  }

  // Free response: Claude evaluates both correctness and feedback
  const { output } = await generateText({
    model,
    output: Output.object({ schema: freeResponseSchema }),
    prompt: `You are grading a student's answer to a "${courseName}" exam question.

Question: ${question.question_text}
Correct answer: ${question.correct_answer}
Explanation: ${question.explanation}
Student's answer: ${studentAnswer}

Evaluate the student's answer. Consider partial correctness — if the student demonstrates understanding of the core concepts but misses details, that can still be considered correct.

Provide 2-4 sentences of feedback explaining what was right/wrong and teaching the concept.
Use LaTeX notation with $...$ for inline math and $$...$$ for display math in your feedback.`,
  });

  if (!output) {
    throw new Error("Failed to evaluate answer: no output from model");
  }

  return { isCorrect: output.is_correct, feedback: output.feedback };
}
