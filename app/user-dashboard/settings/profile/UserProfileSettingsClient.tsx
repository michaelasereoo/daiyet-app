"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Upload } from "lucide-react";

interface UserProfileSettingsClientProps {
  initialUserProfile: {
    name: string;
    email: string;
    image: string | null;
  };
}

export default function UserProfileSettingsClient({ initialUserProfile }: UserProfileSettingsClientProps) {
  const [userProfile] = useState(initialUserProfile);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div>
      {/* Header Section */}
      <div className="mb-6">
        <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Profile</h1>
        <p className="text-[13px] text-[#9ca3af] mb-6">
          Manage your profile information.
        </p>
      </div>

      {/* Profile Form */}
      <div className="space-y-6 max-w-2xl">
        {/* Profile Picture */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#D4D4D4]">
            Profile Picture
          </label>
          <div className="flex items-center gap-4">
            {userProfile?.image ? (
              <div className="w-20 h-20 rounded-full overflow-hidden">
                <Image
                  src={userProfile.image}
                  alt={userProfile.name}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#404040] to-[#525252] flex items-center justify-center">
                {userProfile ? (
                  <span className="text-white text-lg font-semibold">
                    {getInitials(userProfile.name)}
                  </span>
                ) : (
                  <User className="h-10 w-10 text-[#9ca3af]" />
                )}
              </div>
            )}
            <Button
              variant="outline"
              className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
              onClick={() => {
                // TODO: Implement avatar upload
                console.log("Upload avatar clicked");
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Photo
            </Button>
          </div>
          <p className="text-xs text-[#9ca3af]">
            Upload a new profile picture to replace your current one.
          </p>
        </div>

        {/* Full Name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#D4D4D4]">
            Full Name
          </label>
          <Input
            type="text"
            value={userProfile?.name || ""}
            disabled
            className="bg-[#0a0a0a] border-[#262626] text-[#9ca3af] opacity-50 cursor-not-allowed"
          />
          <p className="text-xs text-[#9ca3af]">
            Name is synced from your Google account.
          </p>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#D4D4D4]">
            Email
          </label>
          <Input
            type="email"
            value={userProfile?.email || ""}
            disabled
            className="bg-[#0a0a0a] border-[#262626] text-[#9ca3af] opacity-50 cursor-not-allowed"
          />
          <p className="text-xs text-[#9ca3af]">
            Email is synced from your Google account.
          </p>
        </div>
      </div>
    </div>
  );
}
