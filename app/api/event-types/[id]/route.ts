import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET: Get single event type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (for Next.js 15+ compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;
    
    if (!id) {
      return NextResponse.json(
        { error: "Event type ID is required" },
        { status: 400 }
      );
    }

    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const supabaseAdmin = createAdminClientServer();
    
    // First, try to fetch by ID only to see if it exists at all
    const { data: eventTypeById, error: idError } = await supabaseAdmin
      .from("event_types")
      .select("*")
      .eq("id", id)
      .single();
    
    console.log(`Fetching event type ${id}:`, {
      dietitianId,
      foundById: !!eventTypeById,
      idError: idError?.message,
      eventTypeUserId: eventTypeById?.user_id,
    });
    
    // If not found by ID, return 404
    if (idError || !eventTypeById) {
      return NextResponse.json(
        { 
          error: "Event type not found", 
          details: `Event type with ID ${id} does not exist in the database. ${idError?.message || ''}` 
        },
        { status: 404 }
      );
    }
    
    // Ensure the event type belongs to the authenticated dietitian
    if (eventTypeById.user_id !== dietitianId) {
      console.log(`Event type ${id} belongs to user ${eventTypeById.user_id}, but current user is ${dietitianId}`);
      return NextResponse.json(
        { 
          error: "Event type not found", 
          details: `Event type with ID ${id} does not belong to the current dietitian` 
        },
        { status: 404 }
      );
    }
    
    // Fetch availability schedule info if linked
    let availabilitySchedule = null;
    if (eventTypeById.availability_schedule_id) {
      const { data: schedule } = await supabaseAdmin
        .from("availability_schedules")
        .select("id, name, is_default")
        .eq("id", eventTypeById.availability_schedule_id)
        .single();
      
      if (schedule) {
        availabilitySchedule = schedule;
      }
    }

    // Success - return the event type with availability info
    const eventType = {
      ...eventTypeById,
      availabilitySchedule,
    };

    return NextResponse.json({ eventType });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error fetching event type:", error);
    return NextResponse.json(
      { error: "Failed to fetch event type", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// PUT: Update event type
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (for Next.js 15+ compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;
    
    const body = await request.json();
    const { title, slug, description, length, price, currency, active, availabilityScheduleId } = body;

    const supabaseAdmin = createAdminClientServer();

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from("event_types")
      .select("id, slug")
      .eq("id", id)
      .eq("user_id", dietitianId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Event type not found or access denied" },
        { status: 404 }
      );
    }

    // If slug is being changed, check uniqueness
    if (slug && slug !== existing.slug) {
      const { data: slugExists } = await supabaseAdmin
        .from("event_types")
        .select("id")
        .eq("user_id", dietitianId)
        .eq("slug", slug)
        .single();

      if (slugExists) {
        return NextResponse.json(
          { error: "Slug already exists for this dietitian" },
          { status: 409 }
        );
      }
    }

    // Update event type
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (length !== undefined) updateData.length = length;
    if (price !== undefined) updateData.price = price;
    if (currency !== undefined) updateData.currency = currency;
    if (active !== undefined) updateData.active = active;
    if (availabilityScheduleId !== undefined) {
      // If empty string or "inherit", set to null (inherit from default)
      updateData.availability_schedule_id = availabilityScheduleId === "" || availabilityScheduleId === "inherit" 
        ? null 
        : availabilityScheduleId;
    }

    const { data: eventType, error } = await supabaseAdmin
      .from("event_types")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", dietitianId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update event type", details: error.message },
        { status: 500 }
      );
    }

    // Fetch availability schedule info if linked
    let availabilitySchedule = null;
    if (eventType.availability_schedule_id) {
      const { data: schedule } = await supabaseAdmin
        .from("availability_schedules")
        .select("id, name, is_default")
        .eq("id", eventType.availability_schedule_id)
        .single();
      
      if (schedule) {
        availabilitySchedule = schedule;
      }
    }

    return NextResponse.json({ 
      eventType: {
        ...eventType,
        availabilitySchedule,
      }
    });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error updating event type:", error);
    return NextResponse.json(
      { error: "Failed to update event type", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete event type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (for Next.js 15+ compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const supabaseAdmin = createAdminClientServer();

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from("event_types")
      .select("id")
      .eq("id", id)
      .eq("user_id", dietitianId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Event type not found or access denied" },
        { status: 404 }
      );
    }

    // Delete event type (cascade will handle related bookings)
    const { error } = await supabaseAdmin
      .from("event_types")
      .delete()
      .eq("id", id)
      .eq("user_id", dietitianId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete event type", details: error.message },
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
    console.error("Error deleting event type:", error);
    return NextResponse.json(
      { error: "Failed to delete event type", details: error.message },
      { status: 500 }
    );
  }
}
