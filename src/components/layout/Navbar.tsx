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
    <nav className="fixed left-0 top-0 z-50 flex h-screen w-11 flex-col items-center border-r border-border bg-background py-3">
      {/* Navigation links */}
      <div className="flex flex-1 flex-col items-center gap-1 pt-1">
        {links.map((link) => {
          const isActive =
            pathname === link.href ||
            pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Tooltip key={link.href}>
              <TooltipTrigger
                className={`relative flex size-8 items-center justify-center rounded-md transition-all duration-150 ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                render={<Link href={link.href} />}
              >
                {isActive && (
                  <span className="absolute -left-[6px] top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full bg-primary" />
                )}
                <Icon className="size-[17px]" strokeWidth={isActive ? 2 : 1.5} />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12}>
                {link.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="size-[17px] rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" strokeWidth={1.5} />
            <Moon className="absolute size-[17px] rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>Toggle theme</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="size-[17px]" strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            Log out ({fullName})
          </TooltipContent>
        </Tooltip>
      </div>
    </nav>
  );
}
