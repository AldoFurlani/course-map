import { createClient } from "@/lib/supabase/server";
import PracticeSession from "./PracticeSession";

export default async function PracticePage() {
  const supabase = await createClient();

  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, name")
    .order("name");

  return (
    <div>
      <h1 className="text-2xl font-bold">Practice</h1>
      <p className="mt-2 mb-6 text-muted-foreground">
        Select a concept to practice with AI-generated questions.
      </p>
      <PracticeSession concepts={concepts ?? []} />
    </div>
  );
}
