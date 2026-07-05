"use client";

import { useState } from "react";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WaitlistService } from "@/lib/api/services/waitlist.service";
import { cn } from "@/lib/utils/cn";

interface WaitlistEmailFormProps {
  id?: string;
  className?: string;
  inputId?: string;
}

const inputClassName =
  "min-h-[48px] w-full bg-gray-900/60 border-gray-700 text-white placeholder:text-gray-500 focus-visible:ring-primary disabled:opacity-60";

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const message = error.response?.data?.message as string | undefined;

    if (status === 409) {
      return message || "This email is already on the waitlist.";
    }
    if (status === 502) {
      return message || "Could not complete signup. Please try again.";
    }
  }

  return "Something went wrong. Please try again.";
}

export function WaitlistEmailForm({ id, className, inputId = "waitlist-email" }: WaitlistEmailFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !firstName.trim() || !lastName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await WaitlistService.joinWaitlist({
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        className={cn(
          "rounded-lg border border-primary/30 bg-primary/10 px-6 py-4 text-center",
          className
        )}
        role="status"
      >
        <p className="text-sm font-medium text-white">You&apos;re on the list.</p>
        <p className="text-sm text-gray-400 mt-1">
          Check your inbox for a confirmation email. We&apos;ll be in touch when early access opens.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("w-full max-w-lg mx-auto", className)}>
      <form id={id} onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id={`${inputId}-first-name`}
            type="text"
            autoComplete="given-name"
            placeholder="First name"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              if (error) setError(null);
            }}
            required
            disabled={isSubmitting}
            className={inputClassName}
          />
          <Input
            id={`${inputId}-last-name`}
            type="text"
            autoComplete="family-name"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              if (error) setError(null);
            }}
            required
            disabled={isSubmitting}
            className={inputClassName}
          />
        </div>
        <Input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          required
          disabled={isSubmitting}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={inputClassName}
        />
        <Button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[48px] w-full bg-primary hover:bg-primary/90 text-white px-8 font-semibold rounded-lg shadow-lg shadow-primary/20 whitespace-nowrap disabled:opacity-60"
        >
          {isSubmitting ? "Joining..." : "Get early access"}
        </Button>
      </form>
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-red-400 mt-3 text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
