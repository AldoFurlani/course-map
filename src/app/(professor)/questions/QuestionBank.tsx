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
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Plus,
  Download,
  X,
  Star,
} from "lucide-react";
import type { Question, MCOption, Concept, QuestionType, Difficulty } from "@/lib/types/database";

interface QuestionWithConcept extends Question {
  concepts?: { name: string } | null;
}

interface Props {
  initialQuestions: QuestionWithConcept[];
  concepts: Pick<Concept, "id" | "name">[];
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function QuestionBank({ initialQuestions, concepts }: Props) {
  const [questions, setQuestions] =
    useState<QuestionWithConcept[]>(initialQuestions);
  const [filterConcept, setFilterConcept] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Question>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterCurated, setFilterCurated] = useState<"all" | "curated" | "uncurated">("curated");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Add form state
  const [newQuestion, setNewQuestion] = useState({
    concept_id: "",
    question_type: "multiple_choice" as QuestionType,
    difficulty: "medium" as Difficulty,
    question_text: "",
    options: [
      { label: "A", text: "" },
      { label: "B", text: "" },
      { label: "C", text: "" },
      { label: "D", text: "" },
    ] as MCOption[],
    correct_answer: "",
    explanation: "",
  });

  const filterConceptId =
    filterConcept === "all"
      ? "all"
      : concepts.find((c) => c.name === filterConcept)?.id ?? "";

