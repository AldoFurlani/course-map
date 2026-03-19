"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Map } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(error.message);
      setIsError(true);
      setLoading(false);
      return;
    }

    window.location.href = "/courses";
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden md:flex md:w-[45%] lg:w-[50%] relative overflow-hidden bg-primary items-center justify-center">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.06]"
          viewBox="0 0 400 600"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          <circle cx="120" cy="180" r="4" fill="currentColor" />
          <circle cx="280" cy="140" r="4" fill="currentColor" />
          <circle cx="200" cy="300" r="4" fill="currentColor" />
          <circle cx="100" cy="400" r="4" fill="currentColor" />
          <circle cx="300" cy="420" r="4" fill="currentColor" />
          <circle cx="180" cy="480" r="4" fill="currentColor" />
          <path d="M120 180 L200 300" stroke="currentColor" strokeWidth="1.5" />
          <path d="M280 140 L200 300" stroke="currentColor" strokeWidth="1.5" />
          <path d="M200 300 L100 400" stroke="currentColor" strokeWidth="1.5" />
          <path d="M200 300 L300 420" stroke="currentColor" strokeWidth="1.5" />
          <path d="M100 400 L180 480" stroke="currentColor" strokeWidth="1.5" />
          <path d="M300 420 L180 480" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <div className="relative z-10 text-primary-foreground px-12 max-w-md auth-brand-enter">
          <Map className="size-10 mb-6 opacity-80" strokeWidth={1.5} />
          <h1 className="font-serif text-4xl font-semibold tracking-tight mb-3">
            Course Map
          </h1>
          <p className="text-primary-foreground/70 text-lg leading-relaxed">
            Navigate your learning with interactive concept graphs and AI&#8209;generated practice.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="md:hidden flex items-center gap-3 mb-8 auth-field-enter" style={{ animationDelay: "0ms" }}>
            <Map className="size-7 text-primary" strokeWidth={1.5} />
            <span className="font-serif text-2xl font-semibold tracking-tight">Course Map</span>
          </div>

          <div className="space-y-2 mb-8 auth-field-enter" style={{ animationDelay: "60ms" }}>
            <h2 className="font-serif text-2xl font-semibold tracking-tight">Create your account</h2>
            <p className="text-sm text-muted-foreground">
              Get started with exam preparation
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2 auth-field-enter" style={{ animationDelay: "120ms" }}>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 auth-field-enter" style={{ animationDelay: "180ms" }}>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="auth-field-enter" style={{ animationDelay: "240ms" }}>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </div>
          </form>

          {message && (
            <p className={`mt-4 text-center text-sm ${isError ? "text-destructive" : "text-muted-foreground"}`}>
              {message}
            </p>
          )}

          <div className="mt-8 pt-6 border-t border-border auth-field-enter" style={{ animationDelay: "300ms" }}>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
