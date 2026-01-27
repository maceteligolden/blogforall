"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { validatePassword } from "@/lib/utils/password-validation";

export default function SignupPage() {
  const router = useRouter();
  const { signupAsync, isLoading, signupError } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone_number: "",
  });
  const [error, setError] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
      setError("Please fill in all required fields");
      return;
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError("Password does not meet the requirements. Please check the password criteria.");
      return;
    }

    try {
      await signupAsync(formData);
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        "Signup failed. Please try again.";
      setError(errorMessage);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-black to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,64,175,0.1),transparent_50%)] pointer-events-none" />
      
      <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-gray-900/80 backdrop-blur-sm border border-gray-800 p-8 shadow-xl">
          <div>
            <h1 className="text-center text-3xl font-bold text-primary mb-2">BlogForAll</h1>
            <h2 className="text-center text-2xl font-bold text-white mt-4">Create your account</h2>
            <p className="mt-2 text-center text-sm text-gray-400">Start managing your blogs today</p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-red-900/50 border border-red-800 p-3 text-sm text-red-200">{error}</div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name" className="text-gray-300">First name</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={handleChange}
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name" className="text-gray-300">Last name</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={handleChange}
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email" className="text-gray-300">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label htmlFor="phone_number" className="text-gray-300">Phone number (optional)</Label>
                <Input
                  id="phone_number"
                  name="phone_number"
                  type="tel"
                  value={formData.phone_number}
                  onChange={handleChange}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-gray-300">Password</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                  showValidation={true}
                  onValidationChange={setIsPasswordValid}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Password must contain: 1 lowercase, 1 uppercase, 1 number, 1 symbol, and at least 8 characters
                </p>
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full" disabled={isLoading || !isPasswordValid}>
                {isLoading ? "Creating account..." : "Create account"}
              </Button>
            </div>

            <div className="text-center text-sm">
              <span className="text-gray-400">Already have an account? </span>
              <button
                type="button"
                onClick={() => router.push("/auth/login")}
                className="font-medium text-primary hover:text-primary/80"
              >
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

