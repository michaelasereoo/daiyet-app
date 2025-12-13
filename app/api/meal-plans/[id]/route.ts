import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";
import { emailQueue } from "@/lib/email/queue";

// GET: Get single meal plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const supabaseAdmin = createAdminClientServer();

    const { data: mealPlan, error } = await supabaseAdmin
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
      .eq("id", id)
      .eq("dietitian_id", dietitianId)
      .single();

    if (error || !mealPlan) {
      return NextResponse.json(
        { error: "Meal plan not found" },
        { status: 404 }
      );
    }

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
      updatedAt: mealPlan.updated_at,
    };

    return NextResponse.json({ mealPlan: formattedMealPlan });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error fetching meal plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch meal plan", details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Update meal plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const body = await request.json();
    const { packageName, fileUrl, fileName, status } = body;

    const supabaseAdmin = createAdminClientServer();

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from("meal_plans")
      .select("id")
      .eq("id", id)
      .eq("dietitian_id", dietitianId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Meal plan not found or access denied" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (packageName !== undefined) updateData.package_name = packageName;
    if (fileUrl !== undefined) updateData.file_url = fileUrl;
    if (fileName !== undefined) updateData.file_name = fileName;
    if (status !== undefined) {
      updateData.status = status;
      if (status === "SENT" && !existing.sent_at) {
        updateData.sent_at = new Date().toISOString();
      }
    }

    const { data: mealPlan, error } = await supabaseAdmin
      .from("meal_plans")
      .update(updateData)
      .eq("id", id)
      .eq("dietitian_id", dietitianId)
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
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update meal plan", details: error.message },
        { status: 500 }
      );
    }

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
      updatedAt: mealPlan.updated_at,
    };

    // Send email when meal plan is sent
    if (status === "SENT" && mealPlan.users?.email) {
      try {
        await emailQueue.enqueue({
          to: mealPlan.users.email,
          subject: `Your ${mealPlan.package_name} is Ready!`,
          template: "session_request",
          data: {
            userName: mealPlan.users.name || "User",
            requestType: "meal plan",
            message: `Your ${mealPlan.package_name} has been sent and is ready for download.`,
            actionRequired: true,
            actionLink: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/user-dashboard/meal-plan`,
          },
        });
      } catch (emailError) {
        console.error("Error enqueueing meal plan email:", emailError);
        // Don't fail the update if email fails
      }
    }

    return NextResponse.json({ mealPlan: formattedMealPlan });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error updating meal plan:", error);
    return NextResponse.json(
      { error: "Failed to update meal plan", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete meal plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const supabaseAdmin = createAdminClientServer();

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from("meal_plans")
      .select("id")
      .eq("id", id)
      .eq("dietitian_id", dietitianId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Meal plan not found or access denied" },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from("meal_plans")
      .delete()
      .eq("id", id)
      .eq("dietitian_id", dietitianId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete meal plan", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error deleting meal plan:", error);
    return NextResponse.json(
      { error: "Failed to delete meal plan", details: error.message },
      { status: 500 }
    );
  }
}

