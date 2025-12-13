import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET: Fetch event types for authenticated dietitian
export async function GET(request: NextRequest) {
  try {
    // Log cookies for debugging
    const cookieHeader = request.headers.get("cookie") || "";
    console.log("EventTypes GET - Cookie header present:", !!cookieHeader);
    if (cookieHeader) {
      const hasAuthCookie = cookieHeader.includes('sb-') || cookieHeader.includes('supabase');
      console.log("EventTypes GET - Has Supabase cookie:", hasAuthCookie);
    }

    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const supabaseAdmin = createAdminClientServer();

    // Check if dietitian has any event types
    const { data: existingEventTypes, error: checkError } = await supabaseAdmin
      .from("event_types")
      .select("id")
      .eq("user_id", dietitianId)
      .limit(1);

    if (checkError) {
      console.error("Error checking event types:", checkError);
      return NextResponse.json(
        { error: "Failed to fetch event types", details: checkError.message },
        { status: 500 }
      );
    }

    // If no event types exist, create default ones
    if (!existingEventTypes || existingEventTypes.length === 0) {
      console.log(`No event types found for dietitian ${dietitianId}, creating defaults...`);
      
      // Try to call the database function first (if migration was run)
      const { error: createError } = await supabaseAdmin.rpc(
        'create_default_event_types_for_dietitian',
        { dietitian_user_id: dietitianId }
      );

      if (createError) {
        console.log("Database function not available, creating defaults directly...", createError.message);
        
        // Fallback: Create default event types directly
        const defaultEventTypes = [
          {
            user_id: dietitianId,
            title: 'Free Trial Consultation',
            slug: 'free-trial-consultation',
            description: 'Get insights into why you need to see a dietician.',
            length: 15,
            price: 0,
            currency: 'NGN',
            active: true,
          },
          {
            user_id: dietitianId,
            title: '1-on-1 Consultation with Licensed Dietician',
            slug: '1-on-1-consultation-with-licensed-dietician',
            description: 'Have one on one consultation with Licensed Dietitician [Nutritional counseling and treatment plan]',
            length: 45,
            price: 15000,
            currency: 'NGN',
            active: true,
          },
          {
            user_id: dietitianId,
            title: 'Monitoring',
            slug: 'monitoring',
            description: 'Monitoring consultation',
            length: 20,
            price: 5000,
            currency: 'NGN',
            active: true,
          },
          {
            user_id: dietitianId,
            title: 'Test Event',
            slug: 'test-event',
            description: 'Test event for payment testing',
            length: 15,
            price: 100,
            currency: 'NGN',
            active: true,
          },
        ];

        // Insert default event types (ignore conflicts if they somehow exist)
        const { error: insertError } = await supabaseAdmin
          .from('event_types')
          .upsert(defaultEventTypes, {
            onConflict: 'user_id,slug',
            ignoreDuplicates: false,
          });

        if (insertError) {
          console.error("Error creating default event types directly:", insertError);
          // Continue anyway - try to fetch what we have
        } else {
          console.log("Default event types created directly");
        }
      } else {
        console.log("Default event types created via database function");
      }
    }

    // Fetch all event types (including newly created defaults)
    const { data: eventTypes, error } = await supabaseAdmin
      .from("event_types")
      .select("*")
      .eq("user_id", dietitianId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching event types:", error);
      return NextResponse.json(
        { error: "Failed to fetch event types", details: error.message },
        { status: 500 }
      );
    }

    console.log(`EventTypes GET - Returning ${eventTypes?.length || 0} event types for dietitian ${dietitianId}`);
    return NextResponse.json({ eventTypes: eventTypes || [] });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error fetching event types:", error);
    return NextResponse.json(
      { error: "Failed to fetch event types", details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create new event type
export async function POST(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const body = await request.json();
    const { title, slug, description, length, price, currency, active } = body;

    // Validate required fields
    if (!title || !slug) {
      return NextResponse.json({ error: "Title and slug are required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClientServer();

    // Check if slug is unique for this dietitian
    const { data: existing } = await supabaseAdmin
      .from("event_types")
      .select("id")
      .eq("slug", slug)
      .eq("user_id", dietitianId)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Slug already exists for this dietitian" }, { status: 400 });
    }

    // Create event type
    const { data: eventType, error } = await supabaseAdmin
      .from("event_types")
      .insert({
        title,
        slug,
        description,
        length: length || 30,
        price: price || 0,
        currency: currency || "NGN",
        user_id: dietitianId,
        active: active !== undefined ? active : true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating event type:", error);
      return NextResponse.json(
        { error: "Failed to create event type", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ eventType }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error creating event type:", error);
    return NextResponse.json(
      { error: "Failed to create event type", details: error.message },
      { status: 500 }
    );
  }
}
