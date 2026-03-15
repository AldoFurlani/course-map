"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  role: "student" | "professor" | "ta";
  fullName: string;
}

const studentLinks = [
  { href: "/graph", label: "Concept Graph" },
  { href: "/practice", label: "Practice" },
  { href: "/progress", label: "Progress" },
];

const professorLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/concepts", label: "Concepts" },
  { href: "/materials", label: "Materials" },
  { href: "/questions", label: "Questions" },
];

export default function Navbar({ role, fullName }: NavbarProps) {
  const router = useRouter();
  const links = role === "student" ? studentLinks : professorLinks;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href={role === "student" ? "/graph" : "/dashboard"} className="font-semibold text-lg">
            Course Map
          </Link>
          <nav className="flex items-center gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{fullName}</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
