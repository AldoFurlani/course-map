import { generateText, Output } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { retrieveChunks, buildContext } from "@/lib/rag/retriever";
import { checkRateLimit } from "@/lib/rate-limit";
import { model } from "./client";
import type {
  Question,
  QuestionType,
  Difficulty,
  Concept,
} from "@/lib/types/database";

const mcOptionSchema = z.object({
  label: z.string(),
  text: z.string(),
});

const questionSchema = z.object({
  question_text: z.string(),
  options: z.array(mcOptionSchema).nullable(),
  correct_answer: z.string(),
  explanation: z.string(),
});

const verificationSchema = z.object({
  correct_answer: z.string(),
  reasoning: z.string(),
});

async function embedText(text: string): Promise<number[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [text] }),
    }
  );

  if (!res.ok) {
    throw new Error(`Embedding failed: ${res.statusText}`);
  }

  const { embeddings } = await res.json();
  return embeddings[0];
}

export async function generateQuestion(
  conceptId: string,
  questionType: QuestionType,
  difficulty: Difficulty,
  userId: string
): Promise<Question> {
  const supabase = await createClient();

  // Rate limit check
  await checkRateLimit(supabase, "questions", "generated_by", userId, 10);

  // Fetch concept
  const { data: concept, error: conceptError } = await supabase
    .from("concepts")
    .select("*")
    .eq("id", conceptId)
    .single();

  if (conceptError || !concept) {
    throw new Error("Concept not found");
  }

  const typedConcept = concept as Concept;

  // RAG: embed concept text and retrieve relevant chunks
  let ragContext = "";
  try {
    const queryText = `${typedConcept.name}: ${typedConcept.description}`;
    const embedding = await embedText(queryText);
    const chunks = await retrieveChunks(embedding, 5, 0.5);
    ragContext = buildContext(chunks);
  } catch (err) {
    console.error("RAG retrieval failed:", err);
    // Continue without RAG context
  }

  // Fetch recent questions for this concept to avoid repetition
  const { data: recentQuestions } = await supabase
    .from("questions")
    .select("question_text")
    .eq("concept_id", conceptId)
    .eq("question_type", questionType)
    .eq("difficulty", difficulty)
    .eq("generated_by", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const avoidSection =
    recentQuestions && recentQuestions.length > 0
      ? `\nDo NOT ask about the same topic as any of these previously generated questions. Cover a DIFFERENT subtopic or angle:\n${recentQuestions.map((q, i) => `${i + 1}. ${q.question_text}`).join("\n")}\n`
      : "";

  // Build prompt
  const typeLabel =
    questionType === "multiple_choice" ? "multiple choice" : "free response";

  const contextSection = ragContext
    ? `\nUse the following course material as reference:\n${ragContext}\n`
    : "";

  const prompt = `You are an ML1 (Machine Learning 1) exam question generator. Generate a ${difficulty} ${typeLabel} question about "${typedConcept.name}".
${contextSection}
Concept description: ${typedConcept.description}
${avoidSection}
${questionType === "multiple_choice" ? "Provide exactly 4 options labeled A, B, C, D. The correct_answer should be the letter only." : "Set options to null. The correct_answer should be the full answer text."}`;

  const { output } = await generateText({
    model,
    prompt,
    output: Output.object({ schema: questionSchema }),
  });

  if (!output) {
    throw new Error("Failed to generate question: no output from model");
  }

  // Verify correct answer for MC questions
  if (questionType === "multiple_choice" && output.options) {
    const optionsText = output.options
      .map((o) => `${o.label}. ${o.text}`)
      .join("\n");

    const { output: verification } = await generateText({
      model,
      prompt: `Solve this question independently. Do NOT assume the provided answer is correct. Work through it step by step, then state which option (A, B, C, or D) is correct.

Question: ${output.question_text}

${optionsText}

Return the letter of the correct answer and your reasoning.`,
      output: Output.object({ schema: verificationSchema }),
    });

    if (verification && verification.correct_answer !== output.correct_answer) {
      output.correct_answer = verification.correct_answer;
      output.explanation = verification.reasoning;
    }
  }

  // Insert into DB
  const { data: question, error: insertError } = await supabase
    .from("questions")
    .insert({
      concept_id: conceptId,
      question_type: questionType,
      difficulty,
      question_text: output.question_text,
      options: output.options,
      correct_answer: output.correct_answer,
      explanation: output.explanation,
      source_context: ragContext || null,
      generated_by: userId,
    })
    .select()
    .single();

  if (insertError || !question) {
    throw new Error(`Failed to save question: ${insertError?.message}`);
  }

  return question as Question;
}
