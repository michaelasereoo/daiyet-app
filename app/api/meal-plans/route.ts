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
    const { sessionRequestId, userId, packageName, fileUrl, fileName } = body;

    if (!userId || !packageName || !fileUrl) {
      return NextResponse.json(
        { error: "userId, packageName, and fileUrl are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    // Create meal plan
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
      console.error("Error creating meal plan:", error);
      return NextResponse.json(
        { error: "Failed to create meal plan", details: error.message },
        { status: 500 }
      );
    }

    // If linked to a session request, update its status to APPROVED
    if (sessionRequestId) {
      await supabaseAdmin
        .from("session_requests")
        .update({ status: "APPROVED" })
        .eq("id", sessionRequestId)
        .eq("dietitian_id", dietitianId);
    }

    // Format the response
    const formattedMealPlan = {
      id: mealPlan.id,
      sessionRequestId: mealPlan.session_request_id,
      userId: mealPlan.user_id,
      userName: mealPlan.users?.name || "Unknown",
      userEmail: mealPlan.users?.email || "Unknown",
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

