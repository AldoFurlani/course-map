import { createClient } from "@/lib/supabase/server";
import { MaterialManager } from "./MaterialManager";
import type { CourseMaterial } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();

  const { data: materials } = await supabase
    .from("course_materials")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        Course Materials
      </h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Upload course notes, slides, and assignments. Files are chunked and
        embedded for semantic search and question generation.
      </p>

      <MaterialManager
        courseId={courseId}
        initialMaterials={(materials ?? []) as CourseMaterial[]}
      />
    </div>
  );
}
