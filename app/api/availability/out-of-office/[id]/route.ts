import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET: Fetch single OOO period by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const resolvedParams = params instanceof Promise ? await params : params;
    const periodId = resolvedParams.id;

    const supabaseAdmin = createAdminClientServer();

    const { data: oooPeriod, error } = await supabaseAdmin
      .from("out_of_office_periods")
      .select("*")
      .eq("id", periodId)
      .eq("dietitian_id", dietitianId)
      .single();

    if (error || !oooPeriod) {
      return NextResponse.json(
        { error: "Out-of-office period not found" },
        { status: 404 }
      );
    }

    const formattedPeriod = {
      id: oooPeriod.id,
      startDate: oooPeriod.start_date,
      endDate: oooPeriod.end_date,
      reason: oooPeriod.reason || "Unspecified",
      notes: oooPeriod.notes || "",
      forwardToTeam: oooPeriod.forward_to_team || false,
      forwardUrl: oooPeriod.forward_url || null,
      createdAt: oooPeriod.created_at,
      updatedAt: oooPeriod.updated_at,
    };

    return NextResponse.json({ period: formattedPeriod });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error fetching OOO period:", error);
    return NextResponse.json(
      { error: "Failed to fetch out-of-office period", details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Update OOO period
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const resolvedParams = params instanceof Promise ? await params : params;
    const periodId = resolvedParams.id;

    const body = await request.json();
    const { startDate, endDate, reason, notes, forwardToTeam, forwardUrl } = body;

    const supabaseAdmin = createAdminClientServer();

    // Verify period belongs to dietitian
    const { data: existingPeriod, error: checkError } = await supabaseAdmin
      .from("out_of_office_periods")
      .select("id")
      .eq("id", periodId)
      .eq("dietitian_id", dietitianId)
      .single();

    if (checkError || !existingPeriod) {
      return NextResponse.json(
        { error: "Out-of-office period not found" },
        { status: 404 }
      );
    }

    // Validate date range if dates are provided
    if (startDate && endDate) {
      const start = typeof startDate === "string" ? startDate : new Date(startDate).toISOString().split("T")[0];
      const end = typeof endDate === "string" ? endDate : new Date(endDate).toISOString().split("T")[0];

      if (start > end) {
        return NextResponse.json(
          { error: "startDate must be before or equal to endDate" },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (startDate !== undefined) {
      updateData.start_date = typeof startDate === "string" ? startDate : new Date(startDate).toISOString().split("T")[0];
    }
    if (endDate !== undefined) {
      updateData.end_date = typeof endDate === "string" ? endDate : new Date(endDate).toISOString().split("T")[0];
    }
    if (reason !== undefined) updateData.reason = reason;
    if (notes !== undefined) updateData.notes = notes;
    if (forwardToTeam !== undefined) updateData.forward_to_team = forwardToTeam;
    if (forwardUrl !== undefined) updateData.forward_url = forwardUrl;

    const { data: updatedPeriod, error: updateError } = await supabaseAdmin
      .from("out_of_office_periods")
      .update(updateData)
      .eq("id", periodId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating OOO period:", updateError);
      return NextResponse.json(
        { error: "Failed to update out-of-office period", details: updateError.message },
        { status: 500 }
      );
    }

    const formattedPeriod = {
      id: updatedPeriod.id,
      startDate: updatedPeriod.start_date,
      endDate: updatedPeriod.end_date,
      reason: updatedPeriod.reason || "Unspecified",
      notes: updatedPeriod.notes || "",
      forwardToTeam: updatedPeriod.forward_to_team || false,
      forwardUrl: updatedPeriod.forward_url || null,
      createdAt: updatedPeriod.created_at,
      updatedAt: updatedPeriod.updated_at,
    };

    return NextResponse.json({ period: formattedPeriod });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error updating out-of-office period:", error);
    return NextResponse.json(
      { error: "Failed to update out-of-office period", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete OOO period
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const resolvedParams = params instanceof Promise ? await params : params;
    const periodId = resolvedParams.id;

    const supabaseAdmin = createAdminClientServer();

    // Verify period belongs to dietitian
    const { data: existingPeriod, error: checkError } = await supabaseAdmin
      .from("out_of_office_periods")
      .select("id")
      .eq("id", periodId)
      .eq("dietitian_id", dietitianId)
      .single();

    if (checkError || !existingPeriod) {
      return NextResponse.json(
        { error: "Out-of-office period not found" },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("out_of_office_periods")
      .delete()
      .eq("id", periodId);

    if (deleteError) {
      console.error("Error deleting OOO period:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete out-of-office period", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Out-of-office period deleted successfully" });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error deleting out-of-office period:", error);
    return NextResponse.json(
      { error: "Failed to delete out-of-office period", details: error.message },
      { status: 500 }
    );
  }
}

