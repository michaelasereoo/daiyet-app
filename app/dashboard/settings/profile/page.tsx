"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Bold, Italic, Link as LinkIcon } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { createBrowserClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [about, setAbout] = useState("");
  const [userProfile, setUserProfile] = useState<{ name: string; image: string | null; bio: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // Set email immediately from authenticated user (critical - must be set first)
      if (user.email) {
        setEmail(user.email);
      }

      try {
        const supabase = createBrowserClient();
        
        // Fetch user data from database
        const { data: dbUser, error } = await supabase
          .from("users")
          .select("name, email, image, bio")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
          // Fallback to auth user data
          setUserProfile({
            name: user.user_metadata?.name || user.user_metadata?.full_name || profile?.name || "Dietitian",
            image: profile?.image || user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            bio: null,
          });
          const fallbackName = user.user_metadata?.name || user.user_metadata?.full_name || profile?.name || "Dietitian";
          setFullName(fallbackName);
          setEmail(user.email || "");
          setAbout("");
          // Set username from fallback name
          if (fallbackName && fallbackName !== "Dietitian") {
            setUsername(nameToSlug(fallbackName));
          }
        } else if (dbUser) {
          // Use database data (preferred for dietitians)
          const dietitianName = dbUser.name || profile?.name || "Dietitian";
          const dietitianEmail = dbUser.email || user.email || "";
          setUserProfile({
            name: dietitianName,
            image: dbUser.image || profile?.image || null,
            bio: dbUser.bio || null,
          });
          setFullName(dietitianName);
          setEmail(dietitianEmail);
          setAbout(dbUser.bio || "");
          // Set username to dietitian-name-slug
          if (dietitianName && dietitianName !== "Dietitian") {
            setUsername(nameToSlug(dietitianName));
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        // Fallback to profile from context
        setUserProfile({
          name: profile?.name || "Dietitian",
          image: profile?.image || null,
          bio: null,
        });
        const errorFallbackName = profile?.name || "Dietitian";
        setFullName(errorFallbackName);
        setEmail(user?.email || "");
        setAbout("");
        // Set username from error fallback name
        if (errorFallbackName && errorFallbackName !== "Dietitian") {
          setUsername(nameToSlug(errorFallbackName));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [user, profile]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Convert name to URL-friendly slug
  const nameToSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')      // Replace spaces with hyphens
      .replace(/-+/g, '-');      // Replace multiple hyphens with single
  };

  // Initialize form fields from context immediately (while loading additional data)
  useEffect(() => {
    if (profile?.name && !fullName) {
      const name = profile.name;
      setFullName(name);
      if (!userProfile) {
        setUserProfile({
          name: name,
          image: profile.image,
          bio: null,
        });
      }
      // Set username from profile name (slug version)
      if (!username || username === "") {
        setUsername(nameToSlug(name));
      }
    }
    // Set email from user immediately if available and email is empty
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [profile, user, fullName, email, userProfile, username]);

  if (loading && !userProfile) {
    return (
      <div className="p-8">
        <div className="text-white">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-[#f9fafb] mb-1">Profile</h1>
        <p className="text-sm text-[#9ca3af]">
          Manage settings for your Cal.com profile
        </p>
      </div>

      <div className="space-y-8 max-w-3xl">
        {/* Profile Picture Section */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-[#D4D4D4]">
            Profile Picture
          </label>
          <div className="flex items-center gap-4">
            {userProfile?.image ? (
              <div className="w-16 h-16 rounded-full overflow-hidden">
                <Image
                  src={userProfile.image}
                  alt={userProfile.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#404040] to-[#525252] flex items-center justify-center">
                <span className="text-white text-lg font-semibold">
                  {userProfile ? getInitials(userProfile.name) : "D"}
                </span>
            </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                onClick={() => {
                  // TODO: Implement image upload
                  console.log("Upload avatar clicked");
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Avatar
              </Button>
              <Button
                variant="outline"
                className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                onClick={() => {
                  // TODO: Implement remove image
                  console.log("Remove avatar clicked");
                }}
              >
                Remove
              </Button>
            </div>
          </div>
          <p className="text-xs text-[#9ca3af]">
            Profile picture is set during enrollment and used throughout the platform.
          </p>
        </div>

        {/* Username Section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#D4D4D4]">
            Username
          </label>
          <div className="flex items-center">
            <span className="px-3 py-2 bg-[#0a0a0a] border border-r-0 border-[#262626] text-[#9ca3af] text-sm rounded-l-md">
              daiyet.co/
            </span>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled
              className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] rounded-l-none rounded-r-md focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-[#404040] opacity-50 cursor-not-allowed"
            />
          </div>
          <p className="text-xs text-[#9ca3af]">
            Tip: You can add a '+' between usernames: cal.com/anna+brian to make a dynamic group meeting
          </p>
        </div>

        {/* Full Name Section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#D4D4D4]">
            Full name
          </label>
          <Input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled
            className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-[#404040] opacity-50 cursor-not-allowed"
          />
          <p className="text-xs text-[#9ca3af]">
            Name is fixed and cannot be edited
          </p>
        </div>

        {/* Email Section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#D4D4D4]">
            Email
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled
              className="flex-1 bg-[#0a0a0a] border-[#262626] text-[#f9fafb] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-[#404040] opacity-50 cursor-not-allowed"
            />
            <span className="text-xs text-[#9ca3af] bg-[#262626] px-2 py-1 rounded">
              Primary
            </span>
          </div>
          <p className="text-xs text-[#9ca3af]">
            Email is fixed and cannot be edited
          </p>
        </div>

        {/* Professional Summary Section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#D4D4D4]">
            Professional Summary
          </label>
          <p className="text-xs text-[#9ca3af] mb-2">
            This will be displayed on your public profile when users are booking.
          </p>
          <div className="border border-[#262626] rounded-md bg-[#0a0a0a]">
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-2 border-b border-[#262626]">
              <button className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors p-1">
                <Bold className="h-4 w-4" />
              </button>
              <button className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors p-1">
                <Italic className="h-4 w-4" />
              </button>
              <button className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors p-1">
                <LinkIcon className="h-4 w-4" />
              </button>
            </div>
            {/* Textarea */}
            <Textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className="bg-transparent border-0 text-[#f9fafb] resize-none focus:outline-none focus:ring-0 min-h-[120px]"
              placeholder="Tell us about yourself..."
            />
          </div>
        </div>

      </div>
    </div>
  );
}
