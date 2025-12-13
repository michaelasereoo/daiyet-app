import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET: Fetch all availability schedules for authenticated dietitian
export async function GET(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const supabaseAdmin = createAdminClientServer();

    // Fetch schedules with their slots
    const { data: schedules, error } = await supabaseAdmin
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
      .eq("dietitian_id", dietitianId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching availability schedules:", error);
      return NextResponse.json(
        { error: "Failed to fetch availability schedules", details: error.message },
        { status: 500 }
      );
    }

    // Transform the data to match frontend expectations
    const formattedSchedules = (schedules || []).map((schedule: any) => {
      const slots = (schedule.availability_schedule_slots || [])
        .filter((slot: any) => slot.enabled)
        .map((slot: any) => {
          const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          return {
            day: dayNames[slot.day_of_week],
            dayOfWeek: slot.day_of_week,
            start: formatTime(slot.start_time),
            end: formatTime(slot.end_time),
            startTime: slot.start_time,
            endTime: slot.end_time,
          };
        });

      return {
        id: schedule.id,
        name: schedule.name,
        isDefault: schedule.is_default,
        timezone: schedule.timezone,
        slots,
        createdAt: schedule.created_at,
        updatedAt: schedule.updated_at,
      };
    });

    return NextResponse.json({ schedules: formattedSchedules });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error fetching availability schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability schedules", details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create a new availability schedule
export async function POST(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const body = await request.json();
    const { name, timezone, slots, isDefault } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Schedule name is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    // If this is being set as default, unset other defaults
    if (isDefault) {
      await supabaseAdmin
        .from("availability_schedules")
        .update({ is_default: false })
        .eq("dietitian_id", dietitianId)
        .eq("is_default", true);
    }

    // Create the schedule
    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from("availability_schedules")
      .insert({
        dietitian_id: dietitianId,
        name,
        is_default: isDefault || false,
        timezone: timezone || "Africa/Lagos",
      })
      .select()
      .single();

    if (scheduleError || !schedule) {
      console.error("Error creating schedule:", scheduleError);
      return NextResponse.json(
        { error: "Failed to create schedule", details: scheduleError?.message },
        { status: 500 }
      );
    }

    // Create slots if provided
    if (slots && Array.isArray(slots) && slots.length > 0) {
      const slotRecords = slots
        .filter((slot: any) => slot.enabled !== false && slot.dayOfWeek !== undefined)
        .map((slot: any) => ({
          schedule_id: schedule.id,
          day_of_week: slot.dayOfWeek,
          start_time: slot.startTime || slot.start,
          end_time: slot.endTime || slot.end,
          enabled: true,
        }));

      if (slotRecords.length > 0) {
        const { error: slotsError } = await supabaseAdmin
          .from("availability_schedule_slots")
          .insert(slotRecords);

        if (slotsError) {
          console.error("Error creating slots:", slotsError);
          // Continue anyway - schedule is created
        }
      }
    }

    // Fetch the complete schedule with slots
    const { data: completeSchedule, error: fetchError } = await supabaseAdmin
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
      .eq("id", schedule.id)
      .single();

    if (fetchError || !completeSchedule) {
      return NextResponse.json(
        { error: "Schedule created but failed to fetch", details: fetchError?.message },
        { status: 500 }
      );
    }

    // Format the response
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const formattedSlots = (completeSchedule.availability_schedule_slots || [])
      .filter((slot: any) => slot.enabled)
      .map((slot: any) => ({
        day: dayNames[slot.day_of_week],
        dayOfWeek: slot.day_of_week,
        start: formatTime(slot.start_time),
        end: formatTime(slot.end_time),
        startTime: slot.start_time,
        endTime: slot.end_time,
      }));

    return NextResponse.json(
      {
        schedule: {
          id: completeSchedule.id,
          name: completeSchedule.name,
          isDefault: completeSchedule.is_default,
          timezone: completeSchedule.timezone,
          slots: formattedSlots,
          createdAt: completeSchedule.created_at,
          updatedAt: completeSchedule.updated_at,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error creating availability schedule:", error);
    return NextResponse.json(
      { error: "Failed to create availability schedule", details: error.message },
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

