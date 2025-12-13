"use client";

import { useState } from "react";

export default function FixDietitianPage() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const email = "michaelasereoo@gmail.com";

  const checkUser = async () => {
    setChecking(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/admin/check-user?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || "Failed to check user");
    } finally {
      setChecking(false);
    }
  };

  const fixUser = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/fix-dietitian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fix user");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to fix user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Fix Dietitian Account</h1>
        <p className="text-gray-400 mb-8">
          Diagnose and fix the account for <span className="font-mono text-white">{email}</span>
        </p>

        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Step 1: Check User Status</h2>
            <button
              onClick={checkUser}
              disabled={checking}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {checking ? "Checking..." : "Check User Status"}
            </button>

            {status && (
              <div className="mt-4 space-y-4">
                <div className={`p-4 rounded-lg border ${
                  status.status === "OK" 
                    ? "bg-green-900/30 border-green-700"
                    : status.status === "NO_DB_USER"
                    ? "bg-yellow-900/30 border-yellow-700"
                    : "bg-red-900/30 border-red-700"
                }`}>
                  <p className="font-semibold mb-2">Status: {status.status}</p>
                  <p className="text-sm text-gray-300">{status.message}</p>
                </div>

                {status.authUser && (
                  <div className="bg-gray-800 p-4 rounded border border-gray-700">
                    <h3 className="font-semibold mb-2">Auth User:</h3>
                    <pre className="text-xs text-gray-300 overflow-auto">
                      {JSON.stringify(status.authUser, null, 2)}
                    </pre>
                  </div>
                )}

                {status.dbUser && (
                  <div className="bg-gray-800 p-4 rounded border border-gray-700">
                    <h3 className="font-semibold mb-2">Database User:</h3>
                    <pre className="text-xs text-gray-300 overflow-auto">
                      {JSON.stringify(status.dbUser, null, 2)}
                    </pre>
                  </div>
                )}

                {!status.dbUser && status.authUser && (
                  <div className="bg-yellow-900/30 border border-yellow-700 p-4 rounded-lg">
                    <p className="text-yellow-200 mb-2">
                      ⚠️ Database record missing! Click "Fix User" below to create it.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Step 2: Fix User Record</h2>
            <button
              onClick={fixUser}
              disabled={loading || !status}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? "Fixing..." : "Create/Update Database Record"}
            </button>

            {result && (
              <div className="mt-4 space-y-4">
                <div className="bg-green-900/30 border border-green-700 p-4 rounded-lg">
                  <p className="font-semibold text-green-200 mb-2">
                    ✅ {result.message}
                  </p>
                  <div className="bg-gray-800 p-3 rounded border border-gray-700 mt-3">
                    <h4 className="font-semibold text-sm mb-2">User Details:</h4>
                    <pre className="text-xs text-gray-300 overflow-auto">
                      {JSON.stringify(result.user, null, 2)}
                    </pre>
                  </div>
                  {result.nextSteps && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-sm mb-2">Next Steps:</h4>
                      <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                        {result.nextSteps.map((step: string, idx: number) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-700 p-4 rounded-lg">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          <div className="bg-blue-900/30 border border-blue-700 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Quick Links:</h3>
            <div className="space-y-2 text-sm">
              <p>
                • <a href="/dietitian-login" className="text-blue-400 hover:underline">
                  Dietitian Login
                </a>{" "}
                - Sign in after fixing
              </p>
              <p>
                • <a href="/dashboard" className="text-blue-400 hover:underline">
                  Dashboard
                </a>{" "}
                - Should redirect here after login
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
