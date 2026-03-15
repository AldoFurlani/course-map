"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import type { MCOption } from "@/lib/types/database";

interface ResponseEntry {
  id: string;
  concept_id: string;
  concept_name: string;
  answer_text: string;
  is_correct: boolean;
  ai_feedback: string;
  self_assessment: number | null;
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
}

const PAGE_SIZE = 20;

export default function QuestionHistory({ concepts }: Props) {
  const [responses, setResponses] = useState<ResponseEntry[]>([]);
  const [filterConcept, setFilterConcept] = useState("all");
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
    [filterConcept, concepts]
  );

  useEffect(() => {
    setLoading(true);
    setExpandedId(null);
    fetchResponses(0, false).finally(() => setLoading(false));
  }, [fetchResponses]);

  async function handleLoadMore() {
    setLoadingMore(true);
    await fetchResponses(responses.length, true);
    setLoadingMore(false);
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Filter */}
      <div className="flex items-end gap-4">
        <div className="space-y-2">
          <Label>Filter by Concept</Label>
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
        </div>
        <p className="text-sm text-muted-foreground">
          {responses.length} response{responses.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Responses */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span>Loading history...</span>
        </div>
      ) : responses.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No practice history yet. Head to Practice to get started!
        </p>
      ) : (
        <div className="space-y-2">
          {responses.map((r) => {
            const isExpanded = expandedId === r.id;
            return (
              <Card key={r.id} size="sm">
                <CardHeader
                  className="cursor-pointer"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : r.id)
                  }
                >
                  <CardTitle className="flex items-center justify-between text-sm font-normal">
                    <div className="flex items-center gap-2">
                      {r.is_correct ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">{r.concept_name}</span>
                      {r.question && (
                        <span className="text-muted-foreground">
                          &middot; {r.question.difficulty} &middot;{" "}
                          {r.question.question_type === "multiple_choice"
                            ? "MC"
                            : "Free Response"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                {isExpanded && r.question && (
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">
                        Question
                      </p>
                      <p>{r.question.question_text}</p>
                    </div>
                    {r.question.options && (
                      <div>
                        <p className="font-medium text-muted-foreground">
                          Options
                        </p>
                        <ul className="list-inside space-y-1">
                          {(r.question.options as MCOption[]).map((opt) => (
                            <li key={opt.label}>
                              <span className="font-semibold">
                                {opt.label}.
                              </span>{" "}
                              {opt.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-muted-foreground">
                        Your Answer
                      </p>
                      <p>{r.answer_text}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">
                        Correct Answer
                      </p>
                      <p>{r.question.correct_answer}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">
                        Feedback
                      </p>
                      <p>{r.ai_feedback}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">
                        Explanation
                      </p>
                      <p>{r.question.explanation}</p>
                    </div>
                    {r.self_assessment && (
                      <div>
                        <p className="font-medium text-muted-foreground">
                          Self Assessment
                        </p>
                        <p>{r.self_assessment}/5</p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
