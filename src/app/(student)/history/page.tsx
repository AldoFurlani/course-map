import { createClient } from "@/lib/supabase/server";
import QuestionHistory from "./QuestionHistory";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const supabase = await createClient();

  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Question History</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Review your past practice questions and responses.
      </p>
      <QuestionHistory concepts={concepts ?? []} />
    </div>
  );
}
