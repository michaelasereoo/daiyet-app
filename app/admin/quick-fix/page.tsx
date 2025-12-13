"use client";

import { useState } from "react";
import { createComponentClient } from "@/lib/supabase/client";

export default function QuickFixPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);

  const supabase = createComponentClient();

  const checkCurrentUser = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Not signed in. Please sign in first.");
        setLoading(false);
        return;
      }

      // Check user in database
      const response = await fetch("/api/fix-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check" }),
      });

      const data = await response.json();
      setUserInfo({
        authId: session.user.id,
        email: session.user.email,
        authUser: data.authUser,
        dbUser: data.dbUser,
        exists: data.exists,
        role: data.role,
        status: data.status,
      });

      if (data.dbUser) {
        setMessage(
          `✅ User found!\n\n` +
            `Email: ${data.dbUser.email || session.user.email}\n` +
            `Role: ${data.dbUser.role || "Not set"}\n` +
            `Status: ${data.dbUser.account_status || "Not set"}\n\n` +
            `${data.dbUser.role === "DIETITIAN" ? "✅ You can access /dashboard" : "⚠️ Role is not DIETITIAN - click 'Update Role' button"}`
        );
      } else {
        setMessage(
          `⚠️ User record not found in database.\n` +
            `Auth user exists: ${data.authUser ? "Yes" : "No"}\n\n` +
            `Please create user record first.`
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to check user");
    } finally {
      setLoading(false);
    }
  };

  const updateToDietitian = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/fix-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-role", role: "DIETITIAN" }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(
          `✅ Success! Role updated to DIETITIAN.\n` +
            `You can now access /dashboard\n\n` +
            `Redirecting in 3 seconds...`
        );
        
        // Redirect after 3 seconds
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 3000);
      } else {
        setError(data.error || "Failed to update role");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  const createUserRecord = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/fix-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }), // No email needed - uses session
      });

      const data = await response.json();

      if (data.success) {
        setMessage(
          `✅ User record created!\n` +
            `Email: ${data.user?.email}\n` +
            `Role: ${data.user?.role}\n\n` +
            `Now you can update the role to DIETITIAN.`
        );
        setUserInfo({
          ...userInfo,
          dbUser: data.user,
          exists: true,
          role: data.user?.role,
        });
      } else {
        setError(data.error || "Failed to create user");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Quick Fix - User Role Manager</h1>
        <p className="text-gray-400 mb-8">
          Use this tool to check your current user status and update your role to
          DIETITIAN so you can access the dashboard.
        </p>

        <div className="space-y-4">
          <button
            onClick={checkCurrentUser}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? "Checking..." : "1. Check Current User Status"}
          </button>

          {userInfo && (
            <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
              <h3 className="font-semibold mb-2">Current Status:</h3>
              <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(userInfo, null, 2)}
              </pre>
            </div>
          )}

          {!userInfo?.dbUser && (
            <button
              onClick={createUserRecord}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? "Creating..." : "2. Create User Record (if missing)"}
            </button>
          )}

          <button
            onClick={updateToDietitian}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? "Updating..." : "3. Update Role to DIETITIAN"}
          </button>

          {message && (
            <div className="bg-green-900/50 border border-green-700 p-4 rounded-lg">
              <pre className="text-sm text-green-200 whitespace-pre-wrap">
                {message}
              </pre>
            </div>
          )}

          {error && (
            <div className="bg-red-900/50 border border-red-700 p-4 rounded-lg">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          <div className="mt-8 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
            <h3 className="font-semibold mb-2">Alternative: Complete Enrollment</h3>
            <p className="text-sm text-gray-300 mb-3">
              You can also complete the full dietitian enrollment form:
            </p>
            <a
              href="/dietitian-enrollment"
              className="inline-block bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Go to Enrollment →
            </a>
          </div>

          <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
            <h3 className="font-semibold mb-2">After Updating Role:</h3>
            <p className="text-sm text-gray-300">
              Once your role is set to DIETITIAN, you can access:
            </p>
            <ul className="text-sm text-gray-300 mt-2 list-disc list-inside space-y-1">
              <li>
                <a href="/dashboard" className="text-blue-400 hover:underline">
                  /dashboard
                </a>{" "}
                - Main dashboard
              </li>
              <li>
                <a
                  href="/dashboard/settings"
                  className="text-blue-400 hover:underline"
                >
                  /dashboard/settings
                </a>{" "}
                - Settings
              </li>
              <li>
                <a
                  href="/dashboard/event-types"
                  className="text-blue-400 hover:underline"
                >
                  /dashboard/event-types
                </a>{" "}
                - Manage event types
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
