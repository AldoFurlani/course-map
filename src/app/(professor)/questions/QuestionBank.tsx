"use client";

import { useState } from "react";
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
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { Question, MCOption, Concept } from "@/lib/types/database";

interface QuestionWithConcept extends Question {
  concepts?: { name: string } | null;
}

interface Props {
  initialQuestions: QuestionWithConcept[];
  concepts: Pick<Concept, "id" | "name">[];
}

export default function QuestionBank({ initialQuestions, concepts }: Props) {
  const [questions, setQuestions] =
    useState<QuestionWithConcept[]>(initialQuestions);
  const [filterConcept, setFilterConcept] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered =
    filterConcept === "all"
      ? questions
      : questions.filter((q) => q.concept_id === filterConcept);

  async function handleDelete(questionId: string) {
    setError("");
    const res = await fetch(`/api/questions/${questionId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to delete question");
      return;
    }
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
  }

  return (
    <div className="space-y-4">
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
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} question{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No questions generated yet.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => {
            const isExpanded = expandedId === q.id;
            return (
              <Card key={q.id} size="sm">
                <CardHeader
                  className="cursor-pointer"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : q.id)
                  }
                >
                  <CardTitle className="flex items-center justify-between text-sm font-normal">
                    <div className="flex-1">
                      <span className="font-medium">
                        {q.concepts?.name ?? "Unknown"}
                      </span>
                      <span className="mx-2 text-muted-foreground">
                        &middot;
                      </span>
                      <span className="text-muted-foreground">
                        {q.difficulty} &middot;{" "}
                        {q.question_type === "multiple_choice"
                          ? "MC"
                          : "Free Response"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(q.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">
                        Question
                      </p>
                      <p>{q.question_text}</p>
                    </div>
                    {q.options && (
                      <div>
                        <p className="font-medium text-muted-foreground">
                          Options
                        </p>
                        <ul className="list-inside space-y-1">
                          {(q.options as MCOption[]).map((opt) => (
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
                        Correct Answer
                      </p>
                      <p>{q.correct_answer}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">
                        Explanation
                      </p>
                      <p>{q.explanation}</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
