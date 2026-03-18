"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  Star,
  Bookmark,
} from "lucide-react";
import type { MCOption } from "@/lib/types/database";
import MathText from "@/components/ui/math-text";

interface ResponseEntry {
  id: string;
  concept_id: string;
  concept_name: string;
  answer_text: string;
  is_correct: boolean;
  ai_feedback: string;
  self_assessment: number | null;
  favorited: boolean;
  created_at: string;
  question: {
    id: string;
    question_text: string;
    question_type: string;
    difficulty: string;
    options: MCOption[] | null;
    correct_answer: string;
    explanation: string;
  } | null;
}

interface Props {
  concepts: { id: string; name: string }[];
  courseId: string;
}

const PAGE_SIZE = 20;

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return (
    <Badge variant="outline" className="text-[11px] capitalize">
      {difficulty}
    </Badge>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="secondary" className="text-[11px]">
      {type === "multiple_choice" ? "MC" : "Free Response"}
    </Badge>
  );
}

function SelfAssessmentDots({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`size-3.5 ${
            i <= value
              ? "fill-warning text-warning"
              : "text-muted-foreground/30"
          }`}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

export default function QuestionHistory({ concepts, courseId }: Props) {
  const [responses, setResponses] = useState<ResponseEntry[]>([]);
  const [filterConcept, setFilterConcept] = useState("all");
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchResponses = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (filterConcept !== "all") {
        const resolvedId = concepts.find((c) => c.name === filterConcept)?.id;
        if (resolvedId) params.set("concept_id", resolvedId);
      }
      if (filterFavorites) {
        params.set("favorited", "true");
      }
      params.set("course_id", courseId);

      const res = await fetch(`/api/responses?${params}`);
      if (!res.ok) return;

      const data = await res.json();
      if (append) {
        setResponses((prev) => [...prev, ...data.responses]);
      } else {
        setResponses(data.responses);
      }
      setHasMore(data.has_more);
    },
    [filterConcept, filterFavorites, concepts, courseId]
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setExpandedId(null);
      setLoading(true);
      try {
        await fetchResponses(0, false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [fetchResponses]);

  async function handleLoadMore() {
    setLoadingMore(true);
    await fetchResponses(responses.length, true);
    setLoadingMore(false);
  }

  async function handleToggleFavorite(responseId: string, currentValue: boolean) {
    const res = await fetch(`/api/responses/${responseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorited: !currentValue }),
    });
    if (!res.ok) return;

    setResponses((prev) =>
      prev.map((r) =>
        r.id === responseId ? { ...r, favorited: !currentValue } : r
      )
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filterConcept}
            onValueChange={(val) => setFilterConcept(val ?? "all")}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All concepts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All concepts</SelectItem>
              {concepts.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={filterFavorites ? "default" : "outline"}
            size="default"
            onClick={() => setFilterFavorites((v) => !v)}
          >
            <Bookmark
              className={`mr-1.5 size-3.5 ${filterFavorites ? "fill-current" : ""}`}
            />
            Favorites
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {responses.length} response{responses.length !== 1 ? "s" : ""} shown
        </p>
      </div>

      {/* Responses */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="mr-2 size-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading history...</span>
        </div>
      ) : responses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {filterFavorites ? (
            <>
              <Bookmark className="size-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">
                No favorited questions yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Bookmark questions from your history to find them here.
              </p>
            </>
          ) : (
            <>
              <History className="size-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">
                No practice history yet. Head to Practice to get started!
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {responses.map((r, idx) => {
            const isExpanded = expandedId === r.id;
            return (
              <div
                key={r.id}
                className={`rounded-xl ring-1 ring-foreground/10 overflow-hidden border-l-[3px] transition-colors ${
                  r.is_correct
                    ? "border-l-success"
                    : "border-l-destructive"
                }`}
                style={{
                  animation: `auth-field-enter 0.3s ease-out ${idx * 30}ms both`,
                }}
              >
                {/* Collapsed header */}
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {r.is_correct ? (
                      <CheckCircle2 className="size-4 text-success shrink-0" />
                    ) : (
                      <XCircle className="size-4 text-destructive shrink-0" />
                    )}
                    <span className="font-medium text-sm truncate">
                      {r.concept_name}
                    </span>
                    {r.question && (
                      <div className="hidden sm:flex items-center gap-1.5">
                        <TypeBadge type={r.question.question_type} />
                        <DifficultyBadge difficulty={r.question.difficulty} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Favorite toggle */}
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(r.id, r.favorited);
                      }}
                      title={r.favorited ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Bookmark
                        className={`size-3.5 ${
                          r.favorited
                            ? "fill-primary text-primary"
                            : ""
                        }`}
                        strokeWidth={1.5}
                      />
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && r.question && (
                  <div className="border-t border-border px-4 py-4 space-y-4 text-sm">
                    {/* Mobile badges */}
                    <div className="flex sm:hidden items-center gap-1.5">
                      <TypeBadge type={r.question.question_type} />
                      <DifficultyBadge difficulty={r.question.difficulty} />
                    </div>

                    {/* Question */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        Question
                      </p>
                      <MathText text={r.question.question_text} />
                    </div>

                    {/* MC options */}
                    {r.question.options && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                          Options
                        </p>
                        <div className="space-y-1">
                          {(r.question.options as MCOption[]).map((opt) => {
                            const isCorrectOpt =
                              opt.label === r.question!.correct_answer;
                            const isUserAnswer = opt.label === r.answer_text;
                            return (
                              <div
                                key={opt.label}
                                className={`flex items-start gap-2 rounded-lg px-3 py-1.5 ${
                                  isCorrectOpt
                                    ? "bg-success/8"
                                    : isUserAnswer && !r.is_correct
                                      ? "bg-destructive/8"
                                      : ""
                                }`}
                              >
                                <span
                                  className={`font-mono text-xs mt-0.5 shrink-0 ${
                                    isCorrectOpt
                                      ? "text-success font-semibold"
                                      : isUserAnswer && !r.is_correct
                                        ? "text-destructive font-semibold"
                                        : "text-muted-foreground"
                                  }`}
                                >
                                  {opt.label}
                                </span>
                                <MathText text={opt.text} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Answer comparison (free response) */}
                    {!r.question.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Your Answer
                          </p>
                          <MathText text={r.answer_text} />
                        </div>
                        <div className="rounded-lg bg-success/8 px-3 py-2.5">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Correct Answer
                          </p>
                          <MathText text={r.question.correct_answer} />
                        </div>
                      </div>
                    )}

                    {/* Feedback & explanation */}
                    <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-3">
                      {r.ai_feedback && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Feedback
                          </p>
                          <MathText text={r.ai_feedback} />
                        </div>
                      )}
                      {r.question.explanation && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Explanation
                          </p>
                          <MathText text={r.question.explanation} />
                        </div>
                      )}
                    </div>

                    {/* Self assessment */}
                    {r.self_assessment != null && (
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Self Assessment
                        </p>
                        <SelfAssessmentDots value={r.self_assessment} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {hasMore && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
