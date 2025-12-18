"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, FileText, CheckCircle, XCircle } from "lucide-react";

export default function TestStoragePage() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<{
    fileUrl: string;
    fileName: string;
    storagePath: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploading(true);
      setUploadProgress(0);
      setError(null);
      setUploadedFile(null);

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 100);

        // Upload file
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/meal-plans/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || errorData.error || "Upload failed");
        }

        const data = await response.json();
        setUploadedFile({
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          storagePath: data.storagePath,
        });
      } catch (err) {
        console.error("Upload error:", err);
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        setTimeout(() => setUploadProgress(0), 1000);
      }
    };
    input.click();
  };

  const handleClear = async () => {
    if (!uploadedFile) return;

    setDeleting(true);
    setError(null);

    try {
      // Extract the storage path from the file URL
      // URL format: https://[project].supabase.co/storage/v1/object/public/meal-plans/[path]
      const urlParts = uploadedFile.fileUrl.split("/meal-plans/");
      const storagePath = urlParts[1];

      if (!storagePath) {
        throw new Error("Could not extract storage path from URL");
      }

      // Delete from storage
      const response = await fetch("/api/meal-plans/delete", {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ storagePath }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Delete failed");
      }

      setUploadedFile(null);
      alert("File deleted successfully!");
    } catch (err) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-[#f9fafb] mb-6">Storage Bucket Test Page</h1>

        <div className="bg-[#171717] border border-[#262626] rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#f9fafb] mb-4">Upload PDF to Storage</h2>
          
          <div className="space-y-4">
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-white hover:bg-gray-100 text-black px-6 py-3"
            >
              <Upload className="h-5 w-5 mr-2" />
              {uploading ? "Uploading..." : "Select PDF to Upload"}
            </Button>

            {uploading && (
              <div className="space-y-2">
                <div className="w-full bg-[#262626] rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-[#9ca3af] text-center">{uploadProgress}%</p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="h-5 w-5" />
                  <p className="font-semibold">Error</p>
                </div>
                <p className="text-sm text-red-300 mt-2">{error}</p>
              </div>
            )}

            {uploadedFile && (
              <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-400 mb-3">
                  <CheckCircle className="h-5 w-5" />
                  <p className="font-semibold">Upload Successful!</p>
                </div>
                <div className="space-y-2 text-sm text-[#d1d5db]">
                  <p>
                    <span className="text-[#9ca3af]">File Name:</span> {uploadedFile.fileName}
                  </p>
                  <p>
                    <span className="text-[#9ca3af]">Storage Path:</span> {uploadedFile.storagePath}
                  </p>
                  <p>
                    <span className="text-[#9ca3af]">File URL:</span>{" "}
                    <a
                      href={uploadedFile.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline break-all"
                    >
                      {uploadedFile.fileUrl}
                    </a>
                  </p>
                  <div className="flex items-center gap-4 mt-4">
                    <Button
                      onClick={() => window.open(uploadedFile.fileUrl, "_blank")}
                      variant="outline"
                      className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717]"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View PDF
                    </Button>
                    <Button
                      onClick={handleClear}
                      disabled={deleting}
                      variant="outline"
                      className="bg-transparent border-red-800 text-red-400 hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleting ? "Deleting..." : "Clear/Delete"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#171717] border border-[#262626] rounded-lg p-6">
          <h2 className="text-lg font-semibold text-[#f9fafb] mb-4">Test Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-[#9ca3af]">
            <li>Click "Select PDF to Upload" to choose a PDF file</li>
            <li>Watch the upload progress (should go from 0% to 100%)</li>
            <li>If successful, you'll see the file URL and can view the PDF</li>
            <li>Click "Clear/Delete" to remove the file from storage</li>
            <li>Check the browser console for any errors</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

