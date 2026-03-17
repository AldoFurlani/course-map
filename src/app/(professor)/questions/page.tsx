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
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Question Bank</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Curate questions for students to practice with. Star questions to make them visible in the student question bank.
      </p>
      <QuestionBank
        initialQuestions={questions ?? []}
        concepts={concepts ?? []}
      />
    </div>
  );
}
