import { createClient } from "@/lib/supabase/server";
import PracticeSession from "./PracticeSession";

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ concept?: string }>;
}) {
  const supabase = await createClient();
  const { concept } = await searchParams;

  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6">
      <PracticeSession concepts={concepts ?? []} initialConcept={concept} />
    </div>
  );
}
