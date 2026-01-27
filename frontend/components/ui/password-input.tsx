"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";
import { cn } from "@/lib/utils/cn";
import { validatePassword } from "@/lib/utils/password-validation";

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  showValidation?: boolean;
  onValidationChange?: (isValid: boolean) => void;
}

export function PasswordInput({
  className,
  showValidation = false,
  onValidationChange,
  value,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (showValidation && value && typeof value === "string") {
      const validation = validatePassword(value);
      setValidationErrors(validation.errors);
      onValidationChange?.(validation.isValid);
    } else if (showValidation && (!value || (typeof value === "string" && value.length === 0))) {
      setValidationErrors([]);
      onValidationChange?.(false);
    } else if (!showValidation) {
      setValidationErrors([]);
      onValidationChange?.(true);
    }
  }, [value, showValidation, onValidationChange]);

  return (
    <div>
      <div className="relative">
        <Input
          {...props}
          type={showPassword ? "text" : "password"}
          value={value}
          className={cn("pr-10", className)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowPassword(!showPassword);
          }}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
      {showValidation && validationErrors.length > 0 && (
        <div className="mt-1 text-xs text-red-600 dark:text-red-400">
          <p className="font-medium mb-1">Password must contain:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {showValidation && validationErrors.length === 0 && value && typeof value === "string" && value.length > 0 && (
        <p className="mt-1 text-xs text-green-600 dark:text-green-400">Password meets all requirements</p>
      )}
    </div>
  );
}
