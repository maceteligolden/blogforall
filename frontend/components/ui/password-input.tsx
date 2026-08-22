"use client";

import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils/cn";
import { validatePassword } from "@/lib/utils/password-validation";

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  showValidation?: boolean;
  onValidationChange?: (isValid: boolean) => void;
}

const PASSWORD_RULES = [
  { key: "hasMinLength", label: "At least 8 characters" },
  { key: "hasLowercase", label: "1 lowercase letter" },
  { key: "hasUppercase", label: "1 uppercase letter" },
  { key: "hasNumber", label: "1 number" },
  { key: "hasSymbol", label: "1 symbol" },
] as const;

export function PasswordInput({
  className,
  showValidation = false,
  onValidationChange,
  value,
  onChange,
  disabled,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const password = typeof value === "string" ? value : "";
  const validation = validatePassword(password);

  useEffect(() => {
    onValidationChange?.(showValidation ? validation.isValid : true);
  }, [password, showValidation, validation.isValid, onValidationChange]);

  return (
    <div>
      <div className="relative">
        <Input
          {...props}
          disabled={disabled}
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={onChange}
          className={cn("pr-10", className)}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="absolute inset-y-0 right-0 z-20 flex w-10 items-center justify-center text-gray-400 hover:text-white disabled:opacity-50"
          onClick={() => setShowPassword((visible) => !visible)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
        >
          {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {showValidation && (
        <ul className="mt-2 space-y-1" aria-live="polite">
          {PASSWORD_RULES.map((rule) => {
            const met = validation[rule.key];
            return (
              <li
                key={rule.key}
                className={cn("flex items-center gap-2 text-xs", met ? "text-green-400" : "text-gray-500")}
              >
                {met ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
                {rule.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
