import { createClient } from "@/lib/supabase/server";
import { MaterialManager } from "./MaterialManager";
import type { CourseMaterial } from "@/lib/types/database";

export default async function MaterialsPage() {
  const supabase = await createClient();

  const { data: materials } = await supabase
    .from("course_materials")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Course Materials</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload course notes, slides, and assignments. Files are chunked and
          embedded for RAG-powered question generation.
        </p>
      </div>

      <MaterialManager
        initialMaterials={(materials ?? []) as CourseMaterial[]}
      />
    </div>
  );
}
