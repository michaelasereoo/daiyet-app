import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET: Fetch single override by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const resolvedParams = params instanceof Promise ? await params : params;
    const overrideId = resolvedParams.id;

    const supabaseAdmin = createAdminClientServer();

    const { data: override, error } = await supabaseAdmin
      .from("availability_date_overrides")
      .select(`
        id,
        override_date,
        is_unavailable,
        timezone,
        created_at,
        updated_at,
        availability_date_override_slots (
          id,
          start_time,
          end_time
        )
      `)
      .eq("id", overrideId)
      .eq("dietitian_id", dietitianId)
      .single();

    if (error || !override) {
      return NextResponse.json(
        { error: "Override not found" },
        { status: 404 }
      );
    }

    const formattedOverride = {
      id: override.id,
      date: override.override_date,
      type: override.is_unavailable ? "unavailable" : "available",
      timezone: override.timezone,
      slots: override.is_unavailable
        ? []
        : (override.availability_date_override_slots || []).map((slot: any) => ({
            start: slot.start_time,
            end: slot.end_time,
          })),
      createdAt: override.created_at,
      updatedAt: override.updated_at,
    };

    return NextResponse.json({ override: formattedOverride });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error fetching override:", error);
    return NextResponse.json(
      { error: "Failed to fetch override", details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Update override
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const resolvedParams = params instanceof Promise ? await params : params;
    const overrideId = resolvedParams.id;

    const body = await request.json();
    const { date, type, slots, timezone } = body;

    const supabaseAdmin = createAdminClientServer();

    // Verify override belongs to dietitian
    const { data: existingOverride, error: checkError } = await supabaseAdmin
      .from("availability_date_overrides")
      .select("id")
      .eq("id", overrideId)
      .eq("dietitian_id", dietitianId)
      .single();

    if (checkError || !existingOverride) {
      return NextResponse.json(
        { error: "Override not found" },
        { status: 404 }
      );
    }

    const isUnavailable = type === "unavailable";
    const overrideDate = date
      ? typeof date === "string"
        ? date
        : new Date(date).toISOString().split("T")[0]
      : undefined;

    // Update override
    const updateData: any = {};
    if (overrideDate !== undefined) updateData.override_date = overrideDate;
    if (type !== undefined) updateData.is_unavailable = isUnavailable;
    if (timezone !== undefined) updateData.timezone = timezone;

    const { data: updatedOverride, error: updateError } = await supabaseAdmin
      .from("availability_date_overrides")
      .update(updateData)
      .eq("id", overrideId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating override:", updateError);
      return NextResponse.json(
        { error: "Failed to update override", details: updateError.message },
        { status: 500 }
      );
    }

    // Delete existing slots
    await supabaseAdmin
      .from("availability_date_override_slots")
      .delete()
      .eq("override_id", overrideId);

    // Insert new slots if not unavailable
    if (!isUnavailable && slots && Array.isArray(slots) && slots.length > 0) {
      const slotsToInsert = slots.map((slot: any) => ({
        override_id: overrideId,
        start_time: slot.start || slot.startTime,
        end_time: slot.end || slot.endTime,
      }));

      const { error: slotsError } = await supabaseAdmin
        .from("availability_date_override_slots")
        .insert(slotsToInsert);

      if (slotsError) {
        console.error("Error inserting override slots:", slotsError);
      }
    }

    // Fetch complete override
    const { data: completeOverride } = await supabaseAdmin
      .from("availability_date_overrides")
      .select(`
        id,
        override_date,
        is_unavailable,
        timezone,
        created_at,
        updated_at,
        availability_date_override_slots (
          id,
          start_time,
          end_time
        )
      `)
      .eq("id", overrideId)
      .single();

    const formattedOverride = {
      id: completeOverride!.id,
      date: completeOverride!.override_date,
      type: completeOverride!.is_unavailable ? "unavailable" : "available",
      timezone: completeOverride!.timezone,
      slots: completeOverride!.is_unavailable
        ? []
        : (completeOverride!.availability_date_override_slots || []).map((slot: any) => ({
            start: slot.start_time,
            end: slot.end_time,
          })),
      createdAt: completeOverride!.created_at,
      updatedAt: completeOverride!.updated_at,
    };

    return NextResponse.json({ override: formattedOverride });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error updating override:", error);
    return NextResponse.json(
      { error: "Failed to update override", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete override
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const resolvedParams = params instanceof Promise ? await params : params;
    const overrideId = resolvedParams.id;

    const supabaseAdmin = createAdminClientServer();

    // Verify override belongs to dietitian
    const { data: existingOverride, error: checkError } = await supabaseAdmin
      .from("availability_date_overrides")
      .select("id")
      .eq("id", overrideId)
      .eq("dietitian_id", dietitianId)
      .single();

    if (checkError || !existingOverride) {
      return NextResponse.json(
        { error: "Override not found" },
        { status: 404 }
      );
    }

    // Delete override (slots will be cascade deleted)
    const { error: deleteError } = await supabaseAdmin
      .from("availability_date_overrides")
      .delete()
      .eq("id", overrideId);

    if (deleteError) {
      console.error("Error deleting override:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete override", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Override deleted successfully" });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error deleting override:", error);
    return NextResponse.json(
      { error: "Failed to delete override", details: error.message },
      { status: 500 }
    );
  }
}

