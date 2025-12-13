"use client";

import { useState } from "react";

export default function CreateUsersPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const users = [
    {
      email: "michaelasereoo@gmail.com",
      role: "DIETITIAN",
      name: "Michael Asere (Dietitian)",
    },
    {
      email: "asereopeyemimichael@gmail.com",
      role: "ADMIN",
      name: "Michael Asere (Admin)",
    },
    {
      email: "michaelasereo@gmail.com",
      role: "USER",
      name: "Michael Asere (User)",
    },
  ];

  const handleCreateUsers = async () => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch("/api/admin/create-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create users");
      }

      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message || "Failed to create users");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create User Records</h1>
        <p className="text-gray-400 mb-8">
          This will create or update database records for the following users.
          <br />
          <span className="text-yellow-400 text-sm">
            ⚠️ Note: Users must sign in with Google at least once first to create their auth accounts.
          </span>
        </p>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Users to Create/Update:</h2>
          <div className="space-y-3">
            {users.map((user, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-700"
              >
                <div>
                  <p className="font-medium">{user.email}</p>
                  <p className="text-sm text-gray-400">{user.name}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    user.role === "ADMIN"
                      ? "bg-purple-600/20 text-purple-400"
                      : user.role === "DIETITIAN"
                      ? "bg-blue-600/20 text-blue-400"
                      : "bg-green-600/20 text-green-400"
                  }`}
                >
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreateUsers}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition-colors mb-6"
        >
          {loading ? "Creating Users..." : "Create/Update User Records"}
        </button>

        {error && (
          <div className="bg-red-900/50 border border-red-700 p-4 rounded-lg mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Results:</h2>
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  result.success
                    ? "bg-green-900/30 border-green-700"
                    : "bg-red-900/30 border-red-700"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{result.email}</p>
                    {result.success && result.user && (
                      <p className="text-sm text-gray-300 mt-1">
                        {result.action === "created" ? "✅ Created" : "✅ Updated"} - Role:{" "}
                        <span className="font-semibold">{result.user.role}</span>
                      </p>
                    )}
                  </div>
                  {result.success && (
                    <span className="text-green-400 font-semibold">✓</span>
                  )}
                  {!result.success && (
                    <span className="text-red-400 font-semibold">✗</span>
                  )}
                </div>
                {result.error && (
                  <p className="text-sm text-red-300 mt-2">{result.error}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
          <h3 className="font-semibold mb-2">Next Steps:</h3>
          <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
            <li>Make sure each user has signed in with Google at least once</li>
            <li>Click the button above to create/update their database records</li>
            <li>Users can now sign in and access their dashboards</li>
          </ol>
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Login Pages:</p>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>
                • <a href="/dietitian-login" className="text-blue-400 hover:underline">
                  Dietitian Login
                </a>{" "}
                → /dashboard
              </li>
              <li>
                • <a href="/admin-login" className="text-blue-400 hover:underline">
                  Admin Login
                </a>{" "}
                → /admin
              </li>
              <li>
                • <a href="/login" className="text-blue-400 hover:underline">
                  User Login
                </a>{" "}
                → /user-dashboard
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
