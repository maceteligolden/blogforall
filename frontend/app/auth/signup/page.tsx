"use client";

import { useState, Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { validatePassword } from "@/lib/utils/password-validation";

const SIGNUP_INVITE_KEY = "blogforall_signup_invite_token";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signupAsync, isSigningUp } = useAuth();
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
  const [passwordValid, setPasswordValid] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (invitedEmail) {
      setFormData((prev) => ({ ...prev, email: invitedEmail }));
    }
  }, [invitedEmail]);

  const submitSignup = async () => {
    if (submittingRef.current) return;

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError("Password does not meet the requirements. Please check the password criteria.");
      return;
    }

    submittingRef.current = true;
    setError("");

    if (inviteToken) {
      sessionStorage.setItem(SIGNUP_INVITE_KEY, inviteToken);
    }
    try {
      await signupAsync({
        email: formData.email.trim(),
        password: formData.password,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone_number: formData.phone_number.trim(),
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
    } finally {
      submittingRef.current = false;
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submitSignup();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
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
              : "Create your account — we'll verify your email next."
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
                autoComplete="given-name"
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
                autoComplete="family-name"
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
              autoComplete="tel"
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
              onValidationChange={setPasswordValid}
              className="mt-1 bg-gray-800 border-gray-700 text-white"
              showValidation
            />
          </div>
          <div className="flex items-start gap-2">
            <input
              id="accept_terms"
              name="accept_terms"
              type="checkbox"
              value="on"
              required
              checked={formData.accept_terms}
              onChange={(e) => setFormData((prev) => ({ ...prev, accept_terms: e.target.checked }))}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-600 bg-gray-800 text-primary focus:ring-primary"
            />
            <p className="text-sm text-gray-300">
              <Label htmlFor="accept_terms" className="cursor-pointer text-sm font-normal text-gray-300">
                I accept the
              </Label>{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Terms and Conditions
              </a>
            </p>
          </div>
        </div>

        <div>
          <Button type="submit" className="w-full" disabled={isSigningUp || !passwordValid}>
            {isSigningUp ? "Creating account..." : "Create account"}
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
