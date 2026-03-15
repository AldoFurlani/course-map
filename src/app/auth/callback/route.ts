import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Get user profile to determine redirect
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        const redirectTo =
          profile?.role === "professor" || profile?.role === "ta"
            ? "/dashboard"
            : "/graph";

        return NextResponse.redirect(new URL(redirectTo, origin));
      }
    }
  }

  // If something went wrong, redirect to login with error
  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
