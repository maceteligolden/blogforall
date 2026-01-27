"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useAuthStore } from "@/lib/store/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading } = useAuth();
  const { isAuthenticated } = useAuthStore();
  
  useEffect(() => {
    // Redirect to dashboard if already authenticated
    if (isAuthenticated) {
      const redirect = searchParams.get("redirect") || "/dashboard";
      router.push(redirect);
    }
  }, [isAuthenticated, router, searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      login({ email, password });
    } catch (err) {
      setError("Login failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-black to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,64,175,0.1),transparent_50%)] pointer-events-none" />
      
      <div className="relative flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-gray-900/80 backdrop-blur-sm border border-gray-800 p-8 shadow-xl">
          <div>
            <h1 className="text-center text-3xl font-bold text-primary mb-2">BlogForAll</h1>
            <h2 className="text-center text-2xl font-bold text-white mt-4">Sign in to your account</h2>
            <p className="mt-2 text-center text-sm text-gray-400">Manage your blogs with ease</p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-red-900/50 border border-red-800 p-3 text-sm text-red-200">{error}</div>
            )}
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-gray-300">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-gray-300">Password</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </div>

            <div className="text-center text-sm">
              <span className="text-gray-400">Don&apos;t have an account? </span>
              <button
                type="button"
                onClick={() => router.push("/auth/signup")}
                className="font-medium text-primary hover:text-primary/80"
              >
                Sign up
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

