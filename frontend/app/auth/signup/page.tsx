"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { validatePassword } from "@/lib/utils/password-validation";
import { AuthPageHeader } from "@/components/auth/auth-page-header";

const SIGNUP_INVITE_KEY = "blogforall_signup_invite_token";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signupAsync, isLoading, signupError } = useAuth();
  const inviteToken = searchParams.get("invite");
  const invitedEmail = searchParams.get("email")?.trim() || "";
  const referralCode = searchParams.get("ref")?.trim().toUpperCase() || undefined;
  const [formData, setFormData] = useState({
    email: invitedEmail,
    password: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    accept_terms: false,
  });
  const [error, setError] = useState<string>("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  useEffect(() => {
    if (invitedEmail) {
      setFormData((prev) => ({ ...prev, email: invitedEmail }));
    }
  }, [invitedEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
      setError("Please fill in all required fields");
      return;
    }
    if (!formData.accept_terms) {
      setError("You must accept the Terms and Conditions to sign up");
      return;
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError("Password does not meet the requirements. Please check the password criteria.");
      return;
    }

    if (inviteToken) {
      sessionStorage.setItem(SIGNUP_INVITE_KEY, inviteToken);
    }
    try {
      await signupAsync({
        ...formData,
        accept_terms: true,
        terms_version: "2025-01",
        ...(referralCode ? { referral_code: referralCode } : {}),
        ...(inviteToken ? { invite_token: inviteToken } : {}),
      });
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        "Signup failed. Please try again.";
      setError(errorMessage);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    });
  };

  return (
    <>
      <AuthPageHeader
        title="Create your account"
        subtitle={
          inviteToken
            ? "You're signing up to accept a workspace invitation."
            : referralCode
              ? "You were invited to join Bloggr."
              : "Start managing your blogs today"
        }
      />
      {referralCode && !inviteToken && (
        <div className="mb-6 rounded-md bg-primary/10 border border-primary/30 px-3 py-2 text-sm text-primary">
          Referral code <span className="font-mono font-semibold">{referralCode}</span> will be applied.
        </div>
      )}
      <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-red-900/50 border border-red-800 p-3 text-sm text-red-200">{error}</div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name" className="text-gray-300">
                    First name
                  </Label>
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
                  <Label htmlFor="last_name" className="text-gray-300">
                    Last name
                  </Label>
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
                <Label htmlFor="email" className="text-gray-300">
                  Email address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  readOnly={!!inviteToken && !!invitedEmail}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label htmlFor="phone_number" className="text-gray-300">
                  Phone number (optional)
                </Label>
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
                <Label htmlFor="password" className="text-gray-300">
                  Password
                </Label>
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
              <div className="flex items-start gap-2">
                <input
                  id="accept_terms"
                  name="accept_terms"
                  type="checkbox"
                  required
                  checked={formData.accept_terms}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-800 text-primary focus:ring-primary"
                />
                <Label htmlFor="accept_terms" className="text-sm text-gray-300 cursor-pointer">
                  I accept the{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Terms and Conditions
                  </a>
                </Label>
              </div>
            </div>

            <div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !isPasswordValid || !formData.accept_terms}
              >
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
    </>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}
