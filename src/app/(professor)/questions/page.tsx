import { createClient } from "@/lib/supabase/server";
import QuestionBank from "./QuestionBank";

export default async function QuestionsPage() {
  const supabase = await createClient();

  const [{ data: questions }, { data: concepts }] = await Promise.all([
    supabase
      .from("questions")
      .select("*, concepts(name)")
      .order("created_at", { ascending: false }),
    supabase.from("concepts").select("id, name").order("name"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Question Bank</h1>
      <p className="mt-2 mb-6 text-muted-foreground">
        Review and manage AI-generated questions.
      </p>
      <QuestionBank
        initialQuestions={questions ?? []}
        concepts={concepts ?? []}
      />
    </div>
  );
}
