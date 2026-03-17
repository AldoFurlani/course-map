"use client";

import { useState, useEffect } from "react";
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
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Send,
  RotateCcw,
  ArrowRight,
  FileUp,
  FileText,
  X,
} from "lucide-react";
import MathText from "@/components/ui/math-text";
import type {
  Concept,
  Question,
  QuestionType,
  Difficulty,
  MCOption,
  ReadinessScore,
} from "@/lib/types/database";

type PracticeMode = "generate" | "bank";

type State =
  | "select"
  | "generating"
  | "answering"
  | "evaluating"
  | "feedback"
  | "self_assess";

interface CuratedQuestion extends Question {
  answered: boolean;
  concepts?: { name: string } | null;
}

interface FeedbackData {
  response_id: string;
  is_correct: boolean;
  feedback: string;
  correct_answer: string;
  explanation: string;
}

interface Props {
  concepts: Pick<Concept, "id" | "name">[];
  initialConcept?: string;
}

export default function PracticeSession({ concepts, initialConcept }: Props) {
  const [mode, setMode] = useState<PracticeMode>("generate");
  const [state, setState] = useState<State>("select");
  const [conceptId, setConceptId] = useState(initialConcept ?? "");
  const [bankConceptId, setBankConceptId] = useState("all");
  const [curatedQuestions, setCuratedQuestions] = useState<CuratedQuestion[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [bankExpandedId, setBankExpandedId] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState<QuestionType>("multiple_choice");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  // Restore saved preferences after hydration to avoid SSR mismatch
  useEffect(() => {
    const savedType = localStorage.getItem("practice_questionType");
    if (savedType === "multiple_choice" || savedType === "free_response") {
      setQuestionType(savedType);
    }
    const savedDiff = localStorage.getItem("practice_difficulty");
    if (savedDiff === "easy" || savedDiff === "medium" || savedDiff === "hard") {
      setDifficulty(savedDiff);
    }
  }, []);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.setItem("practice_questionType", questionType);
  }, [questionType]);

  useEffect(() => {
    localStorage.setItem("practice_difficulty", difficulty);
  }, [difficulty]);

  useEffect(() => {
    if (mode !== "bank") return;
    setLoadingBank(true);
    const params = new URLSearchParams();
    if (bankConceptId !== "all") {
      const resolvedId = concepts.find((c) => c.name === bankConceptId)?.id;
      if (resolvedId) params.set("concept_id", resolvedId);
    }
    fetch(`/api/questions/curated?${params}`)
      .then((res) => res.json())
      .then((data) => setCuratedQuestions(data.questions ?? []))
      .finally(() => setLoadingBank(false));
  }, [mode, bankConceptId]);

  function handleStartCurated(q: CuratedQuestion) {
    setConceptId(concepts.find((c) => c.id === q.concept_id)?.name ?? "");
    setQuestion(q);
    setAnswer("");
    setFeedbackData(null);
    setReadiness(null);
    setError("");
    setState("answering");
  }

  async function handleGenerate() {
    setError("");
    setState("generating");

    const resolvedId = concepts.find((c) => c.name === conceptId)?.id;
    if (!resolvedId) {
      setError("Could not resolve concept");
      setState("select");
      return;
    }

    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept_id: resolvedId,
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

  async function handlePdfUpload(file: File) {
    setPdfFile(file);
    setPdfParsing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-pdf", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to parse PDF");
      }

      const { text } = await res.json();
      setAnswer(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse PDF");
      setPdfFile(null);
    } finally {
      setPdfParsing(false);
    }
  }

  function handleRemovePdf() {
    setPdfFile(null);
    setAnswer("");
  }

  function handlePracticeAnother() {
    setQuestion(null);
    setAnswer("");
    setPdfFile(null);
    setFeedbackData(null);
    setReadiness(null);
    setError("");
    setState("select");
  }

  function handlePracticeAgain() {
    // Same concept, generate another question
    setQuestion(null);
    setAnswer("");
    setPdfFile(null);
    setFeedbackData(null);
    setReadiness(null);
    setError("");
    handleGenerate();
  }

  const conceptName = conceptId || "Unknown";

  const selfAssessLabels = [
    { value: 1, label: "Lost", desc: "I don\u2019t understand this at all" },
    { value: 2, label: "Shaky", desc: "I have a vague idea" },
    { value: 3, label: "Getting there", desc: "I understand the basics" },
    { value: 4, label: "Solid", desc: "I could explain this to someone" },
    { value: 5, label: "Confident", desc: "I fully understand this" },
  ];

  const readinessPercent = readiness
    ? Math.round(readiness.raw_score * 100)
    : 0;
  const readinessColor =
    readinessPercent >= 70
      ? "bg-success"
      : readinessPercent >= 40
        ? "bg-warning"
        : "bg-destructive";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* ─── SELECT STATE: Setup / Bank ─── */}
      {state === "select" && (
        <>
          {/* Header — contextual, not generic */}
          <div className="space-y-2 text-center pt-4">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {mode === "generate" ? "Generate a Question" : "Question Bank"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "generate"
                ? "Use AI-generated questions to practice"
                : "Browse professor-curated questions to practice"}
            </p>
          </div>

          {/* Mode Toggle — centered */}
          <div className="flex justify-center gap-2">
            <Button
              variant={mode === "generate" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("generate")}
            >
              Generate
            </Button>
            <Button
              variant={mode === "bank" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("bank")}
            >
              Question Bank
            </Button>
          </div>

          {/* Generate Mode — Configuration */}
          {mode === "generate" && (
            <Card>
              <CardContent className="pt-8 pb-8 space-y-6">
                {/* Concept selector — centered, wide */}
                <div className="mx-auto max-w-md space-y-2">
                  <Label className="text-sm font-medium block text-center">Concept</Label>
                  <Select
                    value={conceptId}
                    onValueChange={(val) => setConceptId(val ?? "")}
                  >
                    <SelectTrigger className="!w-full !h-14 text-base px-4">
                      <SelectValue placeholder="Select a concept..." />
                    </SelectTrigger>
                    <SelectContent className="min-w-[28rem]" alignItemWithTrigger={false}>
                      {concepts.map((c) => (
                        <SelectItem key={c.id} value={c.name} className="text-base py-2.5">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Type + Difficulty — centered, stacked */}
                <div className="mx-auto max-w-md space-y-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium block text-center">Question Type</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className={`rounded-xl border px-4 py-3.5 text-center text-sm font-medium transition-all ${
                          questionType === "multiple_choice"
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/60 hover:border-border hover:bg-muted/30"
                        }`}
                        onClick={() => setQuestionType("multiple_choice")}
                      >
                        Multiple Choice
                      </button>
                      <button
                        className={`rounded-xl border px-4 py-3.5 text-center text-sm font-medium transition-all ${
                          questionType === "free_response"
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/60 hover:border-border hover:bg-muted/30"
                        }`}
                        onClick={() => setQuestionType("free_response")}
                      >
                        Free Response
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium block text-center">Difficulty</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                        <button
                          key={d}
                          className={`rounded-xl border py-3.5 text-center text-sm font-medium capitalize transition-all ${
                            difficulty === d
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border/60 hover:border-border hover:bg-muted/30"
                          }`}
                          onClick={() => setDifficulty(d)}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {error && <p className="text-center text-sm text-destructive">{error}</p>}

                <div className="mx-auto max-w-md">
                  <Button
                    className="w-full h-14 text-base"
                    onClick={handleGenerate}
                    disabled={!conceptId}
                  >
                    Generate Question
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Question Bank Mode */}
          {mode === "bank" && (
            <Card>
              <CardContent className="pt-8 pb-8 space-y-5">
                <div className="mx-auto max-w-md space-y-2">
                  <Label className="text-sm font-medium block text-center">Filter by Concept</Label>
                  <Select
                    value={bankConceptId}
                    onValueChange={(val) => setBankConceptId(val ?? "all")}
                  >
                    <SelectTrigger className="!w-full !h-14 text-base px-4">
                      <SelectValue placeholder="All concepts" />
                    </SelectTrigger>
                    <SelectContent className="min-w-[28rem]" alignItemWithTrigger={false}>
                      <SelectItem value="all" className="text-base py-2.5">All concepts</SelectItem>
                      {concepts.map((c) => (
                        <SelectItem key={c.id} value={c.name} className="text-base py-2.5">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {loadingBank ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="mr-2 size-5 animate-spin text-primary" />
                    <span>Loading questions...</span>
                  </div>
                ) : curatedQuestions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No curated questions available yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {curatedQuestions.length} question
                      {curatedQuestions.length !== 1 ? "s" : ""}
                    </p>
                    {curatedQuestions.map((q) => {
                      const isExpanded = bankExpandedId === q.id;
                      return (
                        <div
                          key={q.id}
                          className={`rounded-xl border text-sm ${
                            q.answered
                              ? "border-success/30 bg-success/5"
                              : ""
                          }`}
                        >
                          <button
                            className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                            onClick={() =>
                              setBankExpandedId(isExpanded ? null : q.id)
                            }
                          >
                            <div className="flex items-center gap-2">
                              {q.answered && (
                                <CheckCircle2 className="size-4 text-success" />
                              )}
                              <span className="font-medium">
                                {q.concepts?.name ?? "Unknown"}
                              </span>
                              <span className="text-muted-foreground">
                                &middot; {q.difficulty} &middot;{" "}
                                {q.question_type === "multiple_choice"
                                  ? "MC"
                                  : "Free Response"}
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="size-4" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="border-t px-4 py-4 space-y-3">
                              <p className="leading-relaxed">
                                <MathText text={q.question_text} />
                              </p>
                              <Button onClick={() => handleStartCurated(q)}>
                                {q.answered ? "Try Again" : "Answer This Question"}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ─── GENERATING ─── */}
      {state === "generating" && (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="size-8 animate-spin text-primary" />
          <div className="text-center">
            <p className="font-serif text-xl font-semibold tracking-tight">
              Generating question&hellip;
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{conceptName}</p>
          </div>
        </div>
      )}

      {/* ─── ANSWERING ─── */}
      {state === "answering" && question && (
        <div className="space-y-6">
          {/* Question */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                {conceptName}
              </span>
              <span>&middot;</span>
              <span className="capitalize">{question.difficulty}</span>
              <span>&middot;</span>
              <span>
                {question.question_type === "multiple_choice"
                  ? "Multiple Choice"
                  : "Free Response"}
              </span>
            </div>

            <div className="text-base leading-[1.8] sm:text-[17px]">
              <MathText text={question.question_text} />
            </div>
          </div>

          {/* Answer area — generous sizing */}
          <Card>
            <CardContent className="pt-8 pb-8 space-y-5">
              {question.question_type === "multiple_choice" &&
                question.options && (
                  <div className="space-y-3">
                    {(question.options as MCOption[]).map((opt) => {
                      const isSelected = answer === opt.label;
                      return (
                        <button
                          key={opt.label}
                          className={`group flex w-full items-start gap-4 rounded-xl border px-5 py-4 text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border/60 hover:border-border hover:bg-muted/30"
                          }`}
                          onClick={() => setAnswer(opt.label)}
                        >
                          <span
                            className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground group-hover:border-foreground/30"
                            }`}
                          >
                            {opt.label}
                          </span>
                          <span className="text-[15px] leading-relaxed pt-0.5">
                            <MathText text={opt.text} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

              {question.question_type === "free_response" && (
                <div className="space-y-3">
                  <textarea
                    className="min-h-[16rem] w-full resize-y rounded-xl border border-input bg-transparent px-5 py-4 text-[15px] leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Write your answer here or upload a PDF..."
                    value={answer}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      if (pdfFile) setPdfFile(null);
                    }}
                    autoFocus
                  />

                  {/* PDF upload */}
                  {pdfFile ? (
                    <div className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3">
                      <FileText className="size-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {pdfFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pdfParsing
                            ? "Extracting text..."
                            : `${answer.length.toLocaleString()} characters extracted`}
                        </p>
                      </div>
                      {pdfParsing ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      ) : (
                        <button
                          onClick={handleRemovePdf}
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <label className="group flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                      <FileUp className="size-4" />
                      <span>Upload PDF answer</span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePdfUpload(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                className="w-full h-12 text-base"
                onClick={handleSubmitAnswer}
                disabled={!answer.trim()}
              >
                <Send className="mr-2 size-4" />
                Submit Answer
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── EVALUATING ─── */}
      {state === "evaluating" && (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="font-serif text-xl font-semibold tracking-tight">
            Evaluating your answer&hellip;
          </p>
        </div>
      )}

      {/* ─── FEEDBACK + SELF-ASSESSMENT ─── */}
      {state === "feedback" && feedbackData && question && (
        <div className="space-y-6">
          {/* Result banner — centered, prominent */}
          <div className="flex flex-col items-center gap-3 pt-4">
            <div
              className={`flex size-14 items-center justify-center rounded-full ${
                feedbackData.is_correct
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {feedbackData.is_correct ? (
                <CheckCircle2 className="size-7" />
              ) : (
                <XCircle className="size-7" />
              )}
            </div>
            <div className="text-center">
              <p className="font-serif text-2xl font-semibold tracking-tight">
                {feedbackData.is_correct ? "Correct!" : "Not quite right"}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {conceptName} &middot;{" "}
                <span className="capitalize">{question.difficulty}</span>
              </p>
            </div>
          </div>

          {/* Answer comparison + Explanation */}
          <Card>
            <CardContent className="pt-8 pb-8 space-y-0 divide-y divide-border">
              {/* Your answer */}
              <div className="pb-5">
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Your answer
                </p>
                <div className="text-[15px] leading-relaxed">
                  {question.question_type === "multiple_choice"
                    ? <><span className="font-medium">{answer}.</span> <MathText text={(question.options as MCOption[])?.find((o) => o.label === answer)?.text ?? ""} /></>
                    : <MathText text={answer} />}
                </div>
              </div>

              {/* Correct answer (when wrong) */}
              {!feedbackData.is_correct && (
                <div className="py-5">
                  <p className="mb-2 text-xs font-medium tracking-wide text-success uppercase">
                    Correct answer
                  </p>
                  <div className="text-[15px] leading-relaxed">
                    {question.question_type === "multiple_choice"
                      ? <><span className="font-medium">{feedbackData.correct_answer}.</span> <MathText text={(question.options as MCOption[])?.find((o) => o.label === feedbackData.correct_answer)?.text ?? ""} /></>
                      : <MathText text={feedbackData.correct_answer} />}
                  </div>
                </div>
              )}

              {/* Feedback */}
              <div className="py-5">
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Feedback
                </p>
                <div className="text-[15px] leading-relaxed">
                  <MathText text={feedbackData.feedback} />
                </div>
              </div>

              {/* Explanation */}
              <div className="pt-5">
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Explanation
                </p>
                <div className="text-[15px] leading-relaxed">
                  <MathText text={feedbackData.explanation} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Self-assessment */}
          <Card>
            <CardContent className="pt-8 pb-8 space-y-5">
              <div className="text-center">
                <p className="font-serif text-xl font-semibold tracking-tight">
                  How well do you understand this now?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your self-assessment helps calibrate your readiness score
                </p>
              </div>

              <div className="grid grid-cols-5 gap-2.5">
                {selfAssessLabels.map(({ value, label, desc }) => (
                  <button
                    key={value}
                    onClick={() => handleSelfAssess(value)}
                    className="group flex flex-col items-center gap-2 rounded-xl border border-border/60 px-2 py-4 text-center transition-all hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="text-2xl font-semibold font-mono text-foreground group-hover:text-primary transition-colors">
                      {value}
                    </span>
                    <span className="text-xs font-medium leading-tight">
                      {label}
                    </span>
                    <span className="hidden text-[10px] leading-tight text-muted-foreground sm:block">
                      {desc}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── READINESS RESULT ─── */}
      {state === "self_assess" && (
        <div className="space-y-6">
          {readiness ? (
            <>
              <div className="flex flex-col items-center gap-4 pt-8">
                <p className="text-sm font-medium text-muted-foreground">
                  Readiness for {conceptName}
                </p>
                <p className="text-6xl font-semibold font-mono tracking-tight">
                  {readinessPercent}%
                </p>

                {/* Progress bar */}
                <div className="w-full max-w-sm">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${readinessColor}`}
                      style={{ width: `${readinessPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Based on {readiness.response_count} response
                    {readiness.response_count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                <Button className="h-11" onClick={handlePracticeAgain}>
                  <RotateCcw className="mr-2 size-4" />
                  Practice Again
                </Button>
                <Button
                  className="h-11"
                  variant="outline"
                  onClick={handlePracticeAnother}
                >
                  Change Concept
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <Loader2 className="size-8 animate-spin text-primary" />
              <span>Saving&hellip;</span>
            </div>
          )}

          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
