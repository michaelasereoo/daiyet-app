'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * Error Boundary for Session Request Page
 * 
 * Specifically handles errors in the session-request route, including:
 * - RSC fetch failures
 * - API connection errors
 * - Authentication errors
 */
export default function SessionRequestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Session Request Error:', {
      message: error.message,
      digest: error.digest,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  const isRSCError = 
    error.message.includes('RSC') ||
    error.message.includes('Failed to fetch') ||
    error.message.includes('fetch failed');

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#171717] border border-[#374151] rounded-lg p-8 space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-yellow-900/20 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-yellow-400" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-[#f9fafb]">
            {isRSCError ? 'Connection Error' : 'Error Loading Session Requests'}
          </h1>
          <p className="text-sm text-[#9ca3af]">
            {isRSCError
              ? 'Failed to load session request data. Please check your connection and try again.'
              : 'An error occurred while loading session requests.'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => reset()}
            className="w-full bg-white hover:bg-gray-100 text-black"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          
          <Link href="/dashboard">
            <Button
              variant="outline"
              className="w-full border-[#374151] text-[#D4D4D4] hover:bg-[#374151]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
