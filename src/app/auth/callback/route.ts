import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (code) {
    // PKCE flow
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(await getRedirectPath(supabase), origin));
    }
  }

  if (token_hash && type) {
    // Token hash flow (used by magic links in local dev)
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "magiclink" | "email",
    });
    if (!error) {
      return NextResponse.redirect(new URL(await getRedirectPath(supabase), origin));
    }
  }

  // If something went wrong, redirect to login with error
  return NextResponse.redirect(new URL("/login?error=auth", origin));
}

async function getRedirectPath(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "professor" || profile?.role === "ta") {
      return "/dashboard";
    }
  }

  return "/graph";
}
