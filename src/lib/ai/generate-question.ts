import { generateText, Output } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { retrieveChunks, buildContext } from "@/lib/rag/retriever";
import { model } from "./client";
import type {
  Question,
  QuestionType,
  Difficulty,
  Concept,
} from "@/lib/types/database";

const RATE_LIMIT_PER_HOUR = 10;

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
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("generated_by", userId)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    throw new Error(
      "Rate limit exceeded. You can generate up to 10 questions per hour."
    );
  }

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

  // Build prompt
  const typeLabel =
    questionType === "multiple_choice" ? "multiple choice" : "free response";

  const contextSection = ragContext
    ? `\nUse the following course material as reference:\n${ragContext}\n`
    : "";

  const prompt = `You are an ML1 (Machine Learning 1) exam question generator. Generate a ${difficulty} ${typeLabel} question about "${typedConcept.name}".
${contextSection}
Concept description: ${typedConcept.description}

${questionType === "multiple_choice" ? "Provide exactly 4 options labeled A, B, C, D. The correct_answer should be the letter only." : "Set options to null. The correct_answer should be the full answer text."}`;

  const { output } = await generateText({
    model,
    prompt,
    output: Output.object({ schema: questionSchema }),
  });

  if (!output) {
    throw new Error("Failed to generate question: no output from model");
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
