"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import {
  Sun,
  Moon,
  LogOut,
  Network,
  Dumbbell,
  Clock,
  TrendingUp,
  LayoutDashboard,
  FileText,
  HelpCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavbarProps {
  role: "student" | "professor" | "ta";
  fullName: string;
}

const studentLinks = [
  { href: "/graph", label: "Graph", icon: Network },
  { href: "/practice", label: "Practice", icon: Dumbbell },
  { href: "/history", label: "History", icon: Clock },
  { href: "/progress", label: "Progress", icon: TrendingUp },
];

const professorLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/concepts", label: "Concepts", icon: Network },
  { href: "/materials", label: "Materials", icon: FileText },
  { href: "/questions", label: "Questions", icon: HelpCircle },
];

export default function Navbar({ role, fullName }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const links = role === "student" ? studentLinks : professorLinks;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      {/* Outer glow */}
      <div className="absolute -inset-px rounded-[20px] bg-gradient-to-r from-primary/20 via-primary/5 to-primary/20 blur-sm" />
      <div className="absolute -inset-px rounded-[20px] bg-gradient-to-r from-primary/30 via-transparent to-primary/30" />

      <nav className="relative flex items-center gap-0.5 rounded-[20px] border border-white/[0.08] bg-card/80 px-1.5 py-1.5 shadow-2xl shadow-black/25 backdrop-blur-2xl">
        {/* Nav links */}
        {links.map((link) => {
          const isActive =
            pathname === link.href ||
            pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative flex flex-col items-center gap-1 rounded-2xl px-5 py-2.5 transition-all duration-200 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              }`}
            >
              <Icon className="size-[18px]" />
              <span className="text-[10px] font-medium leading-none tracking-wide">
                {link.label}
              </span>
            </Link>
          );
        })}

        {/* Divider */}
        <div className="mx-1.5 h-8 w-px bg-white/[0.06]" />

        {/* Actions */}
        <Tooltip>
          <TooltipTrigger
            className="flex items-center justify-center rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="size-[18px] rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-[18px] rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </TooltipTrigger>
          <TooltipContent side="top">Toggle theme</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            className="flex items-center justify-center rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="size-[18px]" />
            <span className="sr-only">Log out</span>
          </TooltipTrigger>
          <TooltipContent side="top">
            Log out ({fullName})
          </TooltipContent>
        </Tooltip>
      </nav>
    </div>
  );
}
