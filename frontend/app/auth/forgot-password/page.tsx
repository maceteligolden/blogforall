"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { usePasswordReset } from "@/lib/hooks/use-password-reset";

type Step = "email" | "code" | "password" | "done";

function getApiErrorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
  );
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const {
    forgotPassword,
    verifyResetCode,
    resetPassword,
    isRequestingCode,
    isVerifyingCode,
    isResettingPassword,
  } = usePasswordReset();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email) {
      setError("Please enter your email");
      return;
    }
    try {
      await forgotPassword({ email });
      setStep("code");
      setInfo("If an account exists for that email, a code has been sent.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not request a reset code. Please try again."));
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email");
      return;
    }
    try {
      await verifyResetCode({ email, code });
      setStep("password");
    } catch (err) {
      setError(getApiErrorMessage(err, "Invalid or expired code"));
    }
  };

  const handleResend = async () => {
    setError("");
    setInfo("");
    try {
      await forgotPassword({ email });
      setInfo("A new code has been sent.");
      setCode("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not resend the code. Please try again."));
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      await resetPassword({ email, code, new_password: newPassword });
      setStep("done");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not reset your password"));
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-black to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,64,175,0.1),transparent_50%)] pointer-events-none" />

      <div className="relative flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-gray-900/80 backdrop-blur-sm border border-gray-800 p-8 shadow-xl">
          <AuthPageHeader
            title={
              step === "done"
                ? "Password updated"
                : step === "password"
                ? "Set a new password"
                : step === "code"
                ? "Enter the code"
                : "Forgot your password?"
            }
            subtitle={
              step === "done"
                ? "You can now sign in with your new password."
                : step === "password"
                ? "Choose a strong password you don't use elsewhere."
                : step === "code"
                ? `We sent a 6-digit code to ${email}. It expires in 15 minutes.`
                : "Enter your email and we'll send you a 6-digit code to reset your password."
            }
          />

          {error && (
            <div className="rounded-md bg-red-900/50 border border-red-800 p-3 text-sm text-red-200">{error}</div>
          )}
          {info && !error && (
            <div className="rounded-md bg-blue-900/40 border border-blue-800 p-3 text-sm text-blue-200">{info}</div>
          )}

          {step === "email" && (
            <form className="space-y-6" onSubmit={handleRequestCode}>
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
              <Button type="submit" className="w-full" disabled={isRequestingCode}>
                {isRequestingCode ? "Sending..." : "Send code"}
              </Button>
              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={() => router.push("/auth/login")}
                  className="font-medium text-primary hover:text-primary/80"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {step === "code" && (
            <form className="space-y-6" onSubmit={handleVerifyCode}>
              <div>
                <Label htmlFor="code" className="text-gray-300">6-digit code</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-1 bg-gray-800 border-gray-700 text-white tracking-[0.5em] text-center text-lg font-mono"
                  placeholder="------"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isVerifyingCode}>
                {isVerifyingCode ? "Verifying..." : "Verify code"}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError("");
                    setInfo("");
                  }}
                  className="font-medium text-gray-400 hover:text-white"
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isRequestingCode}
                  className="font-medium text-primary hover:text-primary/80 disabled:opacity-60"
                >
                  {isRequestingCode ? "Sending..." : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {step === "password" && (
            <form className="space-y-6" onSubmit={handleResetPassword}>
              <div>
                <Label htmlFor="new_password" className="text-gray-300">New password</Label>
                <PasswordInput
                  id="new_password"
                  name="new_password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label htmlFor="confirm_password" className="text-gray-300">Confirm password</Label>
                <PasswordInput
                  id="confirm_password"
                  name="confirm_password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isResettingPassword}>
                {isResettingPassword ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}

          {step === "done" && (
            <div className="space-y-6">
              <Button className="w-full" onClick={() => router.push("/auth/login")}>
                Back to sign in
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
