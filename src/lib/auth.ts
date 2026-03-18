import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface AuthResult {
  user: { id: string };
}

/**
 * Verify the request is authenticated. Returns the user or a 401 response.
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { user: { id: user.id } };
}

/**
 * Verify the user owns the given course. Returns the user or a 403 response.
 */
export async function requireCourseOwner(
  courseId: string
): Promise<AuthResult | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;

  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("user_id", result.user.id)
    .single();

  if (!course) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return result;
}
