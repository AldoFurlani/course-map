"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Network,
  Loader2,
  BookOpen,
  Trash2,
  Map,
} from "lucide-react";
import type { Course } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/courses")
      .then((res) => res.json())
      .then((data) => setCourses(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });

      if (!res.ok) throw new Error("Failed to create course");

      const course = await res.json();
      router.push(`/course/${course.id}/graph`);
    } catch (err) {
      console.error(err);
      setCreating(false);
    }
  }

  async function handleDelete(courseId: string) {
    setDeletingId(courseId);
    try {
      const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
      if (res.ok) {
        setCourses((prev) => prev.filter((c) => c.id !== courseId));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-3 mb-2">
        <Map className="size-7 text-primary" strokeWidth={1.5} />
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Your Courses
        </h1>
      </div>
      <p className="mb-8 text-sm text-muted-foreground">
        Each course has its own concept graph, materials, and practice questions.
      </p>

      {/* Course grid */}
      {courses.length > 0 && (
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="group relative rounded-xl ring-1 ring-foreground/10 bg-card transition-all hover:shadow-[0_3px_12px_rgba(0,0,0,0.08)] cursor-pointer"
              onClick={() => router.push(`/course/${course.id}/graph`)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Network className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                      <h2 className="font-serif text-lg font-semibold tracking-tight truncate">
                        {course.name}
                      </h2>
                    </div>
                    {course.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {course.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${course.name}"? This cannot be undone.`)) {
                        handleDelete(course.id);
                      }
                    }}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                    disabled={deletingId === course.id}
                  >
                    {deletingId === course.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Updated {new Date(course.updated_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {courses.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="size-12 text-muted-foreground/30 mb-4" strokeWidth={1.5} />
          <p className="text-lg font-medium mb-1">No courses yet</p>
          <p className="text-sm text-muted-foreground mb-6">
            Create your first course to get started with concept mapping and practice.
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 size-4" />
            Create Course
          </Button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl ring-1 ring-foreground/10 bg-card p-6 space-y-4">
          <h2 className="font-serif text-xl font-semibold tracking-tight">New Course</h2>
          <div className="space-y-2">
            <Label htmlFor="course-name">Name</Label>
            <Input
              id="course-name"
              placeholder="e.g. Machine Learning 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-desc">Description (optional)</Label>
            <Input
              id="course-desc"
              placeholder="Brief description of the course"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Course"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Create button (when courses exist) */}
      {courses.length > 0 && !showForm && (
        <Button variant="outline" onClick={() => setShowForm(true)}>
          <Plus className="mr-2 size-4" />
          New Course
        </Button>
      )}
    </div>
  );
}