  const filtered = questions.filter((q) => {
    if (filterConceptId !== "all" && q.concept_id !== filterConceptId) return false;
    if (filterCurated === "curated" && !q.curated) return false;
    if (filterCurated === "uncurated" && q.curated) return false;
    return true;
  });

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
    if (expandedId === questionId) setExpandedId(null);
    if (editingId === questionId) setEditingId(null);
  }

  async function handleToggleCurated(questionId: string, curated: boolean) {
    setError("");
    const res = await fetch(`/api/questions/${questionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curated: !curated }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to update question");
      return;
    }
    const updated = (await res.json()) as QuestionWithConcept;
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? updated : q))
    );
  }

  function startEdit(q: QuestionWithConcept) {
    setEditingId(q.id);
    setEditData({
      question_text: q.question_text,
      options: q.options ? [...(q.options as MCOption[])] : null,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
    });
  }

  async function handleSaveEdit(questionId: string) {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update question");
        return;
      }

      const updated = (await res.json()) as QuestionWithConcept;
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? updated : q))
      );
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddQuestion() {
    setError("");
    setSaving(true);
    try {
      const resolvedConceptId =
        concepts.find((c) => c.name === newQuestion.concept_id)?.id ?? "";
      if (!resolvedConceptId) {
        setError("Could not resolve concept name");
        setSaving(false);
        return;
      }

      const body = {
        ...newQuestion,
        concept_id: resolvedConceptId,
        options:
          newQuestion.question_type === "multiple_choice"
            ? newQuestion.options
            : null,
      };

      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add question");
        return;
      }

      const created = (await res.json()) as QuestionWithConcept;
      setQuestions((prev) => [created, ...prev]);
      setShowAddForm(false);
      setNewQuestion({
        concept_id: "",
        question_type: "multiple_choice",
        difficulty: "medium",
        question_text: "",
        options: [
          { label: "A", text: "" },
          { label: "B", text: "" },
          { label: "C", text: "" },
          { label: "D", text: "" },
        ],
        correct_answer: "",
        explanation: "",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleExportCsv() {
    const headers = [
      "concept",
      "question_type",
      "difficulty",
      "question_text",
      "option_a",
      "option_b",
      "option_c",
      "option_d",
      "correct_answer",
      "explanation",
    ];

    const rows = filtered.map((q) => {
      const opts = (q.options as MCOption[]) ?? [];
      return [
        q.concepts?.name ?? "",
        q.question_type,
        q.difficulty,
        q.question_text,
        opts.find((o) => o.label === "A")?.text ?? "",
        opts.find((o) => o.label === "B")?.text ?? "",
        opts.find((o) => o.label === "C")?.text ?? "",
        opts.find((o) => o.label === "D")?.text ?? "",
        q.correct_answer,
        q.explanation,
      ].map(escapeCsv);
    });

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-4">
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
        <div className="space-y-2">
          <Label>Status</Label>
          <div className="flex gap-1">
            {(["curated", "all", "uncurated"] as const).map((val) => (
              <Button
                key={val}
                variant={filterCurated === val ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterCurated(val)}
              >
                {val.charAt(0).toUpperCase() + val.slice(1)}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} question{filtered.length !== 1 ? "s" : ""}
        </p>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? (
              <>
                <X className="mr-1 h-3.5 w-3.5" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Question
              </>
            )}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Add Question Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Concept</Label>
                <Select
                  value={newQuestion.concept_id}
                  onValueChange={(val) =>
                    setNewQuestion((prev) => ({ ...prev, concept_id: val ?? "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select concept..." />
                  </SelectTrigger>
                  <SelectContent>
                    {concepts.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newQuestion.question_type}
                  onValueChange={(val) =>
                    setNewQuestion((prev) => ({
                      ...prev,
                      question_type: val as QuestionType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">
                      Multiple Choice
                    </SelectItem>
                    <SelectItem value="free_response">Free Response</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select
                  value={newQuestion.difficulty}
                  onValueChange={(val) =>
                    setNewQuestion((prev) => ({
                      ...prev,
                      difficulty: val as Difficulty,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Question Text</Label>
              <textarea
                className="h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={newQuestion.question_text}
                onChange={(e) =>
                  setNewQuestion((prev) => ({
                    ...prev,
                    question_text: e.target.value,
                  }))
                }
              />
            </div>

            {newQuestion.question_type === "multiple_choice" && (
              <div className="space-y-2">
                <Label>Options</Label>
                {newQuestion.options.map((opt, i) => (
                  <div key={opt.label} className="flex items-center gap-2">
                    <span className="w-6 text-sm font-semibold">
                      {opt.label}.
                    </span>
                    <Input
                      value={opt.text}
                      onChange={(e) => {
                        const updated = [...newQuestion.options];
                        updated[i] = { ...opt, text: e.target.value };
                        setNewQuestion((prev) => ({
                          ...prev,
                          options: updated,
                        }));
                      }}
                      placeholder={`Option ${opt.label}`}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Correct Answer</Label>
              <Input
                value={newQuestion.correct_answer}
                onChange={(e) =>
                  setNewQuestion((prev) => ({
                    ...prev,
                    correct_answer: e.target.value,
                  }))
                }
                placeholder={
                  newQuestion.question_type === "multiple_choice"
                    ? "A, B, C, or D"
                    : "Full answer text"
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Explanation</Label>
              <textarea
                className="h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={newQuestion.explanation}
                onChange={(e) =>
                  setNewQuestion((prev) => ({
                    ...prev,
                    explanation: e.target.value,
                  }))
                }
              />
            </div>

            <Button
              onClick={handleAddQuestion}
              disabled={
                saving ||
                !newQuestion.concept_id ||
                !newQuestion.question_text.trim() ||
                !newQuestion.correct_answer.trim() ||
                !newQuestion.explanation.trim()
              }
            >
              {saving ? "Adding..." : "Add Question"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Question List */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No questions yet.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => {
            const isExpanded = expandedId === q.id;
            const isEditing = editingId === q.id;

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
                          handleToggleCurated(q.id, q.curated);
                        }}
                        title={q.curated ? "Remove from curated" : "Add to curated"}
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${
                            q.curated
                              ? "fill-yellow-500 text-yellow-500"
                              : ""
                          }`}
                        />
                      </Button>
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
                    {isEditing ? (
                      /* Edit Mode */
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Difficulty</Label>
                          <Select
                            value={editData.difficulty ?? q.difficulty}
                            onValueChange={(val) =>
                              setEditData((prev) => ({
                                ...prev,
                                difficulty: val as Difficulty,
                              }))
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">Easy</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="hard">Hard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Question</Label>
                          <textarea
                            className="h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            value={editData.question_text ?? ""}
                            onChange={(e) =>
                              setEditData((prev) => ({
                                ...prev,
                                question_text: e.target.value,
                              }))
                            }
                          />
                        </div>
                        {q.question_type === "multiple_choice" &&
                          editData.options && (
                            <div className="space-y-1">
                              <Label className="text-xs">Options</Label>
                              {(editData.options as MCOption[]).map(
                                (opt, i) => (
                                  <div
                                    key={opt.label}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="w-6 font-semibold">
                                      {opt.label}.
                                    </span>
                                    <Input
                                      value={opt.text}
                                      onChange={(e) => {
                                        const updated = [
                                          ...(editData.options as MCOption[]),
                                        ];
                                        updated[i] = {
                                          ...opt,
                                          text: e.target.value,
                                        };
                                        setEditData((prev) => ({
                                          ...prev,
                                          options: updated,
                                        }));
                                      }}
                                    />
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        <div className="space-y-1">
                          <Label className="text-xs">Correct Answer</Label>
                          <Input
                            value={editData.correct_answer ?? ""}
                            onChange={(e) =>
                              setEditData((prev) => ({
                                ...prev,
                                correct_answer: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Explanation</Label>
                          <textarea
                            className="h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            value={editData.explanation ?? ""}
                            onChange={(e) =>
                              setEditData((prev) => ({
                                ...prev,
                                explanation: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(q.id)}
                            disabled={saving}
                          >
                            {saving ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(q)}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </div>
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
                      </>
                    )}
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
