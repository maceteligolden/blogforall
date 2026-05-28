"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";
import { useAuthStore } from "@/lib/store/auth.store";

export default function ProfilePage() {
  const { toast } = useToast();
  const { profileQuery, updateProfile, isUpdatingProfile } = useAdminAuth();
  const { user, updateUser } = useAuthStore();
  const [form, setForm] = useState({ first_name: "", last_name: "", phone_number: "" });

  useEffect(() => {
    const source = profileQuery.data ?? user;
    if (source) {
      setForm({
        first_name: source.first_name || "",
        last_name: source.last_name || "",
        phone_number: (source as { phone_number?: string }).phone_number || "",
      });
    }
  }, [profileQuery.data, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(form, {
      onSuccess: () => {
        updateUser(form);
        toast({ title: "Profile updated", description: "Your changes have been saved.", variant: "success" });
      },
      onError: (err: unknown) => {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Failed to update profile";
        toast({ title: "Update failed", description: message, variant: "error" });
      },
    });
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="mt-1 text-gray-400">Update your admin account details.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-800 bg-gray-900/60 p-6">
        <div>
          <Label htmlFor="email" className="text-gray-300">
            Email
          </Label>
          <Input
            id="email"
            value={user?.email ?? profileQuery.data?.email ?? ""}
            disabled
            className="mt-1 bg-gray-800/50 border-gray-700 text-gray-400"
          />
        </div>
        <div>
          <Label htmlFor="first_name" className="text-gray-300">
            First name
          </Label>
          <Input
            id="first_name"
            required
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            className="mt-1 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <div>
          <Label htmlFor="last_name" className="text-gray-300">
            Last name
          </Label>
          <Input
            id="last_name"
            required
            value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            className="mt-1 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <div>
          <Label htmlFor="phone" className="text-gray-300">
            Phone (optional)
          </Label>
          <Input
            id="phone"
            value={form.phone_number}
            onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
            className="mt-1 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <Button type="submit" disabled={isUpdatingProfile}>
          {isUpdatingProfile ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
