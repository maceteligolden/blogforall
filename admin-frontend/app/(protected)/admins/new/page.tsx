"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/toast";
import { AdminApiService } from "@/lib/api/services/admin.service";
import { useIsSuperAdmin } from "@/lib/store/auth.store";

export default function CreateAdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const isSuperAdmin = useIsSuperAdmin();
  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "admin" as "admin" | "super_admin",
  });

  useEffect(() => {
    if (!isSuperAdmin) router.replace("/");
  }, [isSuperAdmin, router]);

  const createMutation = useMutation({
    mutationFn: () => AdminApiService.createAdminUser(form),
    onSuccess: () => {
      toast({ title: "Admin created", description: "The new platform admin can sign in now.", variant: "success" });
      router.push("/");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create admin";
      toast({ title: "Creation failed", description: message, variant: "error" });
    },
  });

  if (!isSuperAdmin) return null;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Create platform admin</h1>
        <p className="mt-1 text-gray-400">Super admins only. New admins can sign in at this portal.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        className="space-y-4 rounded-lg border border-gray-800 bg-gray-900/60 p-6"
      >
        <div>
          <Label className="text-gray-300">Role</Label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "admin" | "super_admin" }))}
            className="mt-1 w-full h-10 rounded-md border border-gray-700 bg-gray-800 px-3 text-white text-sm"
          >
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>
        </div>
        <div>
          <Label htmlFor="email" className="text-gray-300">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="mt-1 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
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
        </div>
        <div>
          <Label htmlFor="password" className="text-gray-300">
            Password
          </Label>
          <PasswordInput
            id="password"
            required
            showValidation
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="mt-1 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create admin"}
        </Button>
      </form>
    </div>
  );
}
