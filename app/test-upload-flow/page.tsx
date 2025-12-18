"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, FileText } from "lucide-react";

export default function TestUploadFlowPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUnapproveAll = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/debug/unapprove-all-meal-plans", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to unapprove");
      }

      setResult(data);
      alert(`Successfully unapproved ${data.unapprovedCount || 0} meal plan request(s)!`);
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "Failed to unapprove");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckFlow = async () => {
    const requestId = prompt("Enter the session request ID to check:");
    if (!requestId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/debug/upload-flow?requestId=${requestId}`, {
        method: "GET",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to check flow");
      }

      setResult(data);
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "Failed to check flow");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-[#f9fafb] mb-6">Upload Flow Test Page</h1>

        <div className="space-y-4">
          <div className="bg-[#171717] border border-[#262626] rounded-lg p-6">
            <h2 className="text-lg font-semibold text-[#f9fafb] mb-4">Unapprove All Meal Plan Requests</h2>
            <p className="text-sm text-[#9ca3af] mb-4">
              This will set all approved meal plan requests back to PENDING so you can re-upload.
            </p>
            <Button
              onClick={handleUnapproveAll}
              disabled={loading}
              className="bg-white hover:bg-gray-100 text-black px-6 py-3"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Unapproving..." : "Unapprove All Meal Plans"}
            </Button>
          </div>

          <div className="bg-[#171717] border border-[#262626] rounded-lg p-6">
            <h2 className="text-lg font-semibold text-[#f9fafb] mb-4">Check Upload Flow</h2>
            <p className="text-sm text-[#9ca3af] mb-4">
              Enter a session request ID to check the upload flow state and debug information.
            </p>
            <Button
              onClick={handleCheckFlow}
              disabled={loading}
              variant="outline"
              className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-6 py-3"
            >
              <FileText className="h-5 w-5 mr-2" />
              Check Flow
            </Button>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="h-5 w-5" />
                <p className="font-semibold">Error</p>
              </div>
              <p className="text-sm text-red-300 mt-2">{error}</p>
            </div>
          )}

          {result && (
            <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-400 mb-3">
                <CheckCircle className="h-5 w-5" />
                <p className="font-semibold">Success</p>
              </div>
              <pre className="text-xs text-[#d1d5db] overflow-auto max-h-96 bg-[#0a0a0a] p-4 rounded">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="bg-[#171717] border border-[#262626] rounded-lg p-6 mt-6">
          <h2 className="text-lg font-semibold text-[#f9fafb] mb-4">Quick Actions</h2>
          <p className="text-sm text-[#9ca3af] mb-4">
            After unapproving, go to the session requests page and re-upload the PDF. 
            Check the browser console and server logs for detailed debug information at each step.
          </p>
          <div className="space-y-2 text-sm text-[#9ca3af]">
            <p>1. Click "Unapprove All Meal Plans" above</p>
            <p>2. Go to <code className="bg-[#0a0a0a] px-2 py-1 rounded">/dashboard/session-request</code></p>
            <p>3. Click "Upload PDF" on the meal plan request</p>
            <p>4. Check console logs for debug information</p>
            <p>5. Use "Check Flow" to verify the upload state</p>
          </div>
        </div>
      </div>
    </div>
  );
}

