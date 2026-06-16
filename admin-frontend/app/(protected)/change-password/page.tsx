"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/toast";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";
import { validatePassword } from "@/lib/utils/password-validation";

export default function ChangePasswordPage() {
  const { toast } = useToast();
  const { changePassword, isChangingPassword } = useAdminAuth();
  const [form, setForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.old_password || !form.new_password || !form.confirm_password) {
      toast({ title: "Missing fields", description: "All password fields are required.", variant: "error" });
      return;
    }

    const validation = validatePassword(form.new_password);
    if (!validation.isValid) {
      toast({ title: "Weak password", description: "New password does not meet requirements.", variant: "error" });
      return;
    }

    if (form.new_password !== form.confirm_password) {
      toast({ title: "Mismatch", description: "New passwords do not match.", variant: "error" });
      return;
    }

    changePassword(
      { old_password: form.old_password, new_password: form.new_password },
      {
        onSuccess: () => {
          setForm({ old_password: "", new_password: "", confirm_password: "" });
          toast({ title: "Password updated", description: "Your password has been changed.", variant: "success" });
        },
        onError: (err: unknown) => {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            "Failed to change password";
          toast({ title: "Update failed", description: message, variant: "error" });
        },
      }
    );
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Change password</h1>
        <p className="mt-1 text-gray-400">Use a strong, unique password for your admin account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-800 bg-gray-900/60 p-6">
        <div>
          <Label htmlFor="old_password" className="text-gray-300">
            Current password
          </Label>
          <PasswordInput
            id="old_password"
            required
            value={form.old_password}
            onChange={(e) => setForm((f) => ({ ...f, old_password: e.target.value }))}
            className="mt-1 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <div>
          <Label htmlFor="new_password" className="text-gray-300">
            New password
          </Label>
          <PasswordInput
            id="new_password"
            required
            showValidation
            value={form.new_password}
            onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
            className="mt-1 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <div>
          <Label htmlFor="confirm_password" className="text-gray-300">
            Confirm new password
          </Label>
          <PasswordInput
            id="confirm_password"
            required
            value={form.confirm_password}
            onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
            className="mt-1 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <Button type="submit" disabled={isChangingPassword}>
          {isChangingPassword ? "Updating..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}
