"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { validatePassword } from "@/lib/utils/password-validation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { captureEvent } from "@/lib/analytics/posthog";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { DeveloperDocsBanner } from "@/components/settings/developer-docs-banner";
import { ApiKeysPanel } from "@/components/settings/api-keys-panel";
import { BusinessContextPanel } from "@/components/settings/business-context-panel";
import { cn } from "@/lib/utils/cn";

type SettingsTab = "profile" | "password" | "business" | "developer";

const TAB_LABELS: Record<SettingsTab, string> = {
  profile: "Profile",
  password: "Password",
  business: "Business",
  developer: "Developer",
};

function parseTab(value: string | null): SettingsTab {
  if (value === "password" || value === "business" || value === "developer") return value;
  return "profile";
}

function ProfileSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const { user, updateProfile, changePassword, profileQuery, isUpdatingProfile, isChangingPassword } = useAuth();
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isNewPasswordValid, setIsNewPasswordValid] = useState(false);

  const setTab = (tab: SettingsTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "profile") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.replace(qs ? `/dashboard/profile?${qs}` : "/dashboard/profile", { scroll: false });
    setError("");
    setSuccess("");
  };

  useEffect(() => {
    if (user) {
      setProfileForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone_number: user.phone_number || "",
      });
    }
  }, [user]);

  useEffect(() => {
    if (profileQuery?.data) {
      const profileData = profileQuery.data;
      setProfileForm({
        first_name: profileData.first_name || "",
        last_name: profileData.last_name || "",
        phone_number: profileData.phone_number || "",
      });
    }
  }, [profileQuery?.data]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!profileForm.first_name || !profileForm.last_name) {
      setError("First name and last name are required");
      return;
    }

    try {
      updateProfile(profileForm);
      captureEvent(AnalyticsEvents.PROFILE_UPDATED);
      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to update profile";
      setError(errorMessage);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!passwordForm.old_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      setError("All password fields are required");
      return;
    }

    const passwordValidation = validatePassword(passwordForm.new_password);
    if (!passwordValidation.isValid) {
      setError("New password does not meet the requirements. Please check the password criteria.");
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError("New passwords do not match");
      return;
    }

    try {
      changePassword({
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      captureEvent(AnalyticsEvents.PASSWORD_CHANGED);
      setSuccess("Password changed successfully!");
      setPasswordForm({
        old_password: "",
        new_password: "",
        confirm_password: "",
      });
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to change password";
      setError(errorMessage);
    }
  };

  if (profileQuery?.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
        <Breadcrumb items={[{ label: "Settings" }]} />
        <h1 className="mb-6 font-display text-2xl text-white">Settings</h1>

        <main className="mx-auto max-w-4xl">
          <div className="mb-8 flex gap-1 overflow-x-auto border-b border-gray-800">
            {(Object.keys(TAB_LABELS) as SettingsTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTab(tab)}
                className={cn(
                  "shrink-0 px-4 pb-4 font-medium transition-colors",
                  activeTab === tab ? "border-b-2 border-primary text-primary" : "text-gray-400 hover:text-white"
                )}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {activeTab !== "developer" && activeTab !== "business" && success && (
            <div className="mb-6 rounded-md border border-green-800 bg-green-900/20 p-4 text-sm text-green-400">
              {success}
            </div>
          )}
          {activeTab !== "developer" && activeTab !== "business" && error && (
            <div className="mb-6 rounded-md border border-red-800 bg-red-900/20 p-4 text-sm text-red-400">{error}</div>
          )}

          {activeTab === "profile" && (
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
              <h2 className="mb-6 text-xl font-semibold text-white">Profile information</h2>
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <Label htmlFor="first_name" className="text-gray-300">
                      First name *
                    </Label>
                    <Input
                      id="first_name"
                      value={profileForm.first_name}
                      onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                      className="mt-1 border-gray-700 bg-black text-white"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name" className="text-gray-300">
                      Last name *
                    </Label>
                    <Input
                      id="last_name"
                      value={profileForm.last_name}
                      onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                      className="mt-1 border-gray-700 bg-black text-white"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone_number" className="text-gray-300">
                    Phone number
                  </Label>
                  <Input
                    id="phone_number"
                    value={profileForm.phone_number}
                    onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                    className="mt-1 border-gray-700 bg-black text-white"
                    type="tel"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Email</Label>
                  <Input
                    value={user?.email || ""}
                    className="mt-1 border-gray-700 bg-gray-800 text-gray-400"
                    disabled
                  />
                  <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                </div>
                <Button
                  type="submit"
                  className="bg-primary text-white hover:bg-primary/90"
                  disabled={isUpdatingProfile}
                >
                  {isUpdatingProfile ? "Saving..." : "Save changes"}
                </Button>
              </form>
            </div>
          )}

          {activeTab === "password" && (
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
              <h2 className="mb-6 text-xl font-semibold text-white">Change password</h2>
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="old_password" className="text-gray-300">
                    Current password *
                  </Label>
                  <PasswordInput
                    id="old_password"
                    value={passwordForm.old_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                    className="mt-1 border-gray-700 bg-black text-white"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="new_password" className="text-gray-300">
                    New password *
                  </Label>
                  <PasswordInput
                    id="new_password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    className="mt-1 border-gray-700 bg-black text-white"
                    required
                    showValidation={true}
                    onValidationChange={setIsNewPasswordValid}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Password must contain: 1 lowercase, 1 uppercase, 1 number, 1 symbol, and at least 8 characters
                  </p>
                </div>
                <div>
                  <Label htmlFor="confirm_password" className="text-gray-300">
                    Confirm new password *
                  </Label>
                  <PasswordInput
                    id="confirm_password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    className="mt-1 border-gray-700 bg-black text-white"
                    required
                  />
                  {passwordForm.confirm_password && passwordForm.new_password !== passwordForm.confirm_password && (
                    <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                  )}
                  {passwordForm.confirm_password && passwordForm.new_password === passwordForm.confirm_password && (
                    <p className="mt-1 text-xs text-green-500">Passwords match</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="bg-primary text-white hover:bg-primary/90"
                  disabled={isChangingPassword || !isNewPasswordValid}
                >
                  {isChangingPassword ? "Changing..." : "Change password"}
                </Button>
              </form>
            </div>
          )}

          {activeTab === "business" && (
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
              <BusinessContextPanel />
            </div>
          )}

          {activeTab === "developer" && (
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
              <DeveloperDocsBanner />
              <ApiKeysPanel />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            <p className="text-gray-400">Loading settings...</p>
          </div>
        </div>
      }
    >
      <ProfileSettingsContent />
    </Suspense>
  );
}
