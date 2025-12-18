import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET /api/debug/meal-plan-upload?storagePath=...
// Basic storage existence check for a file in the meal-plans bucket
export async function GET(request: NextRequest) {
  try {
    // Auth: allow dev fallback
    let dietitian;
    try {
      dietitian = await requireDietitianFromRequest(request);
    } catch (authError: any) {
      if (process.env.NODE_ENV === "development") {
        const { getCurrentUserFromRequest } = await import("@/lib/auth-helpers");
        const devUser = await getCurrentUserFromRequest(request);
        if (devUser && devUser.role === "DIETITIAN") {
          dietitian = devUser;
        } else {
          throw authError;
        }
      } else {
        throw authError;
      }
    }

    const { searchParams } = new URL(request.url);
    const storagePath = searchParams.get("storagePath");
    if (!storagePath) {
      return NextResponse.json(
        { error: "storagePath query parameter is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();
    const pathParts = storagePath.split("/");
    const prefix = pathParts.slice(0, -1).join("/");
    const filename = pathParts[pathParts.length - 1];

    const { data: listData, error: listError } = await supabaseAdmin.storage
      .from("meal-plans")
      .list(prefix, { limit: 100 });

    const found = listData?.find((f: any) => f.name === filename);

    return NextResponse.json({
      success: true,
      storagePath,
      checkedPrefix: prefix || "",
      listed: !listError,
      listError: listError?.message || null,
      found: !!found,
      size: found?.metadata?.size || found?.size || null,
      updated_at: found?.updated_at || null,
      ownerDietitianId: dietitian.id,
    });
  } catch (error: any) {
    console.error("[DEBUG MEAL PLAN UPLOAD] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to debug meal plan upload", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

