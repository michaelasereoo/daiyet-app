import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET: Fetch all date overrides for authenticated dietitian
export async function GET(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const supabaseAdmin = createAdminClientServer();

    // Fetch all overrides with their slots
    const { data: overrides, error } = await supabaseAdmin
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
      .eq("dietitian_id", dietitianId)
      .order("override_date", { ascending: true });

    if (error) {
      console.error("Error fetching overrides:", error);
      return NextResponse.json(
        { error: "Failed to fetch date overrides", details: error.message },
        { status: 500 }
      );
    }

    // Transform the data to match frontend expectations
    const formattedOverrides = (overrides || []).map((override: any) => ({
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
    }));

    return NextResponse.json({ overrides: formattedOverrides });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error fetching date overrides:", error);
    return NextResponse.json(
      { error: "Failed to fetch date overrides", details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create new date override(s)
export async function POST(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const body = await request.json();
    const { overrides } = body; // Array of override objects

    if (!Array.isArray(overrides) || overrides.length === 0) {
      return NextResponse.json(
        { error: "overrides array is required and must not be empty" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();
    const createdOverrides = [];

    // Process each override
    for (const overrideData of overrides) {
      const { date, type, slots, timezone } = overrideData;

      if (!date) {
        continue; // Skip invalid entries
      }

      const isUnavailable = type === "unavailable";
      const overrideDate = typeof date === "string" ? date : new Date(date).toISOString().split("T")[0];

      // Insert or update override (upsert)
      const { data: override, error: overrideError } = await supabaseAdmin
        .from("availability_date_overrides")
        .upsert(
          {
            dietitian_id: dietitianId,
            override_date: overrideDate,
            is_unavailable: isUnavailable,
            timezone: timezone || "Africa/Lagos",
          },
          {
            onConflict: "dietitian_id,override_date",
          }
        )
        .select()
        .single();

      if (overrideError) {
        console.error("Error creating override:", overrideError);
        continue; // Skip this override and continue with others
      }

      if (!override) {
        continue;
      }

      // Delete existing slots for this override
      await supabaseAdmin
        .from("availability_date_override_slots")
        .delete()
        .eq("override_id", override.id);

      // Insert new slots if not unavailable
      if (!isUnavailable && slots && Array.isArray(slots) && slots.length > 0) {
        const slotsToInsert = slots.map((slot: any) => ({
          override_id: override.id,
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

      // Fetch the complete override with slots
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
        .eq("id", override.id)
        .single();

      if (completeOverride) {
        createdOverrides.push({
          id: completeOverride.id,
          date: completeOverride.override_date,
          type: completeOverride.is_unavailable ? "unavailable" : "available",
          timezone: completeOverride.timezone,
          slots: completeOverride.is_unavailable
            ? []
            : (completeOverride.availability_date_override_slots || []).map((slot: any) => ({
                start: slot.start_time,
                end: slot.end_time,
              })),
        });
      }
    }

    return NextResponse.json({
      overrides: createdOverrides,
      message: `Successfully created ${createdOverrides.length} override(s)`,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error creating date overrides:", error);
    return NextResponse.json(
      { error: "Failed to create date overrides", details: error.message },
      { status: 500 }
    );
  }
}

