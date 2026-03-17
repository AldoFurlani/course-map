import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Role = "student" | "professor" | "ta";

interface AuthResult {
  user: { id: string; role: Role };
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

  const role = (user.user_metadata?.role as Role) ?? "student";
  return { user: { id: user.id, role } };
}

/**
 * Verify the request is authenticated AND the user has a professor or TA role.
 * Returns the user or a 401/403 response.
 */
export async function requireProfessor(): Promise<AuthResult | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;

  if (result.user.role !== "professor" && result.user.role !== "ta") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return result;
}
