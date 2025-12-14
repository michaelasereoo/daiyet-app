"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Bold, Italic, Link as LinkIcon } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { dietitianService } from "@/lib/dietitian-service";
import { DietitianProfile } from "@/types";
import { setupRealtimeUpdates } from "@/lib/realtime-updates";

// DEV MODE: Hardcoded dietitian user ID for localhost testing
const DEV_DIETITIAN_ID = 'b900e502-71a6-45da-bde6-7b596cc14d88';
const isDev = process.env.NODE_ENV === 'development';

export default function ProfilePage() {
  const { user, setProfileDirect } = useAuth();
  const [profile, setProfile] = useState<DietitianProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Get effective user ID (real user or dev mode fallback)
  const effectiveUserId = user?.id || (isDev ? DEV_DIETITIAN_ID : null);

  // Fetch profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!effectiveUserId) return;
      
      setLoading(true);
      try {
        // SINGLE SERVICE CALL - gets everything from database
        const data = await dietitianService.getDietitianProfile(effectiveUserId);
        
        // If name or email is missing from database, fallback to Google auth metadata
        if ((!data.name || data.name.trim() === '') || (!data.email || data.email.trim() === '')) {
          try {
            const { createBrowserClient } = await import("@/lib/supabase/client");
            const supabase = createBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session?.user) {
              const googleName = 
                session.user.user_metadata?.name ||
                session.user.user_metadata?.full_name ||
                null;
              
              const googleEmail = session.user.email || null;
              
              // Use database data with Google auth fallback
              setProfile({
                ...data,
                name: data.name || googleName || '',
                email: data.email || googleEmail || '',
              });
            } else {
              setProfile(data);
            }
          } catch (authError) {
            console.warn('Failed to fetch auth metadata, using database data:', authError);
            setProfile(data);
          }
        } else {
          setProfile(data);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
        setSaveError('Failed to load profile. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    
    loadProfile();
  }, [effectiveUserId]);

  // Setup real-time updates
  useEffect(() => {
    if (!effectiveUserId) return;
    
    const unsubscribe = setupRealtimeUpdates(effectiveUserId, () => {
      // Refresh profile when real-time update is received
      dietitianService.getDietitianProfile(effectiveUserId, true).then(setProfile).catch(console.error);
    });
    
    return unsubscribe;
  }, [effectiveUserId]);

  // Convert name to URL-friendly slug
  const nameToSlug = (name: string): string => {
    if (!name) return "";
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const getInitials = (name: string) => {
    if (!name) return "D";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Handle name update
  const handleSaveName = async () => {
    if (!effectiveUserId || !profile) {
      console.error('Cannot save: missing user or profile', { hasUserId: !!effectiveUserId, hasProfile: !!profile });
      return;
    }

    if (!profile.name || profile.name.trim().length === 0) {
      setSaveError('Name cannot be empty');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const newName = profile.name.trim();
      console.log('Saving name:', { userId: effectiveUserId, name: newName });

      const result = await dietitianService.updateProfile(effectiveUserId, { name: newName });
      
      // Update local state
      if (result.data) {
        const updatedProfile = { 
          ...profile, 
          name: newName,
          updatedAt: result.data.updated_at 
        };
        setProfile(updatedProfile);
        
        // Update AuthProvider context so name reflects throughout the app (sidebar, etc.)
        setProfileDirect({ name: newName, image: profile.image || null });
      }
      
      setSaveSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Failed to save name:', error);
      const errorMessage = error?.message || error?.details || 'Unknown error';
      setSaveError(`Failed to save name: ${errorMessage}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  // Handle bio update
  const handleSaveBio = async () => {
    if (!effectiveUserId || !profile) {
      console.error('Cannot save: missing user or profile', { hasUserId: !!effectiveUserId, hasProfile: !!profile });
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      console.log('Saving bio:', { userId: effectiveUserId, bioLength: profile.bio?.length || 0 });

      const result = await dietitianService.updateProfile(effectiveUserId, { bio: profile.bio ?? undefined });
      
      // Update local state with the saved bio (optimistic update)
      if (result.data) {
        setProfile(prev => prev ? { 
          ...prev, 
          bio: result.data.bio,
          updatedAt: result.data.updated_at 
        } : null);
      }
      
      setSaveSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Failed to save bio:', error);
      const errorMessage = error?.message || error?.details || 'Unknown error';
      setSaveError(`Failed to save professional summary: ${errorMessage}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  // Show loading only if we're actually loading and don't have profile data yet
  if (loading) {
    console.log("[DEBUG] Rendering loading screen");
    return (
      <div className="p-8">
        <div className="text-white">Loading profile...</div>
        <div className="text-xs text-gray-400 mt-2">If this persists, check browser console for errors.</div>
        <div className="text-xs text-gray-500 mt-1">Check browser console for [DEBUG] messages.</div>
      </div>
    );
  }

  console.log("[DEBUG] Rendering profile form (loading is false)");
  // If loading is false but no userProfile, still render the form with empty/default values
  // This prevents infinite loading state

  return (
    <div>
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
            {profile?.image ? (
              <div className="w-16 h-16 rounded-full overflow-hidden">
                <Image
                  src={profile.image}
                  alt={profile?.name || 'Profile'}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#404040] to-[#525252] flex items-center justify-center">
                <span className="text-white text-lg font-semibold">
                  {profile?.name ? getInitials(profile.name) : "D"}
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
              value={nameToSlug(profile?.name || '')}
              onChange={() => {}}
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
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={profile?.name || ''}
              onChange={(e) => setProfile(prev => prev ? { ...prev, name: e.target.value } : null)}
              className="flex-1 bg-[#0a0a0a] border-[#262626] text-[#f9fafb] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-[#404040]"
              placeholder="Enter your full name"
            />
            <Button
              onClick={handleSaveName}
              disabled={saving || !profile?.name?.trim()}
              className="bg-white hover:bg-gray-100 text-black px-4 py-2 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
          <p className="text-xs text-[#9ca3af]">
            Your name will be displayed throughout the app and to users booking with you
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
              value={profile?.email || ''}
              onChange={() => {}}
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
              value={profile?.bio || ''}
              onChange={(e) => setProfile(prev => prev ? { ...prev, bio: e.target.value } : null)}
              className="bg-transparent border-0 text-[#f9fafb] resize-none focus:outline-none focus:ring-0 min-h-[120px]"
              placeholder="Tell us about yourself..."
            />
          </div>
          
          {/* Save Button and Messages */}
          <div className="flex items-center gap-3 mt-3">
            <Button
              onClick={handleSaveBio}
              disabled={saving}
              className="bg-white hover:bg-gray-100 text-black px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            {saveSuccess && (
              <span className="text-sm text-green-400">
                Professional summary saved successfully!
              </span>
            )}
            {saveError && (
              <span className="text-sm text-red-400">
                {saveError}
              </span>
            )}
          </div>
        </div>

        {/* Real-time status indicator */}
        {profile?.updatedAt && (
          <div className="text-sm text-[#9ca3af] mt-4 pt-4 border-t border-[#262626]">
            Last updated: {new Date(profile.updatedAt).toLocaleString()}
          </div>
        )}

      </div>
    </div>
  );
}
