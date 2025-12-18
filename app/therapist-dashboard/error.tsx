'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

/**
 * Error Boundary for Dashboard Routes
 * 
 * Catches errors during RSC (React Server Component) rendering and navigation.
 * This includes:
 * - RSC fetch failures during client-side navigation
 * - Server component rendering errors
 * - Authentication errors during server-side rendering
 * - Database query failures
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error for debugging (in production, send to error tracking service)
    console.error('Dashboard Error Boundary:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  // Determine error type for better UX
  const isAuthError = 
    error.message.includes('auth') ||
    error.message.includes('unauthorized') ||
    error.message.includes('session') ||
    error.digest?.includes('AUTH');

  const isRSCError = 
    error.message.includes('RSC') ||
    error.message.includes('Failed to fetch') ||
    error.message.includes('fetch failed');

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#171717] border border-[#374151] rounded-lg p-8 space-y-6">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
        </div>

        {/* Error Message */}
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-[#f9fafb]">
            {isAuthError 
              ? 'Authentication Error'
              : isRSCError
              ? 'Connection Error'
              : 'Something went wrong'}
          </h1>
          <p className="text-sm text-[#9ca3af]">
            {isAuthError
              ? 'Your session may have expired. Please sign in again.'
              : isRSCError
              ? 'Failed to load page data. This might be a network issue.'
              : 'An unexpected error occurred while loading the dashboard.'}
          </p>
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 text-left">
              <summary className="text-xs text-[#6b7280] cursor-pointer hover:text-[#9ca3af]">
                Technical Details
              </summary>
              <pre className="mt-2 text-xs text-[#6b7280] bg-[#0a0a0a] p-3 rounded overflow-auto max-h-40">
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            </details>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => reset()}
            className="w-full bg-white hover:bg-gray-100 text-black"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          
          {isAuthError ? (
            <Link href="/therapist-login">
              <Button
                variant="outline"
                className="w-full border-[#374151] text-[#D4D4D4] hover:bg-[#374151]"
              >
                Go to Login
              </Button>
            </Link>
          ) : (
            <Link href="/therapist-dashboard">
              <Button
                variant="outline"
                className="w-full border-[#374151] text-[#D4D4D4] hover:bg-[#374151]"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            </Link>
          )}
        </div>

        {/* Help Text */}
        <p className="text-xs text-center text-[#6b7280]">
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}
