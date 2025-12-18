import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

/**
 * GET /api/debug/storage-integrity
 * Diagnostic endpoint to check storage integrity
 * Verifies that all meal plans with file_url have corresponding files in storage
 */
export async function GET(request: NextRequest) {
  try {
    // Auth: allow dev fallback - more lenient for debugging
    let dietitian;
    let allMealPlans = false; // Flag to check all meal plans in dev mode
    
    try {
      dietitian = await requireDietitianFromRequest(request);
    } catch (authError: any) {
      if (process.env.NODE_ENV === "development") {
        const { getCurrentUserFromRequest } = await import("@/lib/auth-helpers");
        try {
          const devUser = await getCurrentUserFromRequest(request);
          if (devUser && devUser.role === "DIETITIAN") {
            dietitian = devUser;
          } else {
            // In dev mode, if no user found, check all meal plans (for debugging)
            console.warn("[STORAGE INTEGRITY] No authenticated user in dev mode, checking all meal plans");
            allMealPlans = true;
            dietitian = { id: "dev-mode" } as any;
          }
        } catch (devError) {
          // In dev mode, if auth fails completely, still allow checking all meal plans
          console.warn("[STORAGE INTEGRITY] Auth failed in dev mode, checking all meal plans");
          allMealPlans = true;
          dietitian = { id: "dev-mode" } as any;
        }
      } else {
        throw authError;
      }
    }

    const supabaseAdmin = createAdminClientServer();

    // Get all meal plans with file URLs
    let query = supabaseAdmin
      .from("meal_plans")
      .select("id, file_url, file_name, status, created_at, dietitian_id")
      .not("file_url", "is", null);
    
    // Only filter by dietitian_id if we have a real dietitian (not dev mode)
    if (!allMealPlans && dietitian.id !== "dev-mode") {
      query = query.eq("dietitian_id", dietitian.id);
    }
    
    const { data: mealPlans, error: mealPlansError } = await query
      .order("created_at", { ascending: false });

    if (mealPlansError) {
      return NextResponse.json(
        { error: "Failed to fetch meal plans", details: mealPlansError.message },
        { status: 500 }
      );
    }

    // Helper function to extract storage path from URL
    const extractStoragePath = (url: string): string | null => {
      try {
        // Supabase Storage URL format: https://[project].supabase.co/storage/v1/object/public/meal-plans/[path]
        const match = url.match(/\/meal-plans\/(.+)$/);
        return match ? decodeURIComponent(match[1]) : null;
      } catch (error) {
        return null;
      }
    };

    // Check each meal plan's file
    const integrityChecks = await Promise.all(
      (mealPlans || []).map(async (plan) => {
        const storagePath = extractStoragePath(plan.file_url);
        
        if (!storagePath) {
          return {
            mealPlanId: plan.id,
            fileUrl: plan.file_url,
            status: plan.status,
            createdAt: plan.created_at,
            issue: "INVALID_URL_FORMAT",
            storagePath: null,
            fileExists: false,
            error: "Could not extract storage path from URL",
          };
        }

        // Split path into directory and filename
        const pathParts = storagePath.split("/");
        const directory = pathParts.slice(0, -1).join("/");
        const filename = pathParts[pathParts.length - 1];

        // Check if file exists in storage
        let fileExists = false;
        let fileSize: number | null = null;
        let fileError: string | null = null;

        try {
          // List files in the directory
          const { data: files, error: listError } = await supabaseAdmin.storage
            .from("meal-plans")
            .list(directory || "", { 
              limit: 1000,
              sortBy: { column: "name", order: "asc" }
            });

          if (listError) {
            fileError = listError.message;
          } else {
            // Check if our file is in the list
            const foundFile = files?.find((f: any) => f.name === filename);
            if (foundFile) {
              fileExists = true;
              fileSize = foundFile.metadata?.size || foundFile.size || null;
            }
          }
        } catch (error: any) {
          fileError = error.message || "Unknown error checking storage";
        }

        return {
          mealPlanId: plan.id,
          fileUrl: plan.file_url,
          status: plan.status,
          createdAt: plan.created_at,
          storagePath,
          directory: directory || "(root)",
          filename,
          fileExists,
          fileSize,
          issue: fileExists ? null : "FILE_MISSING",
          error: fileError,
        };
      })
    );

    // Get storage bucket info
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
    const mealPlansBucket = buckets?.find((b: any) => b.name === "meal-plans");

    // Count files in storage
    let totalFilesInStorage = 0;
    try {
      const { data: allFiles } = await supabaseAdmin.storage
        .from("meal-plans")
        .list("", { limit: 10000 });
      totalFilesInStorage = allFiles?.length || 0;
    } catch (error) {
      // Ignore error
    }

    // Summary
    const summary = {
      totalMealPlans: mealPlans?.length || 0,
      totalFilesInStorage,
      filesExist: integrityChecks.filter((c) => c.fileExists).length,
      filesMissing: integrityChecks.filter((c) => !c.fileExists).length,
      invalidUrls: integrityChecks.filter((c) => c.issue === "INVALID_URL_FORMAT").length,
      bucketExists: !!mealPlansBucket,
      bucketName: mealPlansBucket?.name || null,
      bucketPublic: mealPlansBucket?.public || null,
    };

    return NextResponse.json({
      success: true,
      dietitianId: allMealPlans ? "all (dev mode)" : dietitian.id,
      devMode: allMealPlans,
      summary,
      bucketInfo: {
        exists: !!mealPlansBucket,
        name: mealPlansBucket?.name || null,
        public: mealPlansBucket?.public || null,
        createdAt: mealPlansBucket?.created_at || null,
        updatedAt: mealPlansBucket?.updated_at || null,
      },
      integrityChecks,
      issues: {
        missingFiles: integrityChecks.filter((c) => !c.fileExists),
        invalidUrls: integrityChecks.filter((c) => c.issue === "INVALID_URL_FORMAT"),
      },
    });
  } catch (error: any) {
    console.error("[STORAGE INTEGRITY] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to check storage integrity", 
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

