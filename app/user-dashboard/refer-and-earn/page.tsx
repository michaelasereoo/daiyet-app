"use client";

import { UserDashboardSidebar } from "@/components/layout/user-dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Gift, Share2 } from "lucide-react";

export default function ReferAndEarnPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row">
      <UserDashboardSidebar />
      <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:w-auto lg:ml-64 lg:rounded-tl-lg">
        <div className="p-8">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Refer and Earn</h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              Share your referral link and earn rewards.
            </p>
          </div>

          {/* Referral Content */}
          <div className="border border-[#262626] rounded-lg p-8 max-w-2xl">
            <Gift className="h-12 w-12 text-[#9ca3af] mb-4" />
            <h2 className="text-lg font-semibold text-[#f9fafb] mb-2">Invite Friends</h2>
            <p className="text-sm text-[#9ca3af] mb-6">
              Share your unique referral link with friends and earn rewards when they sign up.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                  Your Referral Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value="https://daiyet.com/ref/abc123"
                    className="flex-1 bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] rounded px-3 py-2 text-sm"
                  />
                  <Button
                    variant="outline"
                    className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
