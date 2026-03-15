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
    <div>
      <h1 className="text-2xl font-bold">Question History</h1>
      <p className="mt-2 mb-6 text-muted-foreground">
        Review your past practice questions and responses.
      </p>
      <QuestionHistory concepts={concepts ?? []} />
    </div>
  );
}
