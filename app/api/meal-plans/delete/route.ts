import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// DELETE: Delete a meal plan file from storage
export async function DELETE(request: NextRequest) {
  try {
    // In dev mode, allow more lenient auth
    let dietitian;
    try {
      dietitian = await requireDietitianFromRequest(request);
    } catch (authError: any) {
      if (process.env.NODE_ENV === 'development') {
        const { getCurrentUserFromRequest } = await import("@/lib/auth-helpers");
        const devUser = await getCurrentUserFromRequest(request);
        if (devUser && devUser.role === 'DIETITIAN') {
          dietitian = devUser;
        } else {
          throw authError;
        }
      } else {
        throw authError;
      }
    }

    const body = await request.json();
    const { storagePath } = body;

    if (!storagePath) {
      return NextResponse.json(
        { error: "storagePath is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    console.log("[DELETE] Deleting file from storage:", { storagePath });

    // Delete from storage
    const { error: deleteError } = await supabaseAdmin.storage
      .from("meal-plans")
      .remove([storagePath]);

    if (deleteError) {
      console.error("[DELETE] Error deleting file:", deleteError);
      return NextResponse.json(
        {
          error: "Failed to delete file",
          details: deleteError.message,
        },
        { status: 500 }
      );
    }

    console.log("[DELETE] File deleted successfully:", storagePath);

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
      storagePath,
    });
  } catch (error: any) {
    console.error("[DELETE] Unexpected error:", error);
    
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to delete file",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

