import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/layout/Navbar";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // Redirect professors to their dashboard
  if (profile.role === "professor" || profile.role === "ta") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen pl-11">
      <Navbar role={profile.role} fullName={profile.full_name} />
      <main>{children}</main>
    </div>
  );
}
