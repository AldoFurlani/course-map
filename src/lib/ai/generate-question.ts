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

/**
 * Retrieve chunk text for a concept via direct concept_chunks mapping.
 * Returns null if no mappings exist (caller should fall back to semantic RAG).
 */
async function getLinkedChunks(conceptId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data: links, error } = await supabase
    .from("concept_chunks")
    .select("chunk_id")
    .eq("concept_id", conceptId);

  if (error || !links || links.length === 0) return null;

  const chunkIds = links.map((l) => l.chunk_id);
  const { data: chunks } = await supabase
    .from("course_material_chunks")
    .select("chunk_text, chunk_index")
    .in("id", chunkIds)
    .order("chunk_index")
    .limit(6);

  if (!chunks || chunks.length === 0) return null;

  return chunks.map((c) => c.chunk_text).join("\n\n---\n\n");
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

  // Try direct concept-chunk mappings first, fall back to semantic RAG
  let ragContext = "";
  let usedDirectMapping = false;

  const linkedContext = await getLinkedChunks(conceptId);
  if (linkedContext) {
    ragContext = linkedContext;
    usedDirectMapping = true;
  } else {
    try {
      const queryText = `${typedConcept.name}: ${typedConcept.description}`;
      const embedding = await embedText(queryText);
      const chunks = await retrieveChunks(embedding, 3, 0.7);
      ragContext = buildContext(chunks);
    } catch (err) {
      console.error("RAG retrieval failed:", err);
    }
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

  // Use a stronger constraint when we have direct mappings
  const contextSection = ragContext
    ? usedDirectMapping
      ? `\nThe following is the course material covering this concept. Only ask about topics that are substantively covered in this material — if something is only briefly mentioned or referenced in passing, do not make it the focus of a question. You may use your own examples and scenarios to test the concepts, rather than reusing the specific examples from the material.\n\n${ragContext}\n`
      : `\nUse the following course material as reference:\n${ragContext}\n`
    : "";

  const prompt = `You are an ML1 (Machine Learning 1) exam question generator. Generate a ${difficulty} ${typeLabel} question about "${typedConcept.name}".
${contextSection}
Concept description: ${typedConcept.description}
${avoidSection}
${questionType === "multiple_choice" ? "Provide exactly 4 options labeled A, B, C, D. The correct_answer should be the letter only." : "Set options to null. The correct_answer should be the full answer text."}

IMPORTANT — Math formatting: Use LaTeX notation with dollar-sign delimiters for ALL mathematical expressions. Use $...$ for inline math (variables, short expressions) and $$...$$ for display math (equations on their own line). Examples:
- Inline: "the gradient $\\nabla f(x)$ at step $t$"
- Display: "$$\\eta_t = \\frac{1}{1 + \\sum_j |g_{t,j}|}$$"
Never write bare math symbols like η_t or Σ_j — always wrap them in dollar signs.`;

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
