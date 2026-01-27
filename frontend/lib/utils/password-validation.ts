export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  hasMinLength: boolean;
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const hasMinLength = password.length >= 8;

  if (!hasLowercase) {
    errors.push("At least one lowercase letter");
  }
  if (!hasUppercase) {
    errors.push("At least one uppercase letter");
  }
  if (!hasNumber) {
    errors.push("At least one number");
  }
  if (!hasSymbol) {
    errors.push("At least one symbol");
  }
  if (!hasMinLength) {
    errors.push("At least 8 characters");
  }

  return {
    isValid: errors.length === 0,
    errors,
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSymbol,
    hasMinLength,
  };
}
