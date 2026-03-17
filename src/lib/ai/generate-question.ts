import { generateText, Output } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { retrieveChunks } from "@/lib/rag/retriever";
import { getConceptEmbedding } from "@/lib/rag/embed";
import { checkRateLimit } from "@/lib/rate-limit";
import { model } from "./client";
import type {
  Question,
  QuestionType,
  Difficulty,
  Concept,
  MatchedChunk,
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

/**
 * Build context string from chunks, ordered by source position.
 */
function buildOrderedContext(chunks: MatchedChunk[]): string {
  if (chunks.length === 0) return "";

  // Sort by material then chunk_index so the LLM sees content in reading order
  const sorted = [...chunks].sort((a, b) => {
    if (a.material_id !== b.material_id) {
      return a.material_id.localeCompare(b.material_id);
    }
    return a.chunk_index - b.chunk_index;
  });

  return sorted.map((c) => c.chunk_text).join("\n\n---\n\n");
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

  // Semantic search for relevant chunks (uses cached embedding if available)
  let ragContext = "";
  let retrievedChunks: MatchedChunk[] = [];
  let usedCachedEmbedding = false;

  try {
    usedCachedEmbedding = !!typedConcept.cached_embedding;
    const embedding = await getConceptEmbedding(typedConcept);
    const rawChunks = await retrieveChunks(embedding, 12, 0.5);
    retrievedChunks = rawChunks.filter((c) => c.chunk_text.length >= 150).slice(0, 6);
    ragContext = buildOrderedContext(retrievedChunks);
  } catch (err) {
    console.error("Semantic search failed:", err);
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
      ? `\nDo NOT ask about the same topic as any of these previously generated questions. Cover a DIFFERENT subtopic or angle:\n${recentQuestions.map((q, i) => {
          // Truncate to first sentence or 150 chars to reduce token usage
          const text = q.question_text;
          const firstSentence = text.match(/^[^.!?]*[.!?]/)?.[0];
          const summary = firstSentence && firstSentence.length > 30
            ? firstSentence
            : text.slice(0, 150);
          return `${i + 1}. ${summary}`;
        }).join("\n")}\n`
      : "";

  // Build prompt
  const typeLabel =
    questionType === "multiple_choice" ? "multiple choice" : "free response";

  const contextSection = ragContext
    ? `\nThe following is the course material covering this concept. Only ask about topics that are substantively covered in this material — if something is only briefly mentioned or referenced in passing, do not make it the focus of a question. You may use your own examples and scenarios to test the concepts, rather than reusing the specific examples from the material.\n\n${ragContext}\n`
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

  // Log the full prompt and retrieval details
  console.log("\n========== QUESTION GENERATION ==========");
  console.log(`Concept: ${typedConcept.name} (${conceptId})`);
  console.log(`Type: ${typeLabel} | Difficulty: ${difficulty}`);
  console.log(`Embedding: ${usedCachedEmbedding ? "CACHED" : "computed"} | Chunks: ${retrievedChunks.length}`);
  if (retrievedChunks.length > 0) {
    retrievedChunks.forEach((c, i) => {
      console.log(
        `  Chunk ${i + 1}: similarity=${c.similarity.toFixed(3)} page=${c.page_number ?? "?"} index=${c.chunk_index} (${c.chunk_text.slice(0, 80)}...)`
      );
    });
  }
  console.log(`\n--- FULL PROMPT ---\n${prompt}`);
  console.log("==========================================\n");

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
      console.log(
        `[VERIFY] Answer corrected: ${output.correct_answer} → ${verification.correct_answer}`
      );
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
