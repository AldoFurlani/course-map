"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import type {
  Concept,
  Question,
  QuestionType,
  Difficulty,
  MCOption,
  ReadinessScore,
} from "@/lib/types/database";

type State =
  | "select"
  | "generating"
  | "answering"
  | "evaluating"
  | "feedback"
  | "self_assess";

interface FeedbackData {
  response_id: string;
  is_correct: boolean;
  feedback: string;
  correct_answer: string;
  explanation: string;
}

interface Props {
  concepts: Pick<Concept, "id" | "name">[];
}

export default function PracticeSession({ concepts }: Props) {
  const [state, setState] = useState<State>("select");
  const [conceptId, setConceptId] = useState("");
  const [questionType, setQuestionType] =
    useState<QuestionType>("multiple_choice");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setError("");
    setState("generating");

    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept_id: conceptId,
          question_type: questionType,
          difficulty,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate question");
      }

      const q = (await res.json()) as Question;
      setQuestion(q);
      setAnswer("");
      setState("answering");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("select");
    }
  }

  async function handleSubmitAnswer() {
    if (!question || !answer.trim()) return;
    setError("");
    setState("evaluating");

    try {
      const res = await fetch(`/api/questions/${question.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answer.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to evaluate answer");
      }

      const data = (await res.json()) as FeedbackData;
      setFeedbackData(data);
      setState("feedback");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("answering");
    }
  }

  async function handleSelfAssess(rating: number) {
    if (!question || !feedbackData) return;
    setState("self_assess");

    try {
      const res = await fetch(`/api/questions/${question.id}/self-assess`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response_id: feedbackData.response_id,
          self_assessment: rating,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save self-assessment");
      }

      const data = await res.json();
      setReadiness(data.readiness as ReadinessScore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  function handlePracticeAnother() {
    setQuestion(null);
    setAnswer("");
    setFeedbackData(null);
    setReadiness(null);
    setError("");
    setState("select");
  }

  function handlePracticeAgain() {
    // Same concept, generate another question
    setQuestion(null);
    setAnswer("");
    setFeedbackData(null);
    setReadiness(null);
    setError("");
    handleGenerate();
  }

  const conceptName =
    concepts.find((c) => c.id === conceptId)?.name ?? "Unknown";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Selection / Configuration */}
      {state === "select" && (
        <Card>
          <CardHeader>
            <CardTitle>Practice Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Concept</Label>
              <Select
                value={conceptId}
                onValueChange={(val) => setConceptId(val ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a concept..." />
                </SelectTrigger>
                <SelectContent>
                  {concepts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Question Type</Label>
              <div className="flex gap-2">
                <Button
                  variant={
                    questionType === "multiple_choice" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setQuestionType("multiple_choice")}
                >
                  Multiple Choice
                </Button>
                <Button
                  variant={
                    questionType === "free_response" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setQuestionType("free_response")}
                >
                  Free Response
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Difficulty</Label>
              <div className="flex gap-2">
                {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                  <Button
                    key={d}
                    variant={difficulty === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDifficulty(d)}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={handleGenerate} disabled={!conceptId}>
              Generate Question
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generating */}
      {state === "generating" && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            <span>Generating question about {conceptName}...</span>
          </CardContent>
        </Card>
      )}

      {/* Answering */}
      {state === "answering" && question && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{conceptName}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {question.difficulty} &middot;{" "}
              {question.question_type === "multiple_choice"
                ? "Multiple Choice"
                : "Free Response"}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-medium">{question.question_text}</p>

            {question.question_type === "multiple_choice" &&
              question.options && (
                <div className="space-y-2">
                  {(question.options as MCOption[]).map((opt) => (
                    <button
                      key={opt.label}
                      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                        answer === opt.label
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setAnswer(opt.label)}
                    >
                      <span className="font-semibold">{opt.label}.</span>
                      <span>{opt.text}</span>
                    </button>
                  ))}
                </div>
              )}

            {question.question_type === "free_response" && (
              <textarea
                className="h-32 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Type your answer..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              onClick={handleSubmitAnswer}
              disabled={!answer.trim()}
            >
              Submit Answer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Evaluating */}
      {state === "evaluating" && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            <span>Evaluating your answer...</span>
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      {state === "feedback" && feedbackData && question && (
        <Card
          className={
            feedbackData.is_correct
              ? "ring-green-500/30 ring-2"
              : "ring-red-500/30 ring-2"
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {feedbackData.is_correct ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Correct!
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Incorrect
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Your answer
              </p>
              <p className="text-sm">
                {question.question_type === "multiple_choice"
                  ? `${answer}. ${(question.options as MCOption[])?.find((o) => o.label === answer)?.text ?? ""}`
                  : answer}
              </p>
            </div>

            {!feedbackData.is_correct && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Correct answer
                </p>
                <p className="text-sm">
                  {question.question_type === "multiple_choice"
                    ? `${feedbackData.correct_answer}. ${(question.options as MCOption[])?.find((o) => o.label === feedbackData.correct_answer)?.text ?? ""}`
                    : feedbackData.correct_answer}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Feedback
              </p>
              <p className="text-sm">{feedbackData.feedback}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Explanation
              </p>
              <p className="text-sm">{feedbackData.explanation}</p>
            </div>

            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">
                How well do you understand this concept now?
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Button
                    key={n}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelfAssess(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                1 = Not at all &mdash; 5 = Very well
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Self-assessment submitted */}
      {state === "self_assess" && (
        <Card>
          <CardContent className="space-y-4 py-6">
            {readiness ? (
              <>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Readiness for {conceptName}
                  </p>
                  <p className="text-3xl font-bold">
                    {Math.round(readiness.raw_score * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Based on {readiness.response_count} response
                    {readiness.response_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex justify-center gap-3">
                  <Button onClick={handlePracticeAgain}>
                    Practice Again
                  </Button>
                  <Button variant="outline" onClick={handlePracticeAnother}>
                    Change Concept
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span>Saving...</span>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
