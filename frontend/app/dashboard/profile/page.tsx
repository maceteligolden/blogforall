"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { validatePassword } from "@/lib/utils/password-validation";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout/breadcrumb";

export default function ProfilePage() {
  const router = useRouter();
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
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
  const [isNewPasswordValid, setIsNewPasswordValid] = useState(false);

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
      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to update profile";
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
      setSuccess("Password changed successfully!");
      setPasswordForm({
        old_password: "",
        new_password: "",
        confirm_password: "",
      });
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to change password";
      setError(errorMessage);
    }
  };

  if (profileQuery?.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb items={[{ label: "Profile" }]} />
        <h1 className="text-2xl font-display text-white mb-6">Profile Settings</h1>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto">
        {/* Tabs */}
        <div className="mb-8 flex space-x-4 border-b border-gray-800">
          <button
            onClick={() => setActiveTab("profile")}
            className={`pb-4 px-4 font-medium transition-colors ${
              activeTab === "profile"
                ? "text-primary border-b-2 border-primary"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Profile Information
          </button>
          <button
            onClick={() => setActiveTab("password")}
            className={`pb-4 px-4 font-medium transition-colors ${
              activeTab === "password"
                ? "text-primary border-b-2 border-primary"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Change Password
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 rounded-md bg-green-900/20 border border-green-800 p-4 text-sm text-green-400">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-md bg-red-900/20 border border-red-800 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Update Your Profile</h2>
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="first_name" className="text-gray-300">
                    First Name *
                  </Label>
                  <Input
                    id="first_name"
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                    className="mt-1 bg-black border-gray-700 text-white"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name" className="text-gray-300">
                    Last Name *
                  </Label>
                  <Input
                    id="last_name"
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                    className="mt-1 bg-black border-gray-700 text-white"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone_number" className="text-gray-300">
                  Phone Number
                </Label>
                <Input
                  id="phone_number"
                  value={profileForm.phone_number}
                  onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                  className="mt-1 bg-black border-gray-700 text-white"
                  type="tel"
                />
              </div>
              <div>
                <Label className="text-gray-300">Email</Label>
                <Input
                  value={user?.email || ""}
                  className="mt-1 bg-gray-800 border-gray-700 text-gray-400"
                  disabled
                />
                <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
              </div>
              <div className="flex space-x-4">
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-white"
                  disabled={isUpdatingProfile}
                >
                  {isUpdatingProfile ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                  onClick={() => router.push("/dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === "password" && (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Change Your Password</h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div>
                <Label htmlFor="old_password" className="text-gray-300">
                  Current Password *
                </Label>
                <PasswordInput
                  id="old_password"
                  value={passwordForm.old_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                  className="mt-1 bg-black border-gray-700 text-white"
                  required
                />
              </div>
              <div>
                <Label htmlFor="new_password" className="text-gray-300">
                  New Password *
                </Label>
                <PasswordInput
                  id="new_password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  className="mt-1 bg-black border-gray-700 text-white"
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
                  Confirm New Password *
                </Label>
                <PasswordInput
                  id="confirm_password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  className="mt-1 bg-black border-gray-700 text-white"
                  required
                />
                {passwordForm.confirm_password && passwordForm.new_password !== passwordForm.confirm_password && (
                  <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                )}
                {passwordForm.confirm_password && passwordForm.new_password === passwordForm.confirm_password && (
                  <p className="mt-1 text-xs text-green-500">Passwords match</p>
                )}
              </div>
              <div className="flex space-x-4">
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-white"
                  disabled={isChangingPassword || !isNewPasswordValid}
                >
                  {isChangingPassword ? "Changing..." : "Change Password"}
                </Button>
                <Button
                  type="button"
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                  onClick={() => {
                    setPasswordForm({
                      old_password: "",
                      new_password: "",
                      confirm_password: "",
                    });
                    setError("");
                  }}
                >
                  Clear
                </Button>
              </div>
            </form>
          </div>
        )}
        </main>
      </div>
    </div>
  );
}

