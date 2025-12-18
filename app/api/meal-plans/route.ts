import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET: Fetch meal plans for the dietitian
export async function GET(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const supabaseAdmin = createAdminClientServer();

    // Fetch meal plans
    const { data: mealPlans, error } = await supabaseAdmin
      .from("meal_plans")
      .select(`
        id,
        session_request_id,
        dietitian_id,
        user_id,
        package_name,
        file_url,
        file_name,
        status,
        sent_at,
        created_at,
        updated_at,
        users!meal_plans_user_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq("dietitian_id", dietitianId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching meal plans:", error);
      return NextResponse.json(
        { error: "Failed to fetch meal plans", details: error.message },
        { status: 500 }
      );
    }

    // Format the response
    const formattedMealPlans = (mealPlans || []).map((plan: any) => ({
      id: plan.id,
      sessionRequestId: plan.session_request_id,
      userId: plan.user_id,
      userName: plan.users?.name || "Unknown",
      userEmail: plan.users?.email || "Unknown",
      packageName: plan.package_name,
      fileUrl: plan.file_url,
      fileName: plan.file_name,
      status: plan.status,
      sentAt: plan.sent_at,
      createdAt: plan.created_at,
      updatedAt: plan.updated_at,
    }));

    return NextResponse.json({ mealPlans: formattedMealPlans });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error fetching meal plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch meal plans", details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create/send a meal plan
export async function POST(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const body = await request.json();
    const { sessionRequestId, userId, packageName, fileUrl, fileName, storagePath } = body;

    console.log("[MEAL PLAN CREATE] Received request:", {
      dietitianId,
      sessionRequestId,
      userId,
      packageName,
      hasFileUrl: !!fileUrl,
    });

    const supabaseAdmin = createAdminClientServer();

    const cleanupStorage = async () => {
      if (storagePath) {
        const { error: removeError } = await supabaseAdmin.storage
          .from("meal-plans")
          .remove([storagePath]);
        if (removeError) {
          console.error("[MEAL PLAN CREATE] Failed to cleanup storage after error:", removeError);
        }
      }
    };

    if (!userId || !packageName || !fileUrl) {
      console.error("[MEAL PLAN CREATE] Missing required fields:", {
        hasUserId: !!userId,
        hasPackageName: !!packageName,
        hasFileUrl: !!fileUrl,
      });
      await cleanupStorage();
      return NextResponse.json(
        { error: "userId, packageName, and fileUrl are required" },
        { status: 400 }
      );
    }

    // Validate userId is a UUID (not an email)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error("[MEAL PLAN CREATE] Invalid userId format (not a UUID):", userId);
      await cleanupStorage();
      return NextResponse.json(
        { 
          error: "Invalid userId format", 
          details: "userId must be a valid UUID, not an email address. Please ensure the user exists in the system." 
        },
        { status: 400 }
      );
    }

    // Validate session request ownership and email
    if (!sessionRequestId) {
      await cleanupStorage();
      return NextResponse.json(
        { error: "sessionRequestId is required" },
        { status: 400 }
      );
    }

    const { data: sessionRequest, error: sessionRequestError } = await supabaseAdmin
      .from("session_requests")
      .select("id, client_email, dietitian_id, request_type")
      .eq("id", sessionRequestId)
      .single();

    if (sessionRequestError || !sessionRequest) {
      await cleanupStorage();
      return NextResponse.json(
        { error: "Session request not found", details: sessionRequestError?.message },
        { status: 404 }
      );
    }

    if (sessionRequest.dietitian_id !== dietitianId) {
      await cleanupStorage();
      return NextResponse.json(
        { error: "Unauthorized or invalid session request" },
        { status: 403 }
      );
    }

    if (sessionRequest.request_type !== "MEAL_PLAN") {
      await cleanupStorage();
      return NextResponse.json(
        { error: "Session request is not a meal plan request" },
        { status: 400 }
      );
    }

    // Verify user exists
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, name")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      console.error("[MEAL PLAN CREATE] User not found:", { userId, error: userError });
      await cleanupStorage();
      return NextResponse.json(
        { 
          error: "User not found", 
          details: `No user found with ID: ${userId}` 
        },
        { status: 404 }
      );
    }

    console.log("[MEAL PLAN CREATE] User verified:", { userId: user.id, email: user.email });

    // Verify email matches session request
    if (sessionRequest.client_email?.toLowerCase().trim() !== user.email?.toLowerCase().trim()) {
      await cleanupStorage();
      return NextResponse.json(
        { error: "Email does not match session request" },
        { status: 400 }
      );
    }

    // ⚠️ CRITICAL: Verify file exists in storage before creating database record
    if (storagePath) {
      console.log("[MEAL PLAN CREATE] Verifying file exists in storage...", { storagePath });
      try {
        // Extract directory and filename from storage path
        const pathParts = storagePath.split("/");
        const directory = pathParts.slice(0, -1).join("/");
        const filename = pathParts[pathParts.length - 1];

        // List files in the directory to verify file exists
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from("meal-plans")
          .list(directory || "", { limit: 1000 });

        if (listError) {
          console.error("[MEAL PLAN CREATE] Error listing storage files:", listError);
          await cleanupStorage();
          return NextResponse.json(
            { 
              error: "Storage verification failed", 
              details: `Could not verify file exists in storage: ${listError.message}` 
            },
            { status: 500 }
          );
        }

        const fileExists = files?.some((f: any) => f.name === filename);
        if (!fileExists) {
          console.error("[MEAL PLAN CREATE] File does not exist in storage:", {
            storagePath,
            directory: directory || "(root)",
            filename,
            filesFound: files?.length || 0,
          });
          await cleanupStorage();
          return NextResponse.json(
            { 
              error: "File not found in storage", 
              details: "The uploaded file does not exist in storage. Please re-upload the PDF." 
            },
            { status: 404 }
          );
        }

        console.log("[MEAL PLAN CREATE] File verified in storage:", {
          storagePath,
          filename,
          fileSize: files?.find((f: any) => f.name === filename)?.metadata?.size || "unknown",
        });
      } catch (verifyError: any) {
        console.error("[MEAL PLAN CREATE] Exception during file verification:", verifyError);
        await cleanupStorage();
        return NextResponse.json(
          { 
            error: "Storage verification failed", 
            details: verifyError.message || "Unknown error verifying file" 
          },
          { status: 500 }
        );
      }
    } else {
      console.warn("[MEAL PLAN CREATE] No storagePath provided, skipping file verification");
    }

    // Create meal plan
    console.log("[MEAL PLAN CREATE] Inserting meal plan...");
    const { data: mealPlan, error } = await supabaseAdmin
      .from("meal_plans")
      .insert({
        session_request_id: sessionRequestId || null,
        dietitian_id: dietitianId,
        user_id: userId,
        package_name: packageName,
        file_url: fileUrl,
        file_name: fileName || null,
        status: "SENT",
        sent_at: new Date().toISOString(),
      })
      .select(`
        id,
        session_request_id,
        dietitian_id,
        user_id,
        package_name,
        file_url,
        file_name,
        status,
        sent_at,
        created_at,
        users!meal_plans_user_id_fkey (
          id,
          name,
          email
        )
      `)
      .single();

    if (error) {
      console.error("[MEAL PLAN CREATE] Database error:", {
        error,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      await cleanupStorage();
      return NextResponse.json(
        { 
          error: "Failed to create meal plan", 
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    console.log("[MEAL PLAN CREATE] Meal plan created successfully:", {
      mealPlanId: mealPlan.id,
      sessionRequestId: mealPlan.session_request_id,
      fileUrl: mealPlan.file_url,
    });

    // If sessionRequestId was provided but meal plan has null session_request_id, update it
    if (sessionRequestId && !mealPlan.session_request_id) {
      console.log("[MEAL PLAN CREATE] Updating meal plan with session_request_id:", sessionRequestId);
      const { error: updateError } = await supabaseAdmin
        .from("meal_plans")
        .update({ session_request_id: sessionRequestId })
        .eq("id", mealPlan.id);
      
      if (updateError) {
        console.error("[MEAL PLAN CREATE] Error updating session_request_id:", updateError);
      } else {
        console.log("[MEAL PLAN CREATE] Successfully updated session_request_id");
        mealPlan.session_request_id = sessionRequestId;
      }
    }

    // Only approve the session request if a valid PDF file URL exists
    if (sessionRequestId && mealPlan.file_url) {
      // Verify the file URL is valid (not null, not empty, and is a URL)
      const isValidUrl = mealPlan.file_url && 
                        mealPlan.file_url.trim() !== '' && 
                        (mealPlan.file_url.startsWith('http://') || mealPlan.file_url.startsWith('https://'));
      
      if (isValidUrl) {
        console.log("[MEAL PLAN CREATE] Valid PDF file URL found, approving session request...");
        const { error: updateError } = await supabaseAdmin
          .from("session_requests")
          .update({ status: "APPROVED" })
          .eq("id", sessionRequestId)
          .eq("dietitian_id", dietitianId);
        
        if (updateError) {
          console.error("[MEAL PLAN CREATE] Error updating session request status:", updateError);
          // Rollback meal plan + storage to avoid orphan records/files
          const rollbackTasks = [];
          rollbackTasks.push(supabaseAdmin.from("meal_plans").delete().eq("id", mealPlan.id));
          if (storagePath) {
            rollbackTasks.push(supabaseAdmin.storage.from("meal-plans").remove([storagePath]));
          }
          await Promise.all(rollbackTasks);
          return NextResponse.json(
            { error: "Failed to update session request status", details: updateError.message },
            { status: 500 }
          );
        } else {
          console.log("[MEAL PLAN CREATE] Session request status updated to APPROVED:", sessionRequestId);
        }
      } else {
        console.warn("[MEAL PLAN CREATE] Invalid file URL, NOT approving session request:", {
          fileUrl: mealPlan.file_url,
          sessionRequestId,
        });
        // Keep status as PENDING if file URL is invalid
      }
    } else {
      if (sessionRequestId && !mealPlan.file_url) {
        console.warn("[MEAL PLAN CREATE] No file URL provided, keeping session request as PENDING:", {
          sessionRequestId,
          hasFileUrl: !!mealPlan.file_url,
        });
      }
    }

    // Format the response
    const formattedMealPlan = {
      id: mealPlan.id,
      sessionRequestId: mealPlan.session_request_id,
      userId: mealPlan.user_id,
      userName: (Array.isArray(mealPlan.users) ? mealPlan.users[0] : mealPlan.users)?.name || "Unknown",
      userEmail: (Array.isArray(mealPlan.users) ? mealPlan.users[0] : mealPlan.users)?.email || "Unknown",
      packageName: mealPlan.package_name,
      fileUrl: mealPlan.file_url,
      fileName: mealPlan.file_name,
      status: mealPlan.status,
      sentAt: mealPlan.sent_at,
      createdAt: mealPlan.created_at,
    };

    return NextResponse.json({ mealPlan: formattedMealPlan }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error creating meal plan:", error);
    return NextResponse.json(
      { error: "Failed to create meal plan", details: error.message },
      { status: 500 }
    );
  }
}

