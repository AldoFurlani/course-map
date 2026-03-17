"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface ConceptInfo {
  id: string;
  name: string;
}

interface StudentInfo {
  id: string;
  full_name: string;
}

interface ScoreEntry {
  student_id: string;
  concept_id: string;
  raw_score: number;
  response_count: number;
}

interface AggregateEntry {
  concept_id: string;
  avg_score: number;
  student_count: number;
  total_responses: number;
}

interface StudentDetail {
  student: { id: string; full_name: string };
  scores: {
    concept_id: string;
    raw_score: number;
    response_count: number;
  }[];
  responses: {
    id: string;
    concept_id: string;
    is_correct: boolean;
    ai_feedback: string;
    self_assessment: number | null;
    created_at: string;
    question: {
      question_text: string;
      question_type: string;
      difficulty: string;
      concept_id: string;
    } | null;
  }[];
}

interface Props {
  concepts: ConceptInfo[];
  students: StudentInfo[];
  scores: ScoreEntry[];
  aggregates: AggregateEntry[];
}

function scoreColor(score: number): string {
  if (score >= 0.7) return "bg-success";
  if (score >= 0.4) return "bg-warning";
  return "bg-destructive";
}

function scoreCellColor(score: number): string {
  if (score >= 0.7) return "bg-success/10 text-success";
  if (score >= 0.4) return "bg-warning/10 text-warning";
  return "bg-destructive/10 text-destructive";
}

const PAGE_SIZE = 20;

export default function ClassDashboard({
  concepts,
  students,
  scores,
  aggregates,
}: Props) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [page, setPage] = useState(0);

  // Build a lookup: scoreMap[studentId][conceptId] = raw_score
  const scoreMap = new Map<string, Map<string, number>>();
  for (const s of scores) {
    if (!scoreMap.has(s.student_id)) {
      scoreMap.set(s.student_id, new Map());
    }
    scoreMap.get(s.student_id)!.set(s.concept_id, s.raw_score);
  }

  const aggMap = new Map(aggregates.map((a) => [a.concept_id, a]));

  // Stats
  const activeStudents = new Set(scores.map((s) => s.student_id)).size;
  const totalResponses = scores.reduce((sum, s) => sum + s.response_count, 0);
  const allScores = scores.map((s) => s.raw_score);
  const avgReadiness =
    allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0;
  const lowConcepts = concepts.filter((c) => {
    const agg = aggMap.get(c.id);
    return agg && agg.avg_score < 0.4;
  });

  // Pagination
  const totalPages = Math.ceil(students.length / PAGE_SIZE);
  const paginatedStudents = students.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );

  async function handleSelectStudent(studentId: string) {
    if (selectedStudentId === studentId) {
      setSelectedStudentId(null);
      setStudentDetail(null);
      return;
    }

    setSelectedStudentId(studentId);
    setLoadingDetail(true);
    setStudentDetail(null);

    try {
      const res = await fetch(`/api/dashboard/students/${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setStudentDetail(data);
      }
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Active Students</p>
            <p className="text-2xl font-semibold font-mono">{activeStudents}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Avg Readiness</p>
            <p className="text-2xl font-semibold font-mono">
              {Math.round(avgReadiness * 100)}%
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Responses</p>
            <p className="text-2xl font-semibold font-mono">{totalResponses}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Low Readiness (&lt;40%)</p>
            <p className="text-2xl font-semibold font-mono">
              {lowConcepts.length} concept{lowConcepts.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Readiness Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Readiness Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No students have practiced yet.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-background px-2 py-1 text-left font-medium">
                        Student
                      </th>
                      {concepts.map((c) => (
                        <th
                          key={c.id}
                          className="px-1 py-1 text-center font-medium"
                          title={c.name}
                        >
                          <span className="block max-w-[60px] truncate">
                            {c.name}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((student) => {
                      const studentScores = scoreMap.get(student.id);
                      const isSelected = selectedStudentId === student.id;
                      return (
                        <tr
                          key={student.id}
                          className={`cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? "bg-muted" : ""}`}
                          onClick={() => handleSelectStudent(student.id)}
                        >
                          <td className="sticky left-0 bg-background px-2 py-1.5 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {isSelected ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                              {student.full_name}
                            </div>
                          </td>
                          {concepts.map((c) => {
                            const score = studentScores?.get(c.id);
                            return (
                              <td
                                key={c.id}
                                className={`px-1 py-1.5 text-center ${
                                  score !== undefined
                                    ? scoreCellColor(score)
                                    : "text-muted-foreground"
                                }`}
                              >
                                {score !== undefined
                                  ? `${Math.round(score * 100)}%`
                                  : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Student Drill-Down */}
      {selectedStudentId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {studentDetail?.student.full_name ?? "Loading..."}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDetail ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span className="text-sm">Loading student details...</span>
              </div>
            ) : studentDetail ? (
              <div className="space-y-6">
                {/* Per-concept readiness bars */}
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    Concept Readiness
                  </h3>
                  <div className="space-y-2">
                    {concepts.map((c) => {
                      const s = studentDetail.scores.find(
                        (sc) => sc.concept_id === c.id
                      );
                      const score = s?.raw_score ?? 0;
                      const hasScore = !!s;

                      return (
                        <div key={c.id}>
                          <div className="flex items-center justify-between text-sm">
                            <span>{c.name}</span>
                            <span className="font-medium">
                              {hasScore
                                ? `${Math.round(score * 100)}%`
                                : "—"}
                            </span>
                          </div>
                          {hasScore && (
                            <div className="mt-1 h-2 w-full rounded-full bg-muted">
                              <div
                                className={`h-2 rounded-full transition-all ${scoreColor(score)}`}
                                style={{
                                  width: `${Math.round(score * 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent responses */}
                {studentDetail.responses.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">
                      Recent Responses ({studentDetail.responses.length})
                    </h3>
                    <div className="space-y-2">
                      {studentDetail.responses.slice(0, 20).map((r) => {
                        const conceptName =
                          concepts.find((c) => c.id === r.concept_id)?.name ??
                          "Unknown";
                        return (
                          <div
                            key={r.id}
                            className="rounded-lg bg-muted/50 px-3 py-2 text-sm"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-block h-2 w-2 rounded-full ${
                                    r.is_correct
                                      ? "bg-green-500"
                                      : "bg-red-500"
                                  }`}
                                />
                                <span className="font-medium">
                                  {conceptName}
                                </span>
                                {r.question && (
                                  <span className="text-muted-foreground">
                                    &middot; {r.question.difficulty} &middot;{" "}
                                    {r.question.question_type === "multiple_choice"
                                      ? "MC"
                                      : "Free Response"}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(r.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {r.question && (
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                                {r.question.question_text}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Aggregate Concept Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Concept Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {concepts.map((c) => {
              const agg = aggMap.get(c.id);
              const avgScore = agg?.avg_score ?? 0;
              const studentCount = agg?.student_count ?? 0;

              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {studentCount} student{studentCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <span className="font-medium">
                      {studentCount > 0
                        ? `${Math.round(avgScore * 100)}%`
                        : "—"}
                    </span>
                  </div>
                  {studentCount > 0 && (
                    <div className="mt-1 h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full transition-all ${scoreColor(avgScore)}`}
                        style={{ width: `${Math.round(avgScore * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
