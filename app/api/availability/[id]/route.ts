import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET: Fetch single availability schedule by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const resolvedParams = params instanceof Promise ? await params : params;
    const scheduleId = resolvedParams.id;

    const supabaseAdmin = createAdminClientServer();

    // Fetch schedule with slots
    const { data: schedule, error } = await supabaseAdmin
      .from("availability_schedules")
      .select(`
        id,
        name,
        is_default,
        timezone,
        created_at,
        updated_at,
        availability_schedule_slots (
          id,
          day_of_week,
          start_time,
          end_time,
          enabled
        )
      `)
      .eq("id", scheduleId)
      .eq("dietitian_id", dietitianId)
      .single();

    if (error || !schedule) {
      if (error?.code === "PGRST116") {
        return NextResponse.json(
          { error: "Schedule not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching schedule:", error);
      return NextResponse.json(
        { error: "Failed to fetch schedule", details: error?.message },
        { status: 500 }
      );
    }

    // Format the response
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const formattedSlots = (schedule.availability_schedule_slots || []).map((slot: any) => ({
      id: slot.id,
      day: dayNames[slot.day_of_week],
      dayOfWeek: slot.day_of_week,
      start: formatTime(slot.start_time),
      end: formatTime(slot.end_time),
      startTime: slot.start_time,
      endTime: slot.end_time,
      enabled: slot.enabled,
    }));

    // Organize by day for easier frontend consumption
    const days: Record<string, any> = {
      Sunday: { enabled: false, slots: [] },
      Monday: { enabled: false, slots: [] },
      Tuesday: { enabled: false, slots: [] },
      Wednesday: { enabled: false, slots: [] },
      Thursday: { enabled: false, slots: [] },
      Friday: { enabled: false, slots: [] },
      Saturday: { enabled: false, slots: [] },
    };

    formattedSlots.forEach((slot) => {
      if (slot.enabled) {
        days[slot.day].enabled = true;
        days[slot.day].slots.push({
          start: slot.start,
          end: slot.end,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
    });

    return NextResponse.json({
      schedule: {
        id: schedule.id,
        name: schedule.name,
        isDefault: schedule.is_default,
        timezone: schedule.timezone,
        days,
        slots: formattedSlots,
        createdAt: schedule.created_at,
        updatedAt: schedule.updated_at,
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error fetching schedule:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedule", details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Update availability schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const resolvedParams = params instanceof Promise ? await params : params;
    const scheduleId = resolvedParams.id;

    const body = await request.json();
    const { name, timezone, days, slots, isDefault } = body;

    const supabaseAdmin = createAdminClientServer();

    // Verify schedule belongs to this dietitian
    const { data: existingSchedule, error: checkError } = await supabaseAdmin
      .from("availability_schedules")
      .select("id")
      .eq("id", scheduleId)
      .eq("dietitian_id", dietitianId)
      .single();

    if (checkError || !existingSchedule) {
      return NextResponse.json(
        { error: "Schedule not found or access denied" },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await supabaseAdmin
        .from("availability_schedules")
        .update({ is_default: false })
        .eq("dietitian_id", dietitianId)
        .eq("is_default", true)
        .neq("id", scheduleId);
    }

    // Update schedule
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (isDefault !== undefined) updateData.is_default = isDefault;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("availability_schedules")
        .update(updateData)
        .eq("id", scheduleId);

      if (updateError) {
        console.error("Error updating schedule:", updateError);
        return NextResponse.json(
          { error: "Failed to update schedule", details: updateError.message },
          { status: 500 }
        );
      }
    }

    // Update slots if provided
    if (days || slots) {
      // Delete existing slots
      await supabaseAdmin
        .from("availability_schedule_slots")
        .delete()
        .eq("schedule_id", scheduleId);

      // Create new slots from days object or slots array
      let slotRecords: any[] = [];

      if (days) {
        // Convert days object to slot records
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        dayNames.forEach((dayName, dayIndex) => {
          const dayData = days[dayName];
          if (dayData && dayData.enabled && dayData.slots && dayData.slots.length > 0) {
            dayData.slots.forEach((slot: any) => {
              slotRecords.push({
                schedule_id: scheduleId,
                day_of_week: dayIndex,
                start_time: slot.startTime || slot.start,
                end_time: slot.endTime || slot.end,
                enabled: true,
              });
            });
          }
        });
      } else if (slots && Array.isArray(slots)) {
        // Use slots array directly
        slotRecords = slots
          .filter((slot: any) => slot.enabled !== false && slot.dayOfWeek !== undefined)
          .map((slot: any) => ({
            schedule_id: scheduleId,
            day_of_week: slot.dayOfWeek,
            start_time: slot.startTime || slot.start,
            end_time: slot.endTime || slot.end,
            enabled: true,
          }));
      }

      if (slotRecords.length > 0) {
        const { error: slotsError } = await supabaseAdmin
          .from("availability_schedule_slots")
          .insert(slotRecords);

        if (slotsError) {
          console.error("Error updating slots:", slotsError);
          // Continue anyway - schedule is updated
        }
      }
    }

    // Fetch updated schedule
    const { data: updatedSchedule, error: fetchError } = await supabaseAdmin
      .from("availability_schedules")
      .select(`
        id,
        name,
        is_default,
        timezone,
        created_at,
        updated_at,
        availability_schedule_slots (
          id,
          day_of_week,
          start_time,
          end_time,
          enabled
        )
      `)
      .eq("id", scheduleId)
      .single();

    if (fetchError || !updatedSchedule) {
      return NextResponse.json(
        { error: "Schedule updated but failed to fetch", details: fetchError?.message },
        { status: 500 }
      );
    }

    // Format response
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const formattedSlots = (updatedSchedule.availability_schedule_slots || []).map((slot: any) => ({
      id: slot.id,
      day: dayNames[slot.day_of_week],
      dayOfWeek: slot.day_of_week,
      start: formatTime(slot.start_time),
      end: formatTime(slot.end_time),
      startTime: slot.start_time,
      endTime: slot.end_time,
      enabled: slot.enabled,
    }));

    const formattedDays: Record<string, any> = {
      Sunday: { enabled: false, slots: [] },
      Monday: { enabled: false, slots: [] },
      Tuesday: { enabled: false, slots: [] },
      Wednesday: { enabled: false, slots: [] },
      Thursday: { enabled: false, slots: [] },
      Friday: { enabled: false, slots: [] },
      Saturday: { enabled: false, slots: [] },
    };

    formattedSlots.forEach((slot) => {
      if (slot.enabled) {
        formattedDays[slot.day].enabled = true;
        formattedDays[slot.day].slots.push({
          start: slot.start,
          end: slot.end,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
    });

    return NextResponse.json({
      schedule: {
        id: updatedSchedule.id,
        name: updatedSchedule.name,
        isDefault: updatedSchedule.is_default,
        timezone: updatedSchedule.timezone,
        days: formattedDays,
        slots: formattedSlots,
        createdAt: updatedSchedule.created_at,
        updatedAt: updatedSchedule.updated_at,
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error updating schedule:", error);
    return NextResponse.json(
      { error: "Failed to update schedule", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete availability schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const resolvedParams = params instanceof Promise ? await params : params;
    const scheduleId = resolvedParams.id;

    const supabaseAdmin = createAdminClientServer();

    // Verify schedule belongs to this dietitian
    const { data: existingSchedule, error: checkError } = await supabaseAdmin
      .from("availability_schedules")
      .select("id, is_default")
      .eq("id", scheduleId)
      .eq("dietitian_id", dietitianId)
      .single();

    if (checkError || !existingSchedule) {
      return NextResponse.json(
        { error: "Schedule not found or access denied" },
        { status: 404 }
      );
    }

    // Prevent deleting default schedule
    if (existingSchedule.is_default) {
      return NextResponse.json(
        { error: "Cannot delete default schedule. Please set another schedule as default first." },
        { status: 400 }
      );
    }

    // Delete schedule (cascade will delete slots)
    const { error: deleteError } = await supabaseAdmin
      .from("availability_schedules")
      .delete()
      .eq("id", scheduleId);

    if (deleteError) {
      console.error("Error deleting schedule:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete schedule", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Schedule deleted successfully" });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error deleting schedule:", error);
    return NextResponse.json(
      { error: "Failed to delete schedule", details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to format time
function formatTime(time: string): string {
  if (!time) return "";
  
  // If already formatted (contains AM/PM), return as is
  if (time.includes("AM") || time.includes("PM")) {
    return time;
  }

  // Parse TIME format (HH:MM:SS) and convert to 12-hour format
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

