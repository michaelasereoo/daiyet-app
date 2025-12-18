"use client";

import { useEffect, useState } from "react";

interface UploadProgressProps {
  isVisible: boolean;
  onComplete?: () => void;
}

export function UploadProgress({ isVisible, onComplete }: UploadProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      return;
    }

    // Fast animation from 0-100% in ~1 second
    const duration = 1000; // 1 second
    const steps = 100;
    const stepDuration = duration / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const newProgress = Math.min((currentStep / steps) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          if (onComplete) {
            onComplete();
          }
        }, 200);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-[#171717] border border-[#262626] rounded-lg p-6 min-w-[300px]">
        <div className="mb-4">
          <h3 className="text-[#f9fafb] font-semibold mb-2">Uploading PDF...</h3>
          <div className="w-full bg-[#262626] rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-75 ease-linear rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-right mt-1 text-sm text-green-400 font-medium">
            {Math.round(progress)}%
          </div>
        </div>
      </div>
    </div>
  );
}

