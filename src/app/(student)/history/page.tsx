import { createClient } from "@/lib/supabase/server";
import QuestionHistory from "./QuestionHistory";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: concepts }, { count: totalResponses }, { count: correctCount }] =
    await Promise.all([
      supabase.from("concepts").select("id, name").order("name"),
      user
        ? supabase
            .from("student_responses")
            .select("*", { count: "exact", head: true })
            .eq("student_id", user.id)
        : Promise.resolve({ count: 0 }),
      user
        ? supabase
            .from("student_responses")
            .select("*", { count: "exact", head: true })
            .eq("student_id", user.id)
            .eq("is_correct", true)
        : Promise.resolve({ count: 0 }),
    ]);

  const total = totalResponses ?? 0;
  const correct = correctCount ?? 0;
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
      <div className="mb-8 grid grid-cols-3 gap-4">
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
      </div>

      <QuestionHistory concepts={concepts ?? []} />
    </div>
  );
}
