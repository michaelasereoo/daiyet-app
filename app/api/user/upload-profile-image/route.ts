import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

// POST: Upload profile image
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique file name
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${user.id}/profile.${fileExt}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("profiles")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file", details: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("profiles")
      .getPublicUrl(fileName);

    // Update user record with image URL
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ image: urlData.publicUrl })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating user:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageUrl: urlData.publicUrl,
      message: "Profile image uploaded successfully",
    });
  } catch (error: any) {
    console.error("Error uploading profile image:", error);
    return NextResponse.json(
      { error: "Failed to upload image", details: error.message },
      { status: 500 }
    );
  }
}

