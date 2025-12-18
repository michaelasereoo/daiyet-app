import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest, requireDietitianFromRequest } from "@/lib/auth-helpers";
import { EventTypeService } from "@/services/eventTypeService";

// GET: Fetch event types
// - If dietitianId query param is provided: fetch that dietitian's event types (public access)
// - Otherwise: fetch authenticated dietitian's own event types (requires dietitian auth)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  try {
    // Log cookies for debugging
    const cookieHeader = request.headers.get("cookie") || "";
    console.log("EventTypes GET - Cookie header present:", !!cookieHeader);
    if (cookieHeader) {
      const hasAuthCookie = cookieHeader.includes('sb-') || cookieHeader.includes('supabase');
      console.log("EventTypes GET - Has Supabase cookie:", hasAuthCookie);
    }
    const requestedDietitianId = searchParams.get("dietitianId");
    const filterType = searchParams.get("filter"); // 'book-a-call' or null
    
    console.log("EventTypes GET - Request params:", {
      url: request.url,
      requestedDietitianId,
      hasDietitianId: !!requestedDietitianId,
      filterType: filterType || 'none',
      allParams: Object.fromEntries(searchParams.entries())
    });
    
    let dietitianId: string;
    let isOwnEventTypes = false;
    
    if (requestedDietitianId) {
      // Public access: user (authenticated or not) is requesting a specific dietitian's event types
      console.log("EventTypes GET - Public access mode, dietitianId:", requestedDietitianId);
      dietitianId = requestedDietitianId;
      
      // Verify the dietitian exists and is actually a dietitian
      const supabaseAdmin = createAdminClientServer();
      const { data: targetDietitian, error: dietitianError } = await supabaseAdmin
        .from("users")
        .select("id, role")
        .eq("id", dietitianId)
        .single();

      if (dietitianError || !targetDietitian || (targetDietitian.role !== "DIETITIAN" && targetDietitian.role !== "THERAPIST")) {
        console.error("EventTypes GET - Dietitian/Therapist not found:", { dietitianId, error: dietitianError });
        return NextResponse.json(
          { error: "Dietitian/Therapist not found" },
          { status: 404 }
        );
      }
      
      // Store the role for later use
      const targetRole = targetDietitian.role as 'DIETITIAN' | 'THERAPIST';
      
      // Check if the authenticated user is the dietitian/therapist themselves
      // Wrap in try-catch to handle cases where auth fails (public access is still allowed)
      let currentUser = null;
      try {
        currentUser = await getCurrentUserFromRequest(request);
      } catch (error) {
        // Public access is allowed even if auth fails
        console.log("EventTypes GET - Auth check failed (public access allowed):", error);
      }
      isOwnEventTypes = currentUser?.id === dietitianId && (currentUser?.role === "DIETITIAN" || currentUser?.role === "THERAPIST");
      console.log("EventTypes GET - Public access verified, isOwnEventTypes:", isOwnEventTypes);
    } else {
      // Private access: dietitian fetching their own event types (requires auth)
      console.log("EventTypes GET - Private access mode (no dietitianId param)");
      const currentUser = await getCurrentUserFromRequest(request);
      
      if (!currentUser || (currentUser.role !== "DIETITIAN" && currentUser.role !== "THERAPIST")) {
        console.error("EventTypes GET - Auth failed:", { 
          hasUser: !!currentUser, 
          role: currentUser?.role 
        });
        return NextResponse.json(
          { error: "Forbidden: Therapist or Dietitian access required" },
          { status: 403 }
        );
      }
      
      dietitianId = currentUser.id;
      isOwnEventTypes = true;
      console.log("EventTypes GET - Private access verified for dietitian:", dietitianId);
    }

    // ✅ Use service layer for business logic
    // Service handles: atomic creation, filtering, error handling
    try {
      // Determine user role
      let userRole: 'DIETITIAN' | 'THERAPIST' | undefined;
      if (requestedDietitianId) {
        const supabaseAdmin = createAdminClientServer();
        const { data: targetUser } = await supabaseAdmin
          .from("users")
          .select("role")
          .eq("id", dietitianId)
          .single();
        userRole = targetUser?.role as 'DIETITIAN' | 'THERAPIST' | undefined;
      } else {
        // For private access, we already have the user from auth check
        const currentUser = await getCurrentUserFromRequest(request);
        userRole = currentUser?.role as 'DIETITIAN' | 'THERAPIST' | undefined;
      }
      
      console.log(`[API] Calling EventTypeService.getEventTypes with:`, {
        dietitianId,
        filter: filterType,
        isOwnEventTypes,
        userRole,
      });
      
      const eventTypes = await EventTypeService.getEventTypes(dietitianId, {
        filter: filterType === 'book-a-call' ? 'book-a-call' : null,
        isOwnEventTypes,
        userRole,
      });
      
      console.log(`[API] EventTypeService returned ${eventTypes.length} event types:`, 
        eventTypes.map(et => ({ title: et.title, slug: et.slug }))
      );

      // ✅ OPTIMIZED CACHING: Since all dietitians have the same 4 static event types,
      // and dietitians can't customize them (only availability), we can cache aggressively
      // For book-a-call: Cache for 5 minutes (data is static, same for all dietitians)
      // For dashboard: Cache for 5 minutes (same reason)
      const cacheMaxAge = 300; // 5 minutes - data is static
      
      console.log(`[EVENT TYPES API] ✅ Returning ${eventTypes.length} event types for dietitian ${dietitianId}${filterType === 'book-a-call' ? ' (book-a-call filter applied)' : ''}`);
      
      return NextResponse.json(
        { eventTypes },
        {
          headers: {
            'Cache-Control': `public, max-age=${cacheMaxAge}, stale-while-revalidate=600`,
            'X-Event-Types-Count': eventTypes.length.toString(),
            'X-Filter-Type': filterType || 'all',
          },
        }
      );
    } catch (error: any) {
      console.error('EventTypeService error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch event types' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    // Only return 401/403 for specific auth errors, not for general errors
    // Public access with dietitianId should not require authentication
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    // Only return 403 if it's explicitly a Forbidden error AND we're in private mode
    if (error.message && error.message.includes("Forbidden") && !searchParams.get("dietitianId")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
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
