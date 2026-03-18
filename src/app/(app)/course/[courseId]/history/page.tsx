import { createClient } from "@/lib/supabase/server";
import QuestionHistory from "./QuestionHistory";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: concepts }, { count: totalResponses }, { count: correctCount }, { count: favoritedCount }] =
    await Promise.all([
      supabase.from("concepts").select("id, name").eq("course_id", courseId).order("name"),
      user
        ? supabase
            .from("student_responses")
            .select("*", { count: "exact", head: true })
            .eq("student_id", user.id)
            .eq("course_id", courseId)
        : Promise.resolve({ count: 0 }),
      user
        ? supabase
            .from("student_responses")
            .select("*", { count: "exact", head: true })
            .eq("student_id", user.id)
            .eq("course_id", courseId)
            .eq("is_correct", true)
        : Promise.resolve({ count: 0 }),
      user
        ? supabase
            .from("student_responses")
            .select("*", { count: "exact", head: true })
            .eq("student_id", user.id)
            .eq("course_id", courseId)
            .eq("favorited", true)
        : Promise.resolve({ count: 0 }),
    ]);

  const total = totalResponses ?? 0;
  const correct = correctCount ?? 0;
  const favorited = favoritedCount ?? 0;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        Question History
      </h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Review your past practice questions and responses.
      </p>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">Total Answered</p>
          <p className="text-2xl font-semibold font-mono">{total}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">Correct</p>
          <p className="text-2xl font-semibold font-mono">{correct}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">Accuracy</p>
          <p className="text-2xl font-semibold font-mono">{accuracy}%</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">Favorites</p>
          <p className="text-2xl font-semibold font-mono">{favorited}</p>
        </div>
      </div>

      <QuestionHistory courseId={courseId} concepts={concepts ?? []} />
    </div>
  );
}
