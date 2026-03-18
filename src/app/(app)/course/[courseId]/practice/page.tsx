import { createClient } from "@/lib/supabase/server";
import PracticeSession from "./PracticeSession";

export const dynamic = "force-dynamic";

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ concept?: string }>;
}) {
  const { courseId } = await params;
  const { concept } = await searchParams;
  const supabase = await createClient();

  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, name")
    .eq("course_id", courseId)
    .order("name");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6">
      <PracticeSession courseId={courseId} concepts={concepts ?? []} initialConcept={concept} />
    </div>
  );
}
