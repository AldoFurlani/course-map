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
  FileText,
  ArrowLeft,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavbarProps {
  courseId: string;
  courseName: string;
  fullName: string;
}

export default function Navbar({ courseId, courseName, fullName }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const prefix = `/course/${courseId}`;
  const links = [
    { href: `${prefix}/graph`, label: "Graph", icon: Network },
    { href: `${prefix}/practice`, label: "Practice", icon: Dumbbell },
    { href: `${prefix}/history`, label: "History", icon: Clock },
    { href: `${prefix}/progress`, label: "Progress", icon: TrendingUp },
    { href: `${prefix}/materials`, label: "Materials", icon: FileText },
  ];

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="fixed left-0 top-0 z-50 flex h-screen w-11 flex-col items-center border-r border-border bg-background py-3">
      {/* Back to courses */}
      <Tooltip>
        <TooltipTrigger
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground mb-2"
          render={<Link href="/courses" aria-label="Back to courses" />}
        >
          <ArrowLeft className="size-[17px]" strokeWidth={1.5} />
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          {courseName}
        </TooltipContent>
      </Tooltip>

      <div className="w-6 border-t border-border mb-2" />

      {/* Navigation links */}
      <div className="flex flex-1 flex-col items-center gap-1">
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
                render={<Link href={link.href} aria-label={link.label} />}
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
            className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            render={<button type="button" aria-label="Toggle theme" />}
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
            render={<button type="button" aria-label={`Log out (${fullName})`} />}
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
